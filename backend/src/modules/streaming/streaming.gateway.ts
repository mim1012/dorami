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
import { StreamingService } from './streaming.service';
import { AuthenticatedSocket, authenticateSocket } from '../../common/middleware/ws-jwt-auth.middleware';

interface ViewerJoinPayload {
  streamKey: string;
}

interface ViewerLeavePayload {
  streamKey: string;
}

@WebSocketGateway({
  namespace: 'streaming',
  cors: {
    origin: process.env.CORS_ORIGINS?.split(','),
    credentials: true,
  },
})
export class StreamingGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  // Track which streams each socket is watching
  private readonly socketStreams = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly streamingService: StreamingService,
  ) {}

  afterInit(_server: Server) {
    console.log('✅ Streaming Gateway initialized');
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
          message: 'Connected to streaming server',
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

  async handleDisconnect(client: Socket) {
    console.log(`👋 Client disconnected: ${client.id}`);

    // If client was watching a stream, decrement viewer count
    const streamKey = this.socketStreams.get(client.id);
    if (streamKey) {
      await this.handleViewerLeave(client, streamKey);
    }
  }

  @SubscribeMessage('stream:viewer:join')
  async handleViewerJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ViewerJoinPayload,
  ) {
    const { streamKey } = payload;
    const roomName = `stream:${streamKey}`;

    // Join room for this stream
    await client.join(roomName);

    // Track this socket's stream
    this.socketStreams.set(client.id, streamKey);

    // Increment viewer count in Redis
    const viewerCount = await this.streamingService.updateViewerCount(streamKey, 1);

    console.log(`📺 User ${client.user.userId} joined stream ${streamKey} (viewers: ${viewerCount})`);

    // Broadcast updated viewer count to all viewers in room
    this.server.to(roomName).emit('stream:viewer-count', {
      type: 'stream:viewer-count',
      data: {
        streamKey,
        viewerCount,
        timestamp: new Date().toISOString(),
      },
    });

    // Confirm to client
    return {
      type: 'stream:viewer:join:success',
      data: {
        streamKey,
        viewerCount,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @SubscribeMessage('stream:viewer:leave')
  async handleViewerLeaveMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ViewerLeavePayload,
  ) {
    const { streamKey } = payload;
    await this.handleViewerLeave(client, streamKey);

    return {
      type: 'stream:viewer:leave:success',
      data: {
        streamKey,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private async handleViewerLeave(client: Socket, streamKey: string) {
    const roomName = `stream:${streamKey}`;

    // Leave room
    await client.leave(roomName);

    // Remove from tracking
    this.socketStreams.delete(client.id);

    // Decrement viewer count in Redis
    const viewerCount = await this.streamingService.updateViewerCount(streamKey, -1);

    console.log(`📤 Client ${client.id} left stream ${streamKey} (viewers: ${viewerCount})`);

    // Broadcast updated viewer count to remaining viewers
    this.server.to(roomName).emit('stream:viewer-count', {
      type: 'stream:viewer-count',
      data: {
        streamKey,
        viewerCount,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
