import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { RedisService } from '../../common/redis/redis.service';
import { LoggerService } from '../../common/logger/logger.service';
import { JwtService } from '@nestjs/jwt';
import { UseGuards } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/',
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: LoggerService;

  constructor(
    private redisService: RedisService,
    private jwtService: JwtService,
  ) {
    this.logger = new LoggerService('WebSocketGateway');
  }

  afterInit(server: Server) {
    // Setup Redis Adapter for horizontal scaling
    const pubClient = this.redisService.getPubClient();
    const subClient = this.redisService.getSubClient();

    server.adapter(createAdapter(pubClient, subClient));

    this.logger.log('WebSocket Gateway initialized with Redis Adapter');
  }

  async handleConnection(client: Socket) {
    try {
      // Extract and verify JWT token
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;
      client.data.role = payload.role;

      this.logger.log(`Client connected: ${client.id} (User: ${payload.sub})`);

      // Send welcome message
      client.emit('connected', {
        message: 'Connected to Live Commerce WebSocket',
        userId: payload.sub,
      });
    } catch (error) {
      this.logger.error(`Authentication failed for client ${client.id}`, error.message);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Cleanup: Leave all rooms
    const rooms = Array.from(client.rooms).filter((room) => room !== client.id);
    rooms.forEach((room) => {
      client.leave(room);
      this.logger.log(`Client ${client.id} left room: ${room}`);
    });
  }

  @SubscribeMessage('join:stream')
  handleJoinStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string },
  ) {
    const roomName = `stream:${data.streamId}`;
    client.join(roomName);

    this.logger.log(`Client ${client.id} joined room: ${roomName}`);

    // Notify room members
    this.server.to(roomName).emit('user:joined', {
      userId: client.data.userId,
      streamId: data.streamId,
      timestamp: new Date().toISOString(),
    });

    return { success: true, room: roomName };
  }

  @SubscribeMessage('leave:stream')
  handleLeaveStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string },
  ) {
    const roomName = `stream:${data.streamId}`;
    client.leave(roomName);

    this.logger.log(`Client ${client.id} left room: ${roomName}`);

    // Notify room members
    this.server.to(roomName).emit('user:left', {
      userId: client.data.userId,
      streamId: data.streamId,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string; message: string },
  ) {
    const roomName = `stream:${data.streamId}`;

    const messagePayload = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: client.data.userId,
      message: data.message,
      streamId: data.streamId,
      timestamp: new Date().toISOString(),
    };

    // Store message in Redis (optional, for history)
    await this.redisService.set(
      `message:${messagePayload.id}`,
      JSON.stringify(messagePayload),
      3600, // 1 hour TTL
    );

    // Broadcast to all clients in the room
    this.server.to(roomName).emit('message:new', messagePayload);

    this.logger.log(`Message sent to room ${roomName} by user ${client.data.userId}`);

    return { success: true, messageId: messagePayload.id };
  }

  @SubscribeMessage('message:delete')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; streamId: string },
  ) {
    // Only allow message deletion by the sender or admin
    const messageKey = `message:${data.messageId}`;
    const messageData = await this.redisService.get(messageKey);

    if (!messageData) {
      return { success: false, error: 'Message not found' };
    }

    const message = JSON.parse(messageData);

    if (message.userId !== client.data.userId && client.data.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' };
    }

    // Delete from Redis
    await this.redisService.del(messageKey);

    // Notify room members
    const roomName = `stream:${data.streamId}`;
    this.server.to(roomName).emit('message:deleted', {
      messageId: data.messageId,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string },
  ) {
    const roomName = `stream:${data.streamId}`;

    this.server.to(roomName).emit('typing:user', {
      userId: client.data.userId,
      isTyping: true,
    });

    return { success: true };
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string },
  ) {
    const roomName = `stream:${data.streamId}`;

    this.server.to(roomName).emit('typing:user', {
      userId: client.data.userId,
      isTyping: false,
    });

    return { success: true };
  }

  // Helper method for broadcasting events from services
  broadcastToStream(streamId: string, event: string, data: any) {
    const roomName = `stream:${streamId}`;
    this.server.to(roomName).emit(event, data);
  }
}
