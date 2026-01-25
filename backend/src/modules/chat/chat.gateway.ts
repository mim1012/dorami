import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedSocket, authenticateSocket } from '../../common/middleware/ws-jwt-auth.middleware';

interface ChatMessagePayload {
  liveId: string;
  message: string;
}

@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: process.env.CORS_ORIGINS?.split(','),
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  afterInit(server: Server) {
    console.log('✅ Chat Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      // Authenticate client
      const authenticatedClient = await authenticateSocket(client, this.jwtService);

      console.log(`✅ Client connected: ${authenticatedClient.id} (User: ${authenticatedClient.user.userId})`);

      // Send welcome message
      client.emit('connection:success', {
        type: 'connection:success',
        data: {
          message: 'Connected to chat server',
          userId: authenticatedClient.user.userId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      client.emit('error', {
        type: 'error',
        errorCode: 'AUTH_FAILED',
        message: 'Authentication failed',
        timestamp: new Date().toISOString(),
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`👋 Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('chat:join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { liveId: string },
  ) {
    const roomName = `live:${payload.liveId}`;

    await client.join(roomName);

    console.log(`📥 User ${client.user.userId} joined room ${roomName}`);

    // Notify room members
    this.server.to(roomName).emit('chat:user-joined', {
      type: 'chat:user-joined',
      data: {
        userId: client.user.userId,
        liveId: payload.liveId,
        timestamp: new Date().toISOString(),
      },
    });

    // Confirm to client
    return {
      type: 'chat:join-room:success',
      data: {
        roomName,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @SubscribeMessage('chat:leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { liveId: string },
  ) {
    const roomName = `live:${payload.liveId}`;

    await client.leave(roomName);

    console.log(`📤 User ${client.user.userId} left room ${roomName}`);

    // Notify room members
    this.server.to(roomName).emit('chat:user-left', {
      type: 'chat:user-left',
      data: {
        userId: client.user.userId,
        liveId: payload.liveId,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      type: 'chat:leave-room:success',
      data: {
        roomName,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @SubscribeMessage('chat:send-message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ChatMessagePayload,
  ) {
    const roomName = `live:${payload.liveId}`;

    // Broadcast to all clients in room (including sender)
    this.server.to(roomName).emit('chat:message', {
      type: 'chat:message',
      data: {
        id: Date.now().toString(), // TODO: Generate proper ID
        liveId: payload.liveId,
        userId: client.user.userId,
        message: payload.message,
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`💬 Message sent in ${roomName} by user ${client.user.userId}`);

    return {
      type: 'chat:send-message:success',
      data: {
        timestamp: new Date().toISOString(),
      },
    };
  }
}
