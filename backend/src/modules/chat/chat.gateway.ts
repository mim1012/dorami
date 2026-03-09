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
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import {
  AuthenticatedSocket,
  authenticateSocket,
} from '../../common/middleware/ws-jwt-auth.middleware';
import { MessageQueueService } from '../../common/services/message-queue.service';
import { PrismaService } from '../../common/prisma/prisma.service';

interface ChatMessagePayload {
  liveId: string;
  message: string;
  clientMessageId?: string;
}

interface DeleteMessagePayload {
  liveId: string;
  messageId: string;
}

// Stream keys are 32-char hex strings
const STREAM_KEY_REGEX = /^[a-f0-9]{32}$/;
const CHAT_MESSAGE_DEDUP_TTL_MS = 60_000;

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
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly roomMembers = new Map<string, Set<string>>();
  private readonly userSockets = new Map<string, Set<string>>();
  private readonly socketRooms = new Map<string, Set<string>>();
  private readonly recentClientMessageIds = new Map<string, number>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  // Per-user message timestamps for rate limiting
  private readonly messageTimes = new Map<string, number[]>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly messageQueueService: MessageQueueService,
    private readonly prismaService: PrismaService,
  ) {}

  afterInit(_server: Server) {
    this.logger.log('Chat Gateway initialized');

    // Periodic cleanup of messageTimes to prevent memory leaks
    // Every 1 minute, remove timestamps older than the rate limit window
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [userId, times] of this.messageTimes.entries()) {
        const recentTimes = times.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
        if (recentTimes.length > 0) {
          this.messageTimes.set(userId, recentTimes);
        } else {
          this.messageTimes.delete(userId);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.logger.debug(`Chat rate limit cleanup: removed ${cleanedCount} expired user entries`);
      }

      const dedupeCleanupNow = Date.now();
      let duplicateKeysRemoved = 0;
      for (const [key, expireAt] of this.recentClientMessageIds.entries()) {
        if (expireAt <= dedupeCleanupNow) {
          this.recentClientMessageIds.delete(key);
          duplicateKeysRemoved += 1;
        }
      }
      if (duplicateKeysRemoved > 0) {
        this.logger.debug(`Chat dedupe cleanup: removed ${duplicateKeysRemoved} message ids`);
      }
    }, 60000); // Run every 60 seconds
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.roomMembers.clear();
    this.userSockets.clear();
    this.socketRooms.clear();
    this.messageTimes.clear();
    this.recentClientMessageIds.clear();
  }

  async handleConnection(client: Socket) {
    try {
      const authenticatedClient = await authenticateSocket(
        client,
        this.jwtService,
        this.prismaService,
      );
      const userId = authenticatedClient.user.userId;

      // Track socket ids by user for online/offline evaluation
      const userSocketIds = this.userSockets.get(userId) ?? new Set<string>();
      userSocketIds.add(authenticatedClient.id);
      this.userSockets.set(userId, userSocketIds);

      this.logger.log(`Client connected: ${authenticatedClient.id} (User: ${userId})`);

      client.emit('connection:success', {
        type: 'connection:success',
        data: {
          message: 'Connected to chat server',
          userId,
          timestamp: new Date().toISOString(),
        },
      });

      // Deliver queued messages for this user after re-authentication
      await this.flushQueuedMessages(authenticatedClient, userId);
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
    const authClient = client as AuthenticatedSocket;
    const userId = authClient.user?.userId;

    if (!userId) {
      return;
    }

    const userSocketIds = this.userSockets.get(userId);
    if (userSocketIds) {
      userSocketIds.delete(client.id);
      if (userSocketIds.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    const socketRoomNames = this.socketRooms.get(client.id);
    if (socketRoomNames) {
      for (const roomName of socketRoomNames) {
        this.removeUserFromRoom(userId, roomName);
      }
      this.socketRooms.delete(client.id);
    }

    // Clean up rate limit entries for disconnected user
    this.messageTimes.delete(userId);
  }

  private async flushQueuedMessages(authenticatedClient: AuthenticatedSocket, userId: string) {
    const queuedMessages = await this.messageQueueService.getQueuedMessages(userId);
    if (queuedMessages.length === 0) {
      return;
    }

    this.logger.debug(`Flushing ${queuedMessages.length} queued message(s) to user=${userId}`);
    for (const queuedMessage of queuedMessages) {
      const messageData = queuedMessage.data as {
        data?: Record<string, unknown>;
        id?: string;
        clientMessageId?: string;
      };
      const messagePayload = (messageData.data as Record<string, unknown>) ?? {};
      const dedupeId = (messagePayload?.id as string | undefined) ?? messageData.clientMessageId;
      if (dedupeId) {
        const dedupeKey = `user:${userId}:message:${dedupeId}`;
        const expireAt = this.recentClientMessageIds.get(dedupeKey);
        if (expireAt && expireAt > Date.now()) {
          continue;
        }
        this.recentClientMessageIds.set(dedupeKey, Date.now() + CHAT_MESSAGE_DEDUP_TTL_MS);
      }
      authenticatedClient.emit(queuedMessage.event, queuedMessage.data);
    }
  }

  private isDuplicateClientMessage(userId: string, messageId: string): boolean {
    const dedupeKey = `user:${userId}:message:${messageId}`;
    const expireAt = this.recentClientMessageIds.get(dedupeKey);
    if (expireAt && expireAt > Date.now()) {
      return true;
    }
    this.recentClientMessageIds.set(dedupeKey, Date.now() + CHAT_MESSAGE_DEDUP_TTL_MS);
    return false;
  }

  private addUserToRoom(userId: string, roomName: string) {
    const members = this.roomMembers.get(roomName) ?? new Set<string>();
    members.add(userId);
    this.roomMembers.set(roomName, members);
  }

  private removeUserFromRoom(userId: string, roomName: string) {
    const members = this.roomMembers.get(roomName);
    if (!members) {
      return;
    }
    members.delete(userId);
    if (members.size === 0) {
      this.roomMembers.delete(roomName);
    } else {
      this.roomMembers.set(roomName, members);
    }
  }

  private addSocketToRoom(socketId: string, roomName: string) {
    const rooms = this.socketRooms.get(socketId) ?? new Set<string>();
    rooms.add(roomName);
    this.socketRooms.set(socketId, rooms);
  }

  private removeSocketFromRoom(socketId: string, roomName: string) {
    const rooms = this.socketRooms.get(socketId);
    if (!rooms) {
      return;
    }

    rooms.delete(roomName);
    if (rooms.size === 0) {
      this.socketRooms.delete(socketId);
    } else {
      this.socketRooms.set(socketId, rooms);
    }
  }

  private isUserOnline(userId: string): boolean {
    return (this.userSockets.get(userId)?.size ?? 0) > 0;
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
    this.addUserToRoom(client.user.userId, roomName);
    this.addSocketToRoom(client.id, roomName);

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
    this.removeUserFromRoom(client.user.userId, roomName);
    this.removeSocketFromRoom(client.id, roomName);

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
    const clientMessageId =
      typeof payload.clientMessageId === 'string' ? payload.clientMessageId.trim() : '';
    const sanitizedClientMessageId = clientMessageId || randomUUID();

    if (this.isDuplicateClientMessage(client.user.userId, sanitizedClientMessageId)) {
      client.emit('chat:send-message:success', {
        type: 'chat:send-message:success',
        data: {
          timestamp: new Date().toISOString(),
          clientMessageId: sanitizedClientMessageId,
        },
      });
      return;
    }

    const chatMessage = {
      type: 'chat:message',
      data: {
        id: randomUUID(),
        liveId: payload.liveId,
        userId: client.user.userId,
        username: client.user.name,
        message: sanitizedMessage,
        clientMessageId: sanitizedClientMessageId,
        timestamp: new Date().toISOString(),
      },
    };

    this.server.to(roomName).emit('chat:message', chatMessage);

    const roomMembers = this.roomMembers.get(roomName);
    if (roomMembers) {
      const offlineUserIds = Array.from(roomMembers).filter(
        (memberUserId) => !this.isUserOnline(memberUserId),
      );

      if (offlineUserIds.length > 0) {
        await Promise.allSettled(
          offlineUserIds.map((memberUserId) =>
            this.messageQueueService.queueMessage(memberUserId, {
              event: 'chat:message',
              data: chatMessage,
            }),
          ),
        );
      }
    }

    return {
      type: 'chat:send-message:success',
      data: {
        timestamp: new Date().toISOString(),
        clientMessageId: sanitizedClientMessageId,
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
