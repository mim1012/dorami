import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StreamingService } from './streaming.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { BusinessException } from '../../common/exceptions/business.exception';

describe('StreamingService', () => {
  let service: StreamingService;

  const mockPrisma = {
    liveStream: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockRedisClient = {
    incr: jest.fn(),
    decr: jest.fn(),
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    getClient: jest.fn().mockReturnValue(mockRedisClient),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        RTMP_SERVER_URL: 'rtmp://localhost:1935/live',
        HLS_SERVER_URL: 'http://localhost:8080/hls',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: ConfigService, useValue: mockConfig },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<StreamingService>(StreamingService);
    module.get<PrismaService>(PrismaService);
    module.get<RedisService>(RedisService);
    module.get<EventEmitter2>(EventEmitter2);

    jest.clearAllMocks();
  });

  describe('startStream', () => {
    const userId = 'user-123';
    const startStreamDto = { expiresAt: new Date(Date.now() + 3600000).toISOString() };

    it('should create a new stream session', async () => {
      mockPrisma.liveStream.findFirst.mockResolvedValue(null);
      mockPrisma.liveStream.create.mockResolvedValue({
        id: 'stream-1',
        userId,
        streamKey: 'abc123',
        title: 'Live Stream',
        status: 'PENDING',
        expiresAt: new Date(startStreamDto.expiresAt),
        startedAt: null,
        endedAt: null,
        createdAt: new Date(),
      });
      mockRedis.set.mockResolvedValue(undefined);

      const result = await service.startStream(userId, startStreamDto);

      expect(result.id).toBe('stream-1');
      expect(result.status).toBe('PENDING');
      expect(result.rtmpUrl).toContain('rtmp://');
      expect(result.hlsUrl).toContain('/index.m3u8');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('stream:created', expect.any(Object));
    });

    it('should throw if user already has an active stream', async () => {
      mockPrisma.liveStream.findFirst.mockResolvedValue({
        id: 'existing-stream',
        streamKey: 'existing-key',
      });

      await expect(service.startStream(userId, startStreamDto)).rejects.toThrow(BusinessException);
    });
  });

  describe('goLive', () => {
    it('should transition stream from PENDING to LIVE', async () => {
      const session = {
        id: 'stream-1',
        userId: 'user-123',
        streamKey: 'abc123',
        status: 'PENDING',
      };

      mockPrisma.liveStream.findFirst.mockResolvedValue(session);
      mockPrisma.liveStream.update.mockResolvedValue({
        ...session,
        status: 'LIVE',
        startedAt: new Date(),
      });
      mockRedis.set.mockResolvedValue(undefined);

      const result = await service.goLive('stream-1', 'user-123');

      expect(result.status).toBe('LIVE');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('stream:started', expect.any(Object));
    });

    it('should throw if stream not found', async () => {
      mockPrisma.liveStream.findFirst.mockResolvedValue(null);

      await expect(service.goLive('nonexistent', 'user-123')).rejects.toThrow(BusinessException);
    });
  });

  describe('stopStream', () => {
    it('should stop stream and set status to OFFLINE', async () => {
      const session = { id: 'stream-1', userId: 'user-123', streamKey: 'abc123' };
      mockPrisma.liveStream.findFirst.mockResolvedValue(session);
      mockPrisma.liveStream.update.mockResolvedValue({ ...session, status: 'OFFLINE' });
      mockRedis.del.mockResolvedValue(undefined);

      await service.stopStream('stream-1', 'user-123');

      expect(mockPrisma.liveStream.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'OFFLINE' }),
        }),
      );
      expect(mockRedis.del).toHaveBeenCalledWith('stream:stream-1');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('stream:ended', expect.any(Object));
    });

    it('should throw if stream not found', async () => {
      mockPrisma.liveStream.findFirst.mockResolvedValue(null);

      await expect(service.stopStream('nonexistent', 'user-123')).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('getStreamStatus', () => {
    it('should return cached status from Redis', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ userId: 'user-123', streamKey: 'abc123', status: 'LIVE' }),
      );

      const result = await service.getStreamStatus('stream-1');

      expect(result.status).toBe('LIVE');
      expect(mockPrisma.liveStream.findUnique).not.toHaveBeenCalled();
    });

    it('should fallback to DB when Redis misses', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.liveStream.findUnique.mockResolvedValue({
        id: 'stream-1',
        userId: 'user-123',
        streamKey: 'abc123',
        status: 'LIVE',
      });

      const result = await service.getStreamStatus('stream-1');

      expect(result.status).toBe('LIVE');
      expect(mockPrisma.liveStream.findUnique).toHaveBeenCalled();
    });

    it('should throw if stream not found anywhere', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.liveStream.findUnique.mockResolvedValue(null);

      await expect(service.getStreamStatus('nonexistent')).rejects.toThrow(BusinessException);
    });
  });

  describe('authenticateStream', () => {
    const streamKey = 'valid-key';

    it('should authenticate valid PENDING stream and set to LIVE', async () => {
      mockPrisma.liveStream.findUnique.mockResolvedValue({
        id: 'stream-1',
        userId: 'user-123',
        streamKey,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 3600000),
      });
      mockPrisma.liveStream.update.mockResolvedValue({ status: 'LIVE' });
      mockRedis.set.mockResolvedValue(undefined);

      const result = await service.authenticateStream(streamKey);

      expect(result).toBe(true);
      expect(mockPrisma.liveStream.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'LIVE' }),
        }),
      );
    });

    it('should reject unknown stream key', async () => {
      mockPrisma.liveStream.findUnique.mockResolvedValue(null);

      const result = await service.authenticateStream('unknown-key');

      expect(result).toBe(false);
    });

    it('should reject non-PENDING stream', async () => {
      mockPrisma.liveStream.findUnique.mockResolvedValue({
        id: 'stream-1',
        streamKey,
        status: 'OFFLINE',
      });

      const result = await service.authenticateStream(streamKey);

      expect(result).toBe(false);
    });

    it('should reject expired stream key', async () => {
      mockPrisma.liveStream.findUnique.mockResolvedValue({
        id: 'stream-1',
        streamKey,
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1000), // expired
      });

      const result = await service.authenticateStream(streamKey);

      expect(result).toBe(false);
    });
  });

  describe('handleStreamDone', () => {
    it('should set stream to OFFLINE and calculate duration', async () => {
      const startedAt = new Date(Date.now() - 60000); // 60 seconds ago
      mockPrisma.liveStream.findUnique.mockResolvedValue({
        id: 'stream-1',
        streamKey: 'key-1',
        startedAt,
      });
      mockPrisma.liveStream.update.mockResolvedValue({});
      mockRedis.del.mockResolvedValue(undefined);

      await service.handleStreamDone('key-1');

      expect(mockPrisma.liveStream.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'OFFLINE',
            endedAt: expect.any(Date),
            totalDuration: expect.any(Number),
          }),
        }),
      );
      expect(mockRedis.del).toHaveBeenCalledWith('stream:key-1:meta');
      expect(mockRedis.del).toHaveBeenCalledWith('stream:key-1:viewers');
    });

    it('should gracefully handle unknown stream key', async () => {
      mockPrisma.liveStream.findUnique.mockResolvedValue(null);

      await expect(service.handleStreamDone('unknown-key')).resolves.not.toThrow();
    });
  });

  describe('updateViewerCount', () => {
    it('should increment viewer count', async () => {
      mockRedisClient.incr.mockResolvedValue(5);
      mockRedis.get.mockResolvedValue('5');
      mockPrisma.liveStream.findUnique.mockResolvedValue({
        id: 'stream-1',
        peakViewers: 3,
      });
      mockPrisma.liveStream.update.mockResolvedValue({});

      const count = await service.updateViewerCount('key-1', 1);

      expect(count).toBe(5);
      expect(mockRedisClient.incr).toHaveBeenCalled();
      // Peak viewers should be updated (5 > 3)
      expect(mockPrisma.liveStream.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { peakViewers: 5 },
        }),
      );
    });

    it('should decrement viewer count but not below 0', async () => {
      mockRedis.get.mockResolvedValueOnce('0').mockResolvedValueOnce('0');
      mockPrisma.liveStream.findUnique.mockResolvedValue({
        id: 'stream-1',
        peakViewers: 5,
      });

      const count = await service.updateViewerCount('key-1', -1);

      expect(count).toBe(0);
      expect(mockRedisClient.decr).not.toHaveBeenCalled();
    });
  });

  describe('getUpcomingStreams', () => {
    it('should return upcoming PENDING streams', async () => {
      mockPrisma.liveStream.findMany.mockResolvedValue([
        {
          id: 'stream-1',
          title: 'Upcoming Stream',
          expiresAt: new Date(Date.now() + 3600000),
          user: { id: 'user-1', name: 'Streamer' },
        },
      ]);

      const result = await service.getUpcomingStreams(3);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Upcoming Stream');
      expect(result[0].isLive).toBe(false);
    });
  });

  describe('getActiveStreams', () => {
    it('should return all LIVE streams', async () => {
      mockPrisma.liveStream.findMany.mockResolvedValue([
        { id: 'stream-1', status: 'LIVE', streamKey: 'key-1' },
        { id: 'stream-2', status: 'LIVE', streamKey: 'key-2' },
      ]);

      const result = await service.getActiveStreams();

      expect(result).toHaveLength(2);
    });
  });

  describe('getLiveStatus', () => {
    it('should return live status when stream is active', async () => {
      mockPrisma.liveStream.findFirst.mockResolvedValue({
        id: 'stream-1',
        title: 'Live Now',
        streamKey: 'key-1',
        startedAt: new Date(Date.now() - 60000),
      });
      mockRedis.get.mockResolvedValue('42');

      const result = await service.getLiveStatus();

      expect(result.isLive).toBe(true);
      expect(result.viewerCount).toBe(42);
      expect(result.title).toBe('Live Now');
    });

    it('should return not live when no active stream', async () => {
      mockPrisma.liveStream.findFirst.mockResolvedValue(null);

      const result = await service.getLiveStatus();

      expect(result.isLive).toBe(false);
      expect(result.viewerCount).toBe(0);
    });
  });

  describe('setFeaturedProduct', () => {
    it('should set featured product for a stream', async () => {
      mockPrisma.liveStream.findUnique.mockResolvedValue({
        id: 'stream-1',
        userId: 'user-1',
        status: 'LIVE',
      });
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'product-1',
        name: 'Test Product',
        price: { toNumber: () => 29000 },
        imageUrl: '/img.png',
        quantity: 100,
        colorOptions: ['Red'],
        sizeOptions: ['M'],
        status: 'AVAILABLE',
      });
      mockRedis.set.mockResolvedValue(undefined);

      const result = await service.setFeaturedProduct('key-1', 'product-1', 'user-1');

      expect(result.id).toBe('product-1');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'stream:key-1:featured-product',
        'product-1',
        expect.any(Number),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'stream:featured-product:updated',
        expect.any(Object),
      );
    });

    it('should throw if stream not found', async () => {
      mockPrisma.liveStream.findUnique.mockResolvedValue(null);

      await expect(service.setFeaturedProduct('unknown', 'product-1', 'user-1')).rejects.toThrow(
        BusinessException,
      );
    });

    it('should throw if product not found for stream', async () => {
      mockPrisma.liveStream.findUnique.mockResolvedValue({ id: 'stream-1' });
      mockPrisma.product.findFirst.mockResolvedValue(null);

      await expect(service.setFeaturedProduct('key-1', 'nonexistent', 'user-1')).rejects.toThrow(
        BusinessException,
      );
    });
  });
});
