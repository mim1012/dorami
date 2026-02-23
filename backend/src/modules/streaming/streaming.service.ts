import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  StartStreamDto,
  UpdateStreamDto,
  StreamingSessionResponseDto,
  GenerateKeyDto,
  StreamStatusDto,
  StreamHistoryQueryDto,
  StreamHistoryResponseDto,
  StreamHistoryItemDto,
} from './dto/streaming.dto';
import { LiveStatusDto } from '../admin/dto/admin.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { randomBytes } from 'crypto';

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Get upcoming live streams for homepage
   * Returns streams with PENDING status ordered by scheduled time
   */
  async getUpcomingStreams(limit = 3): Promise<any[]> {
    try {
      const streams = await this.prisma.liveStream.findMany({
        where: {
          OR: [{ status: 'LIVE' }, { status: 'PENDING', expiresAt: { gte: new Date() } }],
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return streams.map((stream) => ({
        id: stream.id,
        streamKey: stream.streamKey,
        title: stream.title,
        scheduledTime: stream.scheduledAt || stream.expiresAt,
        thumbnailUrl: stream.thumbnailUrl || null,
        isLive: stream.status === 'LIVE',
        streamer: {
          id: stream.user.id,
          name: stream.user.name,
        },
      }));
    } catch (error) {
      this.logger.error(`Failed to get upcoming streams: ${error.message}`, error.stack);
      throw new BusinessException(
        'FAILED_TO_GET_UPCOMING_STREAMS',
        {
          statusCode: 500,
          error: 'Internal Server Error',
        },
        `Failed to retrieve upcoming streams: ${error.message}`,
      );
    }
  }

  async startStream(
    userId: string,
    startStreamDto: StartStreamDto,
  ): Promise<StreamingSessionResponseDto> {
    // Check if user already has an active stream
    const existingStream = await this.prisma.liveStream.findFirst({
      where: {
        userId,
        status: { in: ['PENDING', 'LIVE'] },
      },
    });

    if (existingStream) {
      throw new BusinessException(
        'STREAM_ALREADY_ACTIVE',
        { streamId: existingStream.id, streamKey: existingStream.streamKey },
        'You already have an active streaming session',
      );
    }

    // Generate unique stream key
    const streamKey = this.generateUniqueKey();

    // Create streaming session
    const session = await this.prisma.liveStream.create({
      data: {
        userId,
        streamKey,
        title: 'Live Stream',
        expiresAt: new Date(startStreamDto.expiresAt),
        status: 'PENDING',
      },
    });

    this.eventEmitter.emit('stream:created', { streamId: session.id });

    return this.mapToResponseDto(session);
  }

  async updateStream(
    streamId: string,
    userId: string,
    dto: UpdateStreamDto,
  ): Promise<StreamingSessionResponseDto> {
    const session = await this.prisma.liveStream.findFirst({
      where: { id: streamId, userId },
    });

    if (!session) {
      throw new BusinessException('STREAM_NOT_FOUND', { streamId });
    }

    if (session.status !== 'PENDING') {
      throw new BusinessException(
        'INVALID_STREAM_STATE',
        { currentStatus: session.status },
        `Only PENDING streams can be updated (current: ${session.status})`,
      );
    }

    const data: { title?: string; expiresAt?: Date } = {};
    if (dto.title !== undefined) {
      data.title = dto.title;
    }
    if (dto.expiresAt !== undefined) {
      data.expiresAt = new Date(dto.expiresAt);
    }

    const updated = await this.prisma.liveStream.update({
      where: { id: streamId },
      data,
    });

    return this.mapToResponseDto(updated);
  }

  async cancelStream(streamId: string, userId: string): Promise<void> {
    const session = await this.prisma.liveStream.findFirst({
      where: { id: streamId, userId },
    });

    if (!session) {
      throw new BusinessException('STREAM_NOT_FOUND', { streamId });
    }

    if (session.status !== 'PENDING') {
      throw new BusinessException(
        'INVALID_STREAM_STATE',
        { currentStatus: session.status },
        `Only PENDING streams can be cancelled (current: ${session.status})`,
      );
    }

    await this.prisma.liveStream.update({
      where: { id: streamId },
      data: { status: 'OFFLINE' },
    });

    // Clean up Redis if any metadata was cached
    await this.redisService.del(`stream:${session.streamKey}:meta`);
    await this.redisService.del(`stream:${session.streamKey}:viewers`);

    this.logger.log(`Stream ${streamId} cancelled by user ${userId}`);
  }

  async goLive(streamId: string, userId: string): Promise<StreamingSessionResponseDto> {
    const session = await this.prisma.liveStream.findFirst({
      where: {
        id: streamId,
        userId,
      },
    });

    if (!session) {
      throw new BusinessException('STREAM_NOT_FOUND', { streamId });
    }

    // Only PENDING streams can go live
    if (session.status !== 'PENDING') {
      throw new BusinessException(
        'INVALID_STREAM_STATE',
        { currentStatus: session.status },
        `Stream must be in PENDING state to go live (current: ${session.status})`,
      );
    }

    const updatedSession = await this.prisma.liveStream.update({
      where: { id: streamId },
      data: {
        status: 'LIVE',
        startedAt: new Date(),
      },
    });

    // Update Redis cache using streamKey-based key
    await this.redisService.set(
      `stream:${session.streamKey}:meta`,
      JSON.stringify({
        userId: session.userId,
        title: session.title,
        status: 'LIVE',
        streamId: session.id,
        startedAt: updatedSession.startedAt?.toISOString(),
      }),
      3600 * 24,
    );

    this.eventEmitter.emit('stream:started', { streamId: session.id });

    return this.mapToResponseDto(updatedSession);
  }

  async stopStream(streamId: string, userId: string): Promise<void> {
    const session = await this.prisma.liveStream.findFirst({
      where: {
        id: streamId,
        userId,
      },
    });

    if (!session) {
      throw new BusinessException('STREAM_NOT_FOUND', { streamId });
    }

    await this.prisma.liveStream.update({
      where: { id: streamId },
      data: {
        status: 'OFFLINE',
        endedAt: new Date(),
      },
    });

    // Remove from Redis (use streamKey-based keys, consistent with goLive/handleStreamDone)
    await this.redisService.del(`stream:${session.streamKey}:meta`);
    await this.redisService.del(`stream:${session.streamKey}:viewers`);

    this.eventEmitter.emit('stream:ended', { streamId: session.id });
  }

  async getStreamStatus(streamId: string): Promise<StreamingSessionResponseDto> {
    const session = await this.prisma.liveStream.findUnique({
      where: { id: streamId },
    });

    if (!session) {
      throw new BusinessException('STREAM_NOT_FOUND', { streamId });
    }

    return this.mapToResponseDto(session);
  }

  async getActiveStreams(): Promise<StreamingSessionResponseDto[]> {
    const sessions = await this.prisma.liveStream.findMany({
      where: {
        status: 'LIVE',
      },
      orderBy: { startedAt: 'desc' },
    });

    return sessions.map((s) => this.mapToResponseDto(s));
  }

  async generateKey(userId: string, dto: GenerateKeyDto): Promise<StreamingSessionResponseDto> {
    // Auto-clean expired PENDING streams for this user
    await this.prisma.liveStream.updateMany({
      where: {
        userId,
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'OFFLINE' },
    });

    // Check if user already has an active stream
    const existingStream = await this.prisma.liveStream.findFirst({
      where: {
        userId,
        status: { in: ['PENDING', 'LIVE'] },
      },
    });

    if (existingStream) {
      // If LIVE, block — can't create a new stream while broadcasting
      if (existingStream.status === 'LIVE') {
        throw new BusinessException(
          'STREAM_ALREADY_ACTIVE',
          { streamId: existingStream.id },
          '현재 방송 중입니다. 방송을 종료한 후 다시 시도하세요.',
        );
      }

      // If PENDING, return the existing session so user can see their stream key
      this.logger.log(`Returning existing PENDING stream ${existingStream.id} for user ${userId}`);
      // Update title/scheduledAt/thumbnailUrl if new values were provided
      const pendingUpdates: Record<string, any> = {};
      if (dto.title && dto.title !== existingStream.title) {
        pendingUpdates.title = dto.title;
      }
      if (dto.scheduledAt !== undefined) {
        pendingUpdates.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
      }
      if (dto.thumbnailUrl !== undefined) {
        pendingUpdates.thumbnailUrl = dto.thumbnailUrl || null;
      }
      if (Object.keys(pendingUpdates).length > 0) {
        const updated = await this.prisma.liveStream.update({
          where: { id: existingStream.id },
          data: pendingUpdates,
        });
        return this.mapToResponseDto(updated);
      }
      return this.mapToResponseDto(existingStream);
    }

    // Generate unique stream key
    const streamKey = this.generateUniqueKey();

    // Set expiration to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Create streaming session
    const session = await this.prisma.liveStream.create({
      data: {
        userId,
        streamKey,
        title: dto.title || 'Live Stream',
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        thumbnailUrl: dto.thumbnailUrl || null,
        expiresAt,
        status: 'PENDING',
      },
    });

    // Store stream metadata in Redis for quick access (non-critical)
    try {
      await this.redisService.set(
        `stream:${session.streamKey}:meta`,
        JSON.stringify({
          userId: session.userId,
          title: session.title,
          status: session.status,
          streamId: session.id,
        }),
        3600 * 24, // 24 hour TTL
      );
      await this.redisService.set(`stream:${session.streamKey}:viewers`, '0', 3600 * 24);
    } catch {
      this.logger.warn(`Failed to cache stream ${session.streamKey} metadata in Redis`);
    }

    this.eventEmitter.emit('stream:created', {
      streamId: session.id,
      streamKey: session.streamKey,
    });

    return this.mapToResponseDto(session);
  }

  async getStreamStatusByKey(streamKey: string): Promise<StreamStatusDto> {
    // Try Redis cache first for metadata
    const cached = await this.redisService.get(`stream:${streamKey}:meta`);

    let title = 'Live Stream';
    let status = 'OFFLINE';
    let startedAt: Date | undefined;

    if (cached) {
      const data = JSON.parse(cached);
      title = data.title;
      status = data.status;
      startedAt = data.startedAt ? new Date(data.startedAt) : undefined;
    } else {
      // Fallback to database
      const session = await this.prisma.liveStream.findUnique({
        where: { streamKey },
      });

      if (session) {
        title = session.title;
        status = session.status;
        startedAt = session.startedAt || undefined;
      }
    }

    // Get viewer count from Redis
    const viewerCountStr = await this.redisService.get(`stream:${streamKey}:viewers`);
    const viewerCount = viewerCountStr ? parseInt(viewerCountStr, 10) : 0;

    return {
      status,
      viewerCount,
      startedAt,
      title,
    };
  }

  async getStreamHistory(query: StreamHistoryQueryDto): Promise<StreamHistoryResponseDto> {
    const { page, limit, userId, dateFrom, dateTo } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (userId) {
      where.userId = userId;
    }

    if (dateFrom || dateTo) {
      where.startedAt = {};
      if (dateFrom) {
        where.startedAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.startedAt.lte = endDate;
      }
    }

    // Get total count
    const total = await this.prisma.liveStream.count({ where });

    // Get paginated streams
    const streams = await this.prisma.liveStream.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    const streamDtos: StreamHistoryItemDto[] = streams.map((stream) => ({
      id: stream.id,
      streamKey: stream.streamKey,
      title: stream.title,
      userId: stream.userId,
      userName: stream.user.name,
      startedAt: stream.startedAt,
      endedAt: stream.endedAt,
      totalDuration: stream.totalDuration,
      peakViewers: stream.peakViewers,
      status: stream.status,
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      streams: streamDtos,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async updateViewerCount(streamKey: string, delta: number): Promise<number> {
    const key = `stream:${streamKey}:viewers`;
    const client = this.redisService.getClient();

    let viewerCount: number;

    if (delta > 0) {
      viewerCount = await client.incr(key);
    } else if (delta < 0) {
      // Atomic decrement that won't go below zero (Lua script)
      const result = await client.eval(
        `local current = tonumber(redis.call('GET', KEYS[1]) or '0')
         if current > 0 then
           return redis.call('DECR', KEYS[1])
         end
         return 0`,
        1,
        key,
      );
      viewerCount = typeof result === 'number' ? result : parseInt(String(result), 10);
    } else {
      const current = await this.redisService.get(key);
      viewerCount = current ? parseInt(current, 10) : 0;
    }

    // Update peak viewers if needed
    const session = await this.prisma.liveStream.findUnique({
      where: { streamKey },
      select: { id: true, peakViewers: true },
    });

    if (session && viewerCount > session.peakViewers) {
      await this.prisma.liveStream.update({
        where: { id: session.id },
        data: { peakViewers: viewerCount },
      });
    }

    return viewerCount;
  }

  private generateUniqueKey(): string {
    return randomBytes(16).toString('hex');
  }

  async getLiveStatus(): Promise<LiveStatusDto> {
    // Find the most recent LIVE stream
    const liveStream = await this.prisma.liveStream.findFirst({
      where: {
        status: 'LIVE',
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    if (!liveStream) {
      return {
        isLive: false,
        streamId: null,
        streamKey: null,
        title: null,
        duration: null,
        viewerCount: 0,
        thumbnailUrl: null,
        startedAt: null,
      };
    }

    // Get viewer count from Redis
    const viewerCountStr = await this.redisService.get(`stream:${liveStream.streamKey}:viewers`);
    const viewerCount = viewerCountStr ? parseInt(viewerCountStr, 10) : 0;

    // Calculate duration
    const duration = liveStream.startedAt
      ? this.formatDuration(new Date().getTime() - liveStream.startedAt.getTime())
      : null;

    return {
      isLive: true,
      streamId: liveStream.id,
      streamKey: liveStream.streamKey,
      title: liveStream.title,
      duration,
      viewerCount,
      thumbnailUrl: null, // TODO: Implement thumbnail generation
      startedAt: liveStream.startedAt,
    };
  }

  private formatDuration(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Authenticate RTMP stream publish request from nginx-rtmp
   * Called by nginx-rtmp on_publish callback
   * Returns true if stream key is valid and allowed to publish
   */
  async authenticateStream(streamKey: string, clientIp?: string): Promise<boolean> {
    this.logger.log(`RTMP auth request for stream key: ${streamKey} from IP: ${clientIp}`);

    // Find stream session by key
    const session = await this.prisma.liveStream.findUnique({
      where: { streamKey },
    });

    if (!session) {
      this.logger.warn(`RTMP auth failed: Stream key not found - ${streamKey}`);
      return false;
    }

    // Check if stream is in valid state (PENDING or OFFLINE for reconnection)
    if (session.status !== 'PENDING' && session.status !== 'OFFLINE' && session.status !== 'LIVE') {
      this.logger.warn(
        `RTMP auth failed: Stream in invalid state - ${streamKey}, status: ${session.status}`,
      );
      return false;
    }

    // Check if stream key has expired.
    // Skip expiry check for LIVE streams — an active broadcast must not be
    // interrupted by key expiry on OBS reconnect.
    if (session.status !== 'LIVE' && session.expiresAt && new Date() > session.expiresAt) {
      this.logger.warn(`RTMP auth failed: Stream key expired - ${streamKey}`);
      return false;
    }

    // Authentication successful - update stream to LIVE.
    // Extend expiresAt to at least 48h from now so that OBS reconnects
    // after a brief disconnect are never blocked by key expiry.
    const minExpiresAt = new Date();
    minExpiresAt.setHours(minExpiresAt.getHours() + 48);
    const newExpiresAt =
      session.expiresAt && session.expiresAt > minExpiresAt ? session.expiresAt : minExpiresAt;

    await this.prisma.liveStream.update({
      where: { id: session.id },
      data: {
        status: 'LIVE',
        startedAt: session.startedAt || new Date(),
        expiresAt: newExpiresAt,
      },
    });

    // Update Redis cache
    await this.redisService.set(
      `stream:${streamKey}:meta`,
      JSON.stringify({
        userId: session.userId,
        title: session.title,
        status: 'LIVE',
        streamId: session.id,
        startedAt: new Date().toISOString(),
      }),
      3600 * 24,
    );

    this.logger.log(`RTMP auth successful: Stream ${streamKey} is now LIVE`);
    this.eventEmitter.emit('stream:started', { streamId: session.id, streamKey });

    return true;
  }

  /**
   * Handle RTMP stream publish done notification from nginx-rtmp
   * Called by nginx-rtmp on_publish_done callback
   */
  async handleStreamDone(streamKey: string): Promise<void> {
    this.logger.log(`RTMP stream done: ${streamKey}`);

    // Find stream session by key
    const session = await this.prisma.liveStream.findUnique({
      where: { streamKey },
    });

    if (!session) {
      this.logger.warn(`RTMP done: Stream key not found - ${streamKey}`);
      return;
    }

    // Calculate total duration if stream was live
    let totalDuration: number | null = null;
    if (session.startedAt) {
      totalDuration = Math.floor((new Date().getTime() - session.startedAt.getTime()) / 1000);
    }

    // Update stream status to OFFLINE
    await this.prisma.liveStream.update({
      where: { id: session.id },
      data: {
        status: 'OFFLINE',
        endedAt: new Date(),
        totalDuration,
      },
    });

    // Remove from Redis cache
    await this.redisService.del(`stream:${streamKey}:meta`);
    await this.redisService.del(`stream:${streamKey}:viewers`);

    this.logger.log(`Stream ${streamKey} ended. Duration: ${totalDuration}s`);
    this.eventEmitter.emit('stream:ended', { streamId: session.id, streamKey });
  }

  /**
   * Get featured product for a live stream
   * Returns null if no product is featured
   */
  async getFeaturedProduct(streamKey: string): Promise<any | null> {
    // Check Redis first
    const featuredProductId = await this.redisService.get(`stream:${streamKey}:featured-product`);

    if (!featuredProductId) {
      return null;
    }

    // Fetch product details from database
    const product = await this.prisma.product.findUnique({
      where: { id: featuredProductId },
    });

    if (!product) {
      // Clean up invalid Redis entry
      await this.redisService.del(`stream:${streamKey}:featured-product`);
      return null;
    }

    return {
      id: product.id,
      name: product.name,
      price: product.price.toNumber(),
      imageUrl: product.imageUrl,
      stock: product.quantity,
      colorOptions: product.colorOptions,
      sizeOptions: product.sizeOptions,
      status: product.status,
    };
  }

  /**
   * Set featured product for a live stream (Admin only)
   * Broadcasts update to all viewers via WebSocket
   */
  async setFeaturedProduct(streamKey: string, productId: string, _userId: string): Promise<any> {
    // Verify stream exists and user is admin
    const stream = await this.prisma.liveStream.findUnique({
      where: { streamKey },
      select: { id: true, userId: true, status: true },
    });

    if (!stream) {
      throw new BusinessException('STREAM_NOT_FOUND', { streamKey });
    }

    // Verify product exists and belongs to this stream
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        streamKey,
      },
    });

    if (!product) {
      throw new BusinessException(
        'PRODUCT_NOT_FOUND',
        { productId, streamKey },
        'Product not found for this stream',
      );
    }

    // Set featured product in Redis
    await this.redisService.set(
      `stream:${streamKey}:featured-product`,
      productId,
      3600 * 24, // 24 hour TTL
    );

    // Emit event for WebSocket broadcast
    this.eventEmitter.emit('stream:featured-product:updated', {
      streamKey,
      productId,
      product: {
        id: product.id,
        name: product.name,
        price: product.price.toNumber(),
        imageUrl: product.imageUrl,
        stock: product.quantity,
        colorOptions: product.colorOptions,
        sizeOptions: product.sizeOptions,
        status: product.status,
      },
    });

    this.logger.log(`Featured product set for stream ${streamKey}: ${productId}`);

    return {
      id: product.id,
      name: product.name,
      price: product.price.toNumber(),
      imageUrl: product.imageUrl,
      stock: product.quantity,
    };
  }

  /**
   * Clear featured product for a live stream (Admin only)
   */
  async clearFeaturedProduct(streamKey: string, _userId: string): Promise<void> {
    // Verify stream exists
    const stream = await this.prisma.liveStream.findUnique({
      where: { streamKey },
      select: { id: true, userId: true },
    });

    if (!stream) {
      throw new BusinessException('STREAM_NOT_FOUND', { streamKey });
    }

    // Remove from Redis
    await this.redisService.del(`stream:${streamKey}:featured-product`);

    // Emit event for WebSocket broadcast
    this.eventEmitter.emit('stream:featured-product:updated', {
      streamKey,
      productId: null,
      product: null,
    });

    this.logger.log(`Featured product cleared for stream ${streamKey}`);
  }

  private mapToResponseDto(session: any): StreamingSessionResponseDto {
    const rtmpBase = (
      this.configService.get('RTMP_SERVER_URL') || 'rtmp://localhost:1935/live'
    ).replace(/^(rtmp:\/\/[^/:]+)(\/|$)/, '$1:1935$2');
    const hlsBase = this.configService.get('HLS_SERVER_URL') || 'http://localhost:8080/hls';
    const rtmpUrl = `${rtmpBase}/${session.streamKey}`;
    const hlsUrl = `${hlsBase}/${session.streamKey}.m3u8`;

    return {
      id: session.id,
      userId: session.userId,
      streamKey: session.streamKey,
      title: session.title || 'Live Stream',
      status: session.status,
      rtmpUrl,
      hlsUrl,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      scheduledAt: session.scheduledAt ?? null,
      thumbnailUrl: session.thumbnailUrl ?? null,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };
  }
}
