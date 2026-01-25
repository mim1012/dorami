import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  StartStreamDto,
  StreamingSessionResponseDto,
} from './dto/streaming.dto';
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
    const streamKey = this.generateStreamKey();

    // Create streaming session
    const session = await this.prisma.liveStream.create({
      data: {
        userId,
        streamKey,
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

  private generateStreamKey(): string {
    return randomBytes(16).toString('hex');
  }

  private mapToResponseDto(session: any): StreamingSessionResponseDto {
    const rtmpUrl = `${this.configService.get('RTMP_SERVER_URL')}/${session.streamKey}`;
    const hlsUrl = `${this.configService.get('HLS_SERVER_URL')}/${session.streamKey}/index.m3u8`;

    return {
      id: session.id,
      userId: session.userId,
      streamKey: session.streamKey,
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
