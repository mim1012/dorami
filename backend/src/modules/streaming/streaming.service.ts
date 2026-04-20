import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, FreeShippingMode } from '@prisma/client';
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
import { StreamStatus } from '@live-commerce/shared-types';
import { randomBytes } from 'crypto';

@Injectable()
export class StreamingService implements OnModuleInit {
  private readonly logger = new Logger(StreamingService.name);
  private readonly pendingStreamDoneTimers = new Map<string, NodeJS.Timeout>();

  /**
   * On startup, clean up stale Redis stream metadata that wasn't properly
   * cleared (e.g., backend restarted while a stream was live, SRS webhook missed).
   */
  async onModuleInit(): Promise<void> {
    await this.cleanupStaleStreams();
  }

  /**
   * Every 5 minutes, reconcile stream state across Redis, DB, and SRS.
   *
   * Handles two stale scenarios:
   * 1. Redis says LIVE but DB does not → clean Redis keys
   * 2. DB says LIVE but SRS has no active stream → set DB to OFFLINE + clean Redis
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupStaleStreams(): Promise<void> {
    try {
      // --- Scenario 1: Stale Redis metadata ---
      const client = this.redisService.getClient();
      const metaKeys = await client.keys('stream:*:meta');

      for (const metaKey of metaKeys) {
        const raw = await client.get(metaKey);
        if (!raw) {
          continue;
        }

        const meta = JSON.parse(raw) as { status?: string; streamId?: string };
        if (meta.status !== 'LIVE') {
          continue;
        }

        const streamKey = metaKey.replace('stream:', '').replace(':meta', '');

        const dbStream = await this.prisma.liveStream.findFirst({
          where: { streamKey, status: StreamStatus.LIVE },
          select: { id: true },
        });

        if (!dbStream) {
          await client.del(
            `stream:${streamKey}:meta`,
            `stream:${streamKey}:viewers`,
            `stream:${streamKey}:viewer_ids`,
          );
          this.logger.warn(
            `Cleaned up stale Redis cache for streamKey=${streamKey} (not LIVE in DB)`,
          );
        }
      }

      // --- Scenario 2: DB says LIVE but SRS has no active stream ---
      const dbLiveStreams = await this.prisma.liveStream.findMany({
        where: { status: StreamStatus.LIVE },
        select: { id: true, streamKey: true, startedAt: true },
      });

      if (dbLiveStreams.length === 0) {
        return;
      }

      // Fetch active streams from SRS
      const srsStreamKeys = await this.getSrsActiveStreamKeys();

      for (const stream of dbLiveStreams) {
        // Give streams 2 minutes grace period after startedAt before cleaning
        const startedMs = stream.startedAt?.getTime() ?? Date.now();
        if (Date.now() - startedMs < 2 * 60 * 1000) {
          continue;
        }

        if (!srsStreamKeys.has(stream.streamKey)) {
          // SRS has no active publisher for this stream → mark OFFLINE
          await this.prisma.liveStream.update({
            where: { id: stream.id },
            data: { status: StreamStatus.OFFLINE, endedAt: new Date() },
          });

          await client.del(
            `stream:${stream.streamKey}:meta`,
            `stream:${stream.streamKey}:viewers`,
            `stream:${stream.streamKey}:viewer_ids`,
          );

          this.eventEmitter.emit('stream:ended', { streamId: stream.id });

          this.logger.warn(
            `Cleaned up stale DB stream id=${stream.id} streamKey=${stream.streamKey} (not active in SRS)`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup stale streams: ${(error as Error).message}`);
    }
  }

  /**
   * Query SRS API for currently active (publishing) stream keys.
   * Returns an empty set if SRS is unreachable.
   */
  private async getSrsActiveStreamKeys(): Promise<Set<string>> {
    try {
      const srsApiUrl = this.configService.get('SRS_API_URL') ?? 'http://localhost:1985';
      const response = await fetch(`${srsApiUrl}/api/v1/streams`);
      if (!response.ok) {
        return new Set();
      }

      const data = (await response.json()) as {
        streams?: { name?: string; publish?: { active?: boolean } }[];
      };

      const keys = new Set<string>();
      for (const stream of data.streams ?? []) {
        if (stream.name && stream.publish?.active !== false) {
          // SRS stream name format: "live/{streamKey}" → extract streamKey
          const name = stream.name.replace(/^live\//, '');
          keys.add(name);
        }
      }
      return keys;
    } catch {
      this.logger.warn('SRS API unreachable — skipping DB→SRS reconciliation');
      return new Set();
    }
  }

  private getStreamOwnershipWhere(streamId: string, userId: string, userRole?: string) {
    return userRole === 'ADMIN'
      ? { id: streamId }
      : {
          id: streamId,
          userId,
        };
  }

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  private getStreamDoneGraceMs(): number {
    const raw = this.configService.get<string>('STREAM_DONE_GRACE_MS');
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
    return 45_000;
  }

  private clearPendingStreamDone(streamKey: string, reason: string): void {
    const pending = this.pendingStreamDoneTimers.get(streamKey);
    if (!pending) {
      return;
    }
    clearTimeout(pending);
    this.pendingStreamDoneTimers.delete(streamKey);
    this.logger.log(`Cancelled pending stream-offline timer for ${streamKey} (${reason})`);
  }

  private async markLiveStartAlertSent(streamId: string): Promise<boolean> {
    const key = `stream:${streamId}:live-start-alert-sent`;
    const ttlSeconds = 60 * 60 * 72;

    try {
      const result = await this.redisService.getClient().set(key, '1', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.error(
        `Failed to mark live-start alert dedupe key for streamId=${streamId}`,
        (error as Error).stack,
      );
      return false;
    }
  }

  /**
   * Get upcoming live streams for homepage
   * Returns streams with PENDING status ordered by scheduled time
   */
  async getUpcomingStreams(limit = 3): Promise<Record<string, unknown>[]> {
    try {
      const now = new Date();
      const streams = await this.prisma.liveStream.findMany({
        where: {
          OR: [
            { status: StreamStatus.LIVE },
            { status: StreamStatus.PENDING, scheduledAt: { gte: now }, expiresAt: { gte: now } },
          ],
        },
        orderBy: [
          // LIVE 스트림 우선, 그 다음 scheduledAt 오름차순
          { status: 'asc' }, // LIVE < OFFLINE < PENDING (alphabetical) — 별도 정렬로 보완
          { scheduledAt: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'asc' },
        ],
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

      // LIVE 스트림을 맨 앞으로 정렬
      const sorted = [
        ...streams.filter((s) => s.status === StreamStatus.LIVE),
        ...streams.filter((s) => s.status !== StreamStatus.LIVE),
      ];

      return sorted.map((stream) => ({
        id: stream.id,
        streamKey: stream.streamKey,
        title: stream.title,
        description: stream.description ?? null,
        scheduledAt: stream.scheduledAt?.toISOString() ?? null,
        thumbnailUrl: stream.thumbnailUrl || null,
        isLive: stream.status === StreamStatus.LIVE,
        host: {
          id: stream.user.id,
          name: stream.user.name,
        },
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get upcoming streams: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new BusinessException(
        'FAILED_TO_GET_UPCOMING_STREAMS',
        {
          statusCode: 500,
          error: 'Internal Server Error',
        },
        `Failed to retrieve upcoming streams: ${(error as Error).message}`,
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
        status: { in: [StreamStatus.PENDING, StreamStatus.LIVE] },
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
        status: StreamStatus.PENDING,
      },
    });

    this.eventEmitter.emit('stream:created', { streamId: session.id });

    return this.mapToResponseDto(session);
  }

  async updateStream(
    streamId: string,
    userId: string,
    dto: UpdateStreamDto,
    userRole?: string,
  ): Promise<StreamingSessionResponseDto> {
    const session = await this.prisma.liveStream.findFirst({
      where: {
        id: streamId,
        ...(userRole !== 'ADMIN' ? { userId } : {}),
      },
    });

    if (!session) {
      throw new BusinessException('STREAM_NOT_FOUND', { streamId });
    }

    const data: {
      title?: string;
      expiresAt?: Date;
      scheduledAt?: Date | null;
      thumbnailUrl?: string | null;
      freeShippingMode?: FreeShippingMode;
      freeShippingThreshold?: number | null;
    } = {};
    if (dto.title !== undefined) {
      data.title = dto.title;
    }
    if (dto.expiresAt !== undefined) {
      data.expiresAt = new Date(dto.expiresAt);
    }
    if (dto.scheduledAt !== undefined) {
      data.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    }
    if (dto.thumbnailUrl !== undefined) {
      data.thumbnailUrl = dto.thumbnailUrl || null;
    }
    if (dto.freeShippingMode !== undefined) {
      data.freeShippingMode = dto.freeShippingMode;
    }
    if (dto.freeShippingThreshold !== undefined) {
      data.freeShippingThreshold = dto.freeShippingThreshold;
    }

    const updated = await this.prisma.liveStream.update({
      where: { id: streamId },
      data,
    });

    return this.mapToResponseDto(updated);
  }

  async cancelStream(streamId: string, userId: string, userRole?: string): Promise<void> {
    const session = await this.prisma.liveStream.findFirst({
      where: this.getStreamOwnershipWhere(streamId, userId, userRole),
    });

    if (!session) {
      throw new BusinessException('STREAM_NOT_FOUND', { streamId });
    }

    if (session.status !== StreamStatus.PENDING) {
      throw new BusinessException(
        'INVALID_STREAM_STATE',
        { currentStatus: session.status },
        `Only PENDING streams can be cancelled (current: ${session.status})`,
      );
    }

    await this.prisma.liveStream.update({
      where: { id: streamId },
      data: { status: StreamStatus.OFFLINE },
    });

    // Clean up Redis if any metadata was cached
    await this.redisService.del(`stream:${session.streamKey}:meta`);
    await this.redisService.del(`stream:${session.streamKey}:viewers`);

    this.logger.log(`Stream ${streamId} cancelled by user ${userId}`);
  }

  async deleteHistoryStreams(streamIds: string[]) {
    const uniqIds = Array.from(new Set(streamIds.filter(Boolean)));
    const requestedCount = uniqIds.length;
    if (requestedCount === 0) {
      return {
        requestedCount: 0,
        deletedCount: 0,
        skippedCount: 0,
        deletedIds: [],
        skippedIds: [],
      };
    }

    const streamsToDelete = await this.prisma.liveStream.findMany({
      where: {
        id: { in: uniqIds },
        status: { not: StreamStatus.LIVE },
      },
      select: {
        id: true,
        streamKey: true,
      },
    });

    const deletableIds = streamsToDelete.map((stream) => stream.id);
    const deletableSet = new Set(deletableIds);
    const skippedIds = uniqIds.filter((id) => !deletableSet.has(id));

    if (deletableIds.length > 0) {
      await this.prisma.liveStream.deleteMany({
        where: { id: { in: deletableIds } },
      });

      const redisKeys = streamsToDelete.flatMap((stream) => [
        `stream:${stream.streamKey}:meta`,
        `stream:${stream.streamKey}:viewers`,
      ]);
      await Promise.all(redisKeys.map((key) => this.redisService.del(key)));
    }

    return {
      requestedCount,
      deletedCount: deletableIds.length,
      skippedCount: skippedIds.length,
      deletedIds: deletableIds,
      skippedIds,
    };
  }

  async goLive(
    streamId: string,
    userId: string,
    userRole?: string,
  ): Promise<StreamingSessionResponseDto> {
    const session = await this.prisma.liveStream.findFirst({
      where: this.getStreamOwnershipWhere(streamId, userId, userRole),
    });

    if (!session) {
      throw new BusinessException('STREAM_NOT_FOUND', { streamId });
    }

    // Only PENDING streams can go live
    if (session.status !== StreamStatus.PENDING) {
      throw new BusinessException(
        'INVALID_STREAM_STATE',
        { currentStatus: session.status },
        `Stream must be in PENDING state to go live (current: ${session.status})`,
      );
    }

    const updatedSession = await this.prisma.liveStream.update({
      where: { id: streamId },
      data: {
        status: StreamStatus.LIVE,
        startedAt: new Date(),
      },
    });

    // Update Redis cache using streamKey-based key
    await this.redisService.set(
      `stream:${session.streamKey}:meta`,
      JSON.stringify({
        userId: session.userId,
        title: session.title,
        status: StreamStatus.LIVE,
        streamId: session.id,
        startedAt: updatedSession.startedAt?.toISOString(),
      }),
      3600 * 24,
    );

    return this.mapToResponseDto(updatedSession);
  }

  async stopStream(streamId: string, userId: string, userRole?: string): Promise<void> {
    const session = await this.prisma.liveStream.findFirst({
      where: this.getStreamOwnershipWhere(streamId, userId, userRole),
    });

    if (!session) {
      throw new BusinessException('STREAM_NOT_FOUND', { streamId });
    }

    await this.prisma.liveStream.update({
      where: { id: streamId },
      data: {
        status: StreamStatus.OFFLINE,
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
        status: StreamStatus.LIVE,
      },
      orderBy: { startedAt: 'desc' },
    });

    return sessions.map((s) => this.mapToResponseDto(s));
  }

  async getActiveStreamsPublic(): Promise<Record<string, unknown>[]> {
    const sessions = await this.prisma.liveStream.findMany({
      where: { status: { in: [StreamStatus.LIVE] } },
      orderBy: { startedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    return Promise.all(
      sessions.map(async (s) => {
        const normalizedStatus = s.status === StreamStatus.PENDING ? 'SCHEDULED' : s.status;
        const viewerCountStr = await this.redisService.get(`stream:${s.streamKey}:viewers`);
        const viewerCount = viewerCountStr ? parseInt(viewerCountStr, 10) : 0;
        return {
          id: s.id,
          streamKey: s.streamKey,
          title: s.title,
          description: s.description ?? null,
          viewerCount,
          thumbnailUrl: s.thumbnailUrl ?? null,
          startedAt: s.startedAt?.toISOString() ?? null,
          status: normalizedStatus,
          isLive: s.status === StreamStatus.LIVE,
          host: { id: s.user.id, name: s.user.name },
        };
      }),
    );
  }

  async generateKey(userId: string, dto: GenerateKeyDto): Promise<StreamingSessionResponseDto> {
    // Auto-clean expired PENDING streams for this user
    await this.prisma.liveStream.updateMany({
      where: {
        userId,
        status: StreamStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      data: { status: StreamStatus.OFFLINE },
    });

    // Check if user already has an active stream
    const existingStream = await this.prisma.liveStream.findFirst({
      where: {
        userId,
        status: { in: [StreamStatus.PENDING, StreamStatus.LIVE] },
      },
    });

    if (existingStream) {
      // If LIVE, block — can't create a new stream while broadcasting
      if (existingStream.status === StreamStatus.LIVE) {
        throw new BusinessException(
          'STREAM_ALREADY_ACTIVE',
          { streamId: existingStream.id },
          '현재 방송 중입니다. 방송을 종료한 후 다시 시도하세요.',
        );
      }

      // If PENDING, return the existing session so user can see their stream key
      this.logger.log(`Returning existing PENDING stream ${existingStream.id} for user ${userId}`);
      // Update title/scheduledAt/thumbnailUrl if new values were provided
      const pendingUpdates: Record<string, unknown> = {};
      if (dto.title && dto.title !== existingStream.title) {
        pendingUpdates.title = dto.title;
      }
      if (dto.description !== undefined) {
        pendingUpdates.description = dto.description?.trim() || null;
      }
      if (dto.scheduledAt !== undefined) {
        pendingUpdates.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
      }
      if (dto.thumbnailUrl !== undefined) {
        pendingUpdates.thumbnailUrl = dto.thumbnailUrl || null;
      }
      if (dto.freeShippingMode !== undefined) {
        pendingUpdates.freeShippingMode = dto.freeShippingMode;
      }
      if (dto.freeShippingThreshold !== undefined) {
        pendingUpdates.freeShippingThreshold = dto.freeShippingThreshold;
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
        title: dto.title ?? 'Live Stream',
        description: dto.description?.trim() || null,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        thumbnailUrl: dto.thumbnailUrl ?? null,
        freeShippingMode: dto.freeShippingMode ?? 'DISABLED',
        freeShippingThreshold: dto.freeShippingThreshold ?? null,
        expiresAt,
        status: StreamStatus.PENDING,
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
    let status: string = StreamStatus.OFFLINE;
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
        startedAt = session.startedAt ?? undefined;
      }
    }

    // Get viewer count from Redis
    const viewerCountStr = await this.redisService.get(`stream:${streamKey}:viewers`);
    const viewerCount = viewerCountStr ? parseInt(viewerCountStr, 10) : 0;

    return {
      status,
      viewerCount,
      startedAt: startedAt?.toISOString(),
      title,
    };
  }

  async getStreamHistory(query: StreamHistoryQueryDto): Promise<StreamHistoryResponseDto> {
    const { page = 1, limit = 20, userId, dateFrom, dateTo } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.LiveStreamWhereInput = {};

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

    const streamDtos: StreamHistoryItemDto[] = streams.map((stream) => {
      const connectionInfo = this.mapToResponseDto(stream);
      return {
        id: stream.id,
        streamKey: stream.streamKey,
        title: stream.title,
        userId: stream.userId,
        userName: stream.user.name,
        freeShippingMode: stream.freeShippingMode,
        freeShippingThreshold: stream.freeShippingThreshold
          ? Number(stream.freeShippingThreshold)
          : null,
        scheduledAt: stream.scheduledAt?.toISOString() ?? null,
        startedAt: stream.startedAt?.toISOString() ?? null,
        endedAt: stream.endedAt?.toISOString() ?? null,
        totalDuration: stream.totalDuration,
        peakViewers: stream.peakViewers,
        status: stream.status,
        rtmpUrl: connectionInfo.rtmpUrl,
        hlsUrl: connectionInfo.hlsUrl,
        rtmpPort: connectionInfo.rtmpPort,
      };
    });

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
        status: StreamStatus.LIVE,
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
      thumbnailUrl: liveStream.thumbnailUrl ?? null,
      startedAt: liveStream.startedAt?.toISOString() ?? null,
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

    // OBS reconnect may arrive after a brief network flap.
    // Cancel delayed offline transition if it was already scheduled.
    this.clearPendingStreamDone(streamKey, 'stream re-published');

    // Find stream session by key
    const session = await this.prisma.liveStream.findUnique({
      where: { streamKey },
    });

    if (!session) {
      this.logger.warn(`RTMP auth failed: Stream key not found - ${streamKey}`);
      return false;
    }

    // Check if stream is in valid state (PENDING or OFFLINE for reconnection)
    if (
      session.status !== StreamStatus.PENDING &&
      session.status !== StreamStatus.OFFLINE &&
      session.status !== StreamStatus.LIVE
    ) {
      this.logger.warn(
        `RTMP auth failed: Stream in invalid state - ${streamKey}, status: ${session.status}`,
      );
      return false;
    }

    // Check if stream key has expired.
    // Skip expiry check for LIVE streams — an active broadcast must not be
    // interrupted by key expiry on OBS reconnect.
    if (
      session.status !== StreamStatus.LIVE &&
      session.expiresAt &&
      new Date() > session.expiresAt
    ) {
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
        status: StreamStatus.LIVE,
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
        status: StreamStatus.LIVE,
        streamId: session.id,
        startedAt: new Date().toISOString(),
      }),
      3600 * 24,
    );

    this.logger.log(`RTMP auth successful: Stream ${streamKey} is now LIVE`);

    const shouldSendLiveStartAlert = await this.markLiveStartAlertSent(session.id);
    if (shouldSendLiveStartAlert) {
      this.eventEmitter.emit('stream:started', { streamId: session.id, streamKey });
    } else {
      this.logger.log(
        `Skipping duplicate live-start alert event for streamId=${session.id}, streamKey=${streamKey}`,
      );
    }

    return true;
  }

  /**
   * Handle RTMP stream publish done notification from nginx-rtmp
   * Called by nginx-rtmp on_publish_done callback
   */
  async handleStreamDone(streamKey: string): Promise<void> {
    this.logger.log(`RTMP stream done: ${streamKey}`);

    // Cancel an existing timer and reschedule from the latest unpublish event.
    this.clearPendingStreamDone(streamKey, 'rescheduled by new on_unpublish');
    const graceMs = this.getStreamDoneGraceMs();

    const timer = setTimeout(() => {
      (async () => {
        try {
          this.pendingStreamDoneTimers.delete(streamKey);

          // Find stream session by key
          const session = await this.prisma.liveStream.findUnique({
            where: { streamKey },
          });

          if (!session) {
            this.logger.warn(`RTMP done: Stream key not found - ${streamKey}`);
            return;
          }

          // Stream was already transitioned by another flow.
          if (session.status !== StreamStatus.LIVE) {
            this.logger.log(
              `Skipping delayed stream-offline for ${streamKey}; current status is ${session.status}`,
            );
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
              status: StreamStatus.OFFLINE,
              endedAt: new Date(),
              totalDuration,
            },
          });

          // Remove from Redis cache
          await this.redisService.del(`stream:${streamKey}:meta`);
          await this.redisService.del(`stream:${streamKey}:viewers`);

          this.logger.log(
            `Stream ${streamKey} ended after ${graceMs}ms grace. Duration: ${totalDuration}s`,
          );
          this.eventEmitter.emit('stream:ended', { streamId: session.id, streamKey });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Failed delayed stream-offline for ${streamKey}: ${message}`);
        }
      })().catch((err) => this.logger.error('Error in delayed stream done:', err));
    }, graceMs);

    this.pendingStreamDoneTimers.set(streamKey, timer);
    this.logger.log(`Scheduled delayed stream-offline in ${graceMs}ms for ${streamKey}`);
  }

  /**
   * Get featured product for a live stream
   * Returns null if no product is featured
   */
  async getFeaturedProduct(streamKey: string): Promise<Record<string, unknown> | null> {
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
  async setFeaturedProduct(
    streamKey: string,
    productId: string,
    _userId: string,
  ): Promise<Record<string, unknown>> {
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

  private mapToResponseDto(session: {
    id: string;
    userId: string;
    streamKey: string;
    title: string;
    description?: string | null;
    status: string;
    startedAt?: Date | null;
    endedAt?: Date | null;
    scheduledAt?: Date | null;
    thumbnailUrl?: string | null;
    expiresAt: Date;
    createdAt: Date;
  }): StreamingSessionResponseDto {
    const rtmpBase = this.configService
      .get<string>('RTMP_SERVER_URL')!
      .replace(/^(rtmp:\/\/[^/:]+)(\/|$)/, '$1:1935$2');
    const hlsBase = this.configService.get<string>('HLS_SERVER_URL')!;
    // RTMP URL: 스트림 키 제외 (OBS는 서버 URL과 스트림 키를 별도로 입력)
    const rtmpUrl = rtmpBase.endsWith('/') ? rtmpBase.slice(0, -1) : rtmpBase;
    const hlsUrl = `${hlsBase}/${session.streamKey}.m3u8`;
    const rtmpPortMatch = rtmpUrl.match(/rtmp:\/\/[^:/]+:(\d+)\//);
    const rtmpPort = rtmpPortMatch?.[1] ? parseInt(rtmpPortMatch[1], 10) : 1935;

    return {
      id: session.id,
      userId: session.userId,
      streamKey: session.streamKey,
      title: session.title ?? 'Live Stream',
      description: session.description ?? null,
      status: session.status,
      rtmpUrl,
      hlsUrl,
      rtmpPort,
      startedAt: session.startedAt?.toISOString() ?? undefined,
      endedAt: session.endedAt?.toISOString() ?? undefined,
      scheduledAt: session.scheduledAt?.toISOString() ?? null,
      thumbnailUrl: session.thumbnailUrl ?? null,
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
    };
  }
}
