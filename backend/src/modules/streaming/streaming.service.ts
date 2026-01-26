import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  StartStreamDto,
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
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

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
        { streamId: existingStream.id },
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

    // Store stream metadata in Redis for quick access
    await this.redisService.set(
      `stream:${session.id}`,
      JSON.stringify({
        userId: session.userId,
        streamKey: session.streamKey,
        status: session.status,
      }),
      3600 * 24, // 24 hour TTL
    );

    this.eventEmitter.emit('stream:created', { streamId: session.id });

    return this.mapToResponseDto(session);
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

    const updatedSession = await this.prisma.liveStream.update({
      where: { id: streamId },
      data: {
        status: 'LIVE',
        startedAt: new Date(),
      },
    });

    // Update Redis cache
    await this.redisService.set(
      `stream:${streamId}`,
      JSON.stringify({
        ...session,
        status: 'LIVE',
        startedAt: updatedSession.startedAt,
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

    // Remove from Redis
    await this.redisService.del(`stream:${streamId}`);

    this.eventEmitter.emit('stream:ended', { streamId: session.id });
  }

  async getStreamStatus(streamId: string): Promise<StreamingSessionResponseDto> {
    // Try Redis cache first
    const cached = await this.redisService.get(`stream:${streamId}`);
    if (cached) {
      const data = JSON.parse(cached);
      return this.mapToResponseDto({ id: streamId, ...data } as any);
    }

    // Fallback to database
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
        { streamId: existingStream.id },
        'You already have an active streaming session',
      );
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
        expiresAt,
        status: 'PENDING',
      },
    });

    // Store stream metadata in Redis for quick access
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

    // Initialize viewer count to 0
    await this.redisService.set(`stream:${session.streamKey}:viewers`, '0', 3600 * 24);

    this.eventEmitter.emit('stream:created', { streamId: session.id, streamKey: session.streamKey });

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
    const { page = 1, limit = 20, userId, dateFrom, dateTo } = query;

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
    // Increment or decrement viewer count
    const key = `stream:${streamKey}:viewers`;

    if (delta > 0) {
      await this.redisService.getClient().incr(key);
    } else if (delta < 0) {
      const current = await this.redisService.get(key);
      const currentCount = current ? parseInt(current, 10) : 0;
      if (currentCount > 0) {
        await this.redisService.getClient().decr(key);
      }
    }

    const viewerCountStr = await this.redisService.get(key);
    const viewerCount = viewerCountStr ? parseInt(viewerCountStr, 10) : 0;

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

  private mapToResponseDto(session: any): StreamingSessionResponseDto {
    const rtmpUrl = `${this.configService.get('RTMP_SERVER_URL')}/${session.streamKey}`;
    const hlsUrl = `${this.configService.get('HLS_SERVER_URL')}/${session.streamKey}/index.m3u8`;

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
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };
  }
}
