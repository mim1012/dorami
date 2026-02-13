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

interface DeleteMessagePayload {
  liveId: string;
  messageId: string;
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
    // Validate message exists and is a string
    if (!payload.message || typeof payload.message !== 'string') {
      client.emit('error', {
        type: 'error',
        errorCode: 'INVALID_MESSAGE',
        message: 'Message is required and must be a string',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Sanitize: strip HTML tags to prevent XSS
    const sanitizedMessage = payload.message.replace(/<[^>]*>/g, '').trim();

    // Validate length (max 500 characters)
    if (sanitizedMessage.length === 0 || sanitizedMessage.length > 500) {
      client.emit('error', {
        type: 'error',
        errorCode: 'MESSAGE_TOO_LONG',
        message: 'Message must be between 1 and 500 characters',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const roomName = `live:${payload.liveId}`;

    // Broadcast to all clients in room (including sender)
    this.server.to(roomName).emit('chat:message', {
      type: 'chat:message',
      data: {
        id: Date.now().toString(),
        liveId: payload.liveId,
        userId: client.user.userId,
        message: sanitizedMessage,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      type: 'chat:send-message:success',
      data: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  @SubscribeMessage('chat:delete-message')
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: DeleteMessagePayload,
  ) {
    // Check if user is ADMIN
    if (client.user.role !== 'ADMIN') {
      client.emit('error', {
        type: 'error',
        errorCode: 'FORBIDDEN',
        message: 'Only administrators can delete messages',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Validate messageId
    if (!payload.messageId) {
      client.emit('error', {
        type: 'error',
        errorCode: 'INVALID_MESSAGE_ID',
        message: 'Message ID is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const roomName = `live:${payload.liveId}`;

    console.log(`🗑️  Admin ${client.user.userId} deleted message ${payload.messageId} in ${roomName}`);

    // Broadcast deletion to all clients in room
    this.server.to(roomName).emit('chat:message-deleted', {
      type: 'chat:message-deleted',
      data: {
        messageId: payload.messageId,
        liveId: payload.liveId,
        deletedBy: client.user.userId,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      type: 'chat:delete-message:success',
      data: {
        messageId: payload.messageId,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
