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
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import {
  AuthenticatedSocket,
  authenticateSocket,
} from '../../common/middleware/ws-jwt-auth.middleware';

interface ChatMessagePayload {
  liveId: string;
  message: string;
}

interface DeleteMessagePayload {
  liveId: string;
  messageId: string;
}

// Stream keys are 32-char hex strings
const STREAM_KEY_REGEX = /^[a-f0-9]{32}$/;

// Rate limit: max messages per window
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 5000;

@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: process.env.CORS_ORIGINS?.split(','),
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // Per-user message timestamps for rate limiting
  private readonly messageTimes = new Map<string, number[]>();

  constructor(private readonly jwtService: JwtService) {}

  afterInit(_server: Server) {
    this.logger.log('Chat Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const authenticatedClient = await authenticateSocket(client, this.jwtService);

      this.logger.log(
        `Client connected: ${authenticatedClient.id} (User: ${authenticatedClient.user.userId})`,
      );

      client.emit('connection:success', {
        type: 'connection:success',
        data: {
          message: 'Connected to chat server',
          userId: authenticatedClient.user.userId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.error(`Connection failed: ${(error as Error).message}`);
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
    this.logger.log(`Client disconnected: ${client.id}`);
    // Clean up rate limit entries for disconnected user
    const authClient = client as AuthenticatedSocket;
    if (authClient.user?.userId) {
      this.messageTimes.delete(authClient.user.userId);
    }
  }

  @SubscribeMessage('chat:join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { liveId: string },
  ) {
    const { liveId } = payload;

    // Validate stream key format
    if (!liveId || !STREAM_KEY_REGEX.test(liveId)) {
      client.emit('error', {
        type: 'error',
        errorCode: 'INVALID_STREAM_KEY',
        message: 'Invalid stream key format',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const roomName = `live:${liveId}`;

    await client.join(roomName);

    this.logger.log(`User ${client.user.userId} joined room ${roomName}`);

    this.server.to(roomName).emit('chat:user-joined', {
      type: 'chat:user-joined',
      data: {
        userId: client.user.userId,
        liveId,
        timestamp: new Date().toISOString(),
      },
    });

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

    this.logger.log(`User ${client.user.userId} left room ${roomName}`);

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

    // Rate limiting: max RATE_LIMIT_MAX messages per RATE_LIMIT_WINDOW_MS
    const userId = client.user.userId;
    const now = Date.now();
    const times = this.messageTimes.get(userId) ?? [];
    const recentTimes = times.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recentTimes.length >= RATE_LIMIT_MAX) {
      client.emit('error', {
        type: 'error',
        errorCode: 'RATE_LIMITED',
        message: '메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해주세요.',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    recentTimes.push(now);
    this.messageTimes.set(userId, recentTimes);

    // Sanitize: strip all HTML tags including unclosed ones and remaining angle brackets
    const sanitizedMessage = payload.message
      .replace(/<[^>]*>?/g, '')
      .replace(/[<>]/g, '')
      .trim();

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

    this.server.to(roomName).emit('chat:message', {
      type: 'chat:message',
      data: {
        id: randomUUID(),
        liveId: payload.liveId,
        userId: client.user.userId,
        username: client.user.name,
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
    if (client.user.role !== 'ADMIN') {
      client.emit('error', {
        type: 'error',
        errorCode: 'FORBIDDEN',
        message: 'Only administrators can delete messages',
        timestamp: new Date().toISOString(),
      });
      return;
    }

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

    this.logger.log(
      `Admin ${client.user.userId} deleted message ${payload.messageId} in ${roomName}`,
    );

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
