import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StreamingService } from './streaming.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { BusinessException } from '../../common/exceptions/business.exception';

describe('StreamingService', () => {
  let service: StreamingService;
  let prismaService: PrismaService;
  let redisService: RedisService;
  let _configService: ConfigService;
  let eventEmitter: EventEmitter2;

  const mockStream = {
    id: 'stream-1',
    userId: 'user-1',
    streamKey: 'abc123',
    title: 'Live Stream',
    status: 'PENDING',
    startedAt: null,
    endedAt: null,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    totalDuration: null,
    peakViewers: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLiveStream = {
    ...mockStream,
    id: 'stream-2',
    status: 'LIVE',
    startedAt: new Date(Date.now() - 30 * 60 * 1000), // started 30 minutes ago
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamingService,
        {
          provide: PrismaService,
          useValue: {
            liveStream: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            product: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
            },
            pointBalance: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: RedisService,
          useValue: {
            set: jest.fn(),
            get: jest.fn(),
            del: jest.fn(),
            getClient: jest.fn().mockReturnValue({
              incr: jest.fn(),
              decr: jest.fn(),
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'RTMP_SERVER_URL') {
                return 'rtmp://localhost:1935/live';
              }
              if (key === 'HLS_SERVER_URL') {
                return 'http://localhost:8080/hls';
              }
              return null;
            }),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StreamingService>(StreamingService);
    prismaService = module.get<PrismaService>(PrismaService);
    redisService = module.get<RedisService>(RedisService);
    _configService = module.get<ConfigService>(ConfigService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startStream', () => {
    it('should create stream session and return session data', async () => {
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.liveStream, 'create').mockResolvedValue(mockStream as any);
      jest.spyOn(redisService, 'set').mockResolvedValue(undefined);

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const result = await service.startStream('user-1', { expiresAt });

      expect(result).toBeDefined();
      expect(result.id).toBe('stream-1');
      expect(result.streamKey).toBe('abc123');
      expect(result.rtmpUrl).toContain('rtmp://localhost:1935/live');
      expect(result.hlsUrl).toContain('http://localhost:8080/hls');
      expect(prismaService.liveStream.create).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('stream:created', { streamId: 'stream-1' });
    });

    it('should throw STREAM_ALREADY_ACTIVE when user has active stream', async () => {
      const existingStream = { ...mockStream, status: 'LIVE' };
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(existingStream as any);

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await expect(service.startStream('user-1', { expiresAt })).rejects.toThrow(BusinessException);
    });

    it('should throw STREAM_ALREADY_ACTIVE when user has pending stream', async () => {
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(mockStream as any);

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await expect(service.startStream('user-1', { expiresAt })).rejects.toThrow(BusinessException);
    });

    it('should emit stream:created event', async () => {
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.liveStream, 'create').mockResolvedValue(mockStream as any);

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await service.startStream('user-1', { expiresAt });

      expect(eventEmitter.emit).toHaveBeenCalledWith('stream:created', { streamId: 'stream-1' });
    });

    it('should continue even if Redis caching fails', async () => {
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.liveStream, 'create').mockResolvedValue(mockStream as any);
      jest.spyOn(redisService, 'set').mockRejectedValue(new Error('Redis error'));

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const result = await service.startStream('user-1', { expiresAt });

      expect(result).toBeDefined();
      expect(result.id).toBe('stream-1');
    });
  });

  describe('goLive', () => {
    it('should update stream to LIVE status', async () => {
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(mockStream as any);
      jest.spyOn(prismaService.liveStream, 'update').mockResolvedValue(mockLiveStream as any);
      jest.spyOn(redisService, 'set').mockResolvedValue(undefined);

      const result = await service.goLive('stream-1', 'user-1');

      expect(result.status).toBe('LIVE');
      expect(result.startedAt).toBeDefined();
      expect(prismaService.liveStream.update).toHaveBeenCalledWith({
        where: { id: 'stream-1' },
        data: {
          status: 'LIVE',
          startedAt: expect.any(Date),
        },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('stream:started', { streamId: 'stream-1' });
    });

    it('should throw STREAM_NOT_FOUND when stream not found', async () => {
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(null);

      await expect(service.goLive('invalid-stream', 'user-1')).rejects.toThrow(BusinessException);
    });

    it('should throw STREAM_NOT_FOUND when userId does not match', async () => {
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(null);

      await expect(service.goLive('stream-1', 'wrong-user')).rejects.toThrow(BusinessException);
    });

    it('should update Redis cache with streamKey-based key', async () => {
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(mockStream as any);
      jest.spyOn(prismaService.liveStream, 'update').mockResolvedValue(mockLiveStream as any);
      jest.spyOn(redisService, 'set').mockResolvedValue(undefined);

      await service.goLive('stream-1', 'user-1');

      expect(redisService.set).toHaveBeenCalledWith(
        'stream:abc123:meta',
        expect.stringContaining('LIVE'),
        3600 * 24,
      );
    });

    it('should throw INVALID_STREAM_STATE when stream is not PENDING', async () => {
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(mockLiveStream as any);

      await expect(service.goLive('stream-2', 'user-1')).rejects.toThrow(BusinessException);
    });
  });

  describe('stopStream', () => {
    it('should update stream to OFFLINE and remove Redis cache', async () => {
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(mockLiveStream as any);
      jest.spyOn(prismaService.liveStream, 'update').mockResolvedValue({
        ...mockLiveStream,
        status: 'OFFLINE',
        endedAt: new Date(),
      } as any);
      jest.spyOn(redisService, 'del').mockResolvedValue(undefined);

      await service.stopStream('stream-2', 'user-1');

      expect(prismaService.liveStream.update).toHaveBeenCalledWith({
        where: { id: 'stream-2' },
        data: {
          status: 'OFFLINE',
          endedAt: expect.any(Date),
        },
      });
      expect(redisService.del).toHaveBeenCalledWith('stream:abc123:meta');
      expect(redisService.del).toHaveBeenCalledWith('stream:abc123:viewers');
      expect(eventEmitter.emit).toHaveBeenCalledWith('stream:ended', { streamId: 'stream-2' });
    });

    it('should throw STREAM_NOT_FOUND when stream not found', async () => {
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(null);

      await expect(service.stopStream('invalid-stream', 'user-1')).rejects.toThrow(
        BusinessException,
      );
    });

    it('should throw STREAM_NOT_FOUND when userId does not match', async () => {
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(null);

      await expect(service.stopStream('stream-2', 'wrong-user')).rejects.toThrow(BusinessException);
    });
  });

  describe('getStreamStatus', () => {
    it('should query database directly for stream status', async () => {
      jest.spyOn(prismaService.liveStream, 'findUnique').mockResolvedValue(mockStream as any);

      const result = await service.getStreamStatus('stream-1');

      expect(result).toBeDefined();
      expect(result.streamKey).toBe('abc123');
      expect(prismaService.liveStream.findUnique).toHaveBeenCalledWith({
        where: { id: 'stream-1' },
      });
    });

    it('should fallback to database when Redis cache miss', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(null);
      jest.spyOn(prismaService.liveStream, 'findUnique').mockResolvedValue(mockStream as any);

      const result = await service.getStreamStatus('stream-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('stream-1');
      expect(prismaService.liveStream.findUnique).toHaveBeenCalledWith({
        where: { id: 'stream-1' },
      });
    });

    it('should fallback to database when Redis fails', async () => {
      jest.spyOn(redisService, 'get').mockRejectedValue(new Error('Redis error'));
      jest.spyOn(prismaService.liveStream, 'findUnique').mockResolvedValue(mockStream as any);

      const result = await service.getStreamStatus('stream-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('stream-1');
      expect(prismaService.liveStream.findUnique).toHaveBeenCalled();
    });

    it('should throw STREAM_NOT_FOUND when stream not found in database', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(null);
      jest.spyOn(prismaService.liveStream, 'findUnique').mockResolvedValue(null);

      await expect(service.getStreamStatus('invalid-stream')).rejects.toThrow(BusinessException);
    });
  });

  describe('getActiveStreams', () => {
    it('should return all LIVE streams', async () => {
      const liveStreams = [mockLiveStream, { ...mockLiveStream, id: 'stream-3' }];
      jest.spyOn(prismaService.liveStream, 'findMany').mockResolvedValue(liveStreams as any);

      const result = await service.getActiveStreams();

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('LIVE');
      expect(result[1].status).toBe('LIVE');
      expect(prismaService.liveStream.findMany).toHaveBeenCalledWith({
        where: { status: 'LIVE' },
        orderBy: { startedAt: 'desc' },
      });
    });

    it('should return empty array when no live streams', async () => {
      jest.spyOn(prismaService.liveStream, 'findMany').mockResolvedValue([]);

      const result = await service.getActiveStreams();

      expect(result).toHaveLength(0);
    });
  });

  describe('authenticateStream', () => {
    it('should return true for valid PENDING stream', async () => {
      jest.spyOn(prismaService.liveStream, 'findUnique').mockResolvedValue(mockStream as any);
      jest.spyOn(prismaService.liveStream, 'update').mockResolvedValue(mockLiveStream as any);
      jest.spyOn(redisService, 'set').mockResolvedValue(undefined);

      const result = await service.authenticateStream('abc123', '127.0.0.1');

      expect(result).toBe(true);
      expect(prismaService.liveStream.update).toHaveBeenCalledWith({
        where: { id: 'stream-1' },
        data: {
          status: 'LIVE',
          startedAt: expect.any(Date),
        },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('stream:started', {
        streamId: 'stream-1',
        streamKey: 'abc123',
      });
    });

    it('should return false when stream key not found', async () => {
      jest.spyOn(prismaService.liveStream, 'findUnique').mockResolvedValue(null);

      const result = await service.authenticateStream('invalid-key', '127.0.0.1');

      expect(result).toBe(false);
      expect(prismaService.liveStream.update).not.toHaveBeenCalled();
    });

    it('should return false when stream is in invalid state', async () => {
      jest
        .spyOn(prismaService.liveStream, 'findUnique')
        .mockResolvedValue({ ...mockStream, status: 'ENDED' } as any);

      const result = await service.authenticateStream('abc123', '127.0.0.1');

      expect(result).toBe(false);
      expect(prismaService.liveStream.update).not.toHaveBeenCalled();
    });

    it('should return false when stream key has expired', async () => {
      const expiredStream = {
        ...mockStream,
        expiresAt: new Date(Date.now() - 60 * 60 * 1000), // expired 1 hour ago
      };
      jest.spyOn(prismaService.liveStream, 'findUnique').mockResolvedValue(expiredStream as any);

      const result = await service.authenticateStream('abc123', '127.0.0.1');

      expect(result).toBe(false);
      expect(prismaService.liveStream.update).not.toHaveBeenCalled();
    });

    it('should update Redis cache on successful authentication', async () => {
      jest.spyOn(prismaService.liveStream, 'findUnique').mockResolvedValue(mockStream as any);
      jest.spyOn(prismaService.liveStream, 'update').mockResolvedValue(mockLiveStream as any);
      jest.spyOn(redisService, 'set').mockResolvedValue(undefined);

      await service.authenticateStream('abc123', '127.0.0.1');

      expect(redisService.set).toHaveBeenCalledWith(
        'stream:abc123:meta',
        expect.stringContaining('LIVE'),
        3600 * 24,
      );
    });
  });

  describe('handleStreamDone', () => {
    it('should update stream to OFFLINE and calculate duration', async () => {
      jest.spyOn(prismaService.liveStream, 'findUnique').mockResolvedValue(mockLiveStream as any);
      jest.spyOn(prismaService.liveStream, 'update').mockResolvedValue({
        ...mockLiveStream,
        status: 'OFFLINE',
        endedAt: new Date(),
        totalDuration: 1800,
      } as any);
      jest.spyOn(redisService, 'del').mockResolvedValue(undefined);

      await service.handleStreamDone('abc123');

      expect(prismaService.liveStream.update).toHaveBeenCalledWith({
        where: { id: 'stream-2' },
        data: {
          status: 'OFFLINE',
          endedAt: expect.any(Date),
          totalDuration: expect.any(Number),
        },
      });
      expect(redisService.del).toHaveBeenCalledWith('stream:abc123:meta');
      expect(redisService.del).toHaveBeenCalledWith('stream:abc123:viewers');
      expect(eventEmitter.emit).toHaveBeenCalledWith('stream:ended', {
        streamId: 'stream-2',
        streamKey: 'abc123',
      });
    });

    it('should handle stream with null startedAt', async () => {
      const streamWithoutStart = { ...mockStream, startedAt: null };
      jest
        .spyOn(prismaService.liveStream, 'findUnique')
        .mockResolvedValue(streamWithoutStart as any);
      jest.spyOn(prismaService.liveStream, 'update').mockResolvedValue({
        ...streamWithoutStart,
        status: 'OFFLINE',
        endedAt: new Date(),
        totalDuration: null,
      } as any);
      jest.spyOn(redisService, 'del').mockResolvedValue(undefined);

      await service.handleStreamDone('abc123');

      expect(prismaService.liveStream.update).toHaveBeenCalledWith({
        where: { id: 'stream-1' },
        data: {
          status: 'OFFLINE',
          endedAt: expect.any(Date),
          totalDuration: null,
        },
      });
    });

    it('should not throw when stream key not found', async () => {
      jest.spyOn(prismaService.liveStream, 'findUnique').mockResolvedValue(null);

      await expect(service.handleStreamDone('invalid-key')).resolves.toBeUndefined();
      expect(prismaService.liveStream.update).not.toHaveBeenCalled();
    });

    it('should clean Redis cache', async () => {
      jest.spyOn(prismaService.liveStream, 'findUnique').mockResolvedValue(mockLiveStream as any);
      jest.spyOn(prismaService.liveStream, 'update').mockResolvedValue({
        ...mockLiveStream,
        status: 'OFFLINE',
      } as any);
      jest.spyOn(redisService, 'del').mockResolvedValue(undefined);

      await service.handleStreamDone('abc123');

      expect(redisService.del).toHaveBeenCalledTimes(2);
      expect(redisService.del).toHaveBeenCalledWith('stream:abc123:meta');
      expect(redisService.del).toHaveBeenCalledWith('stream:abc123:viewers');
    });
  });

  describe('updateStream', () => {
    it('should update title of PENDING stream', async () => {
      const updated = { ...mockStream, title: '새 방송 제목' };
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(mockStream as any);
      jest.spyOn(prismaService.liveStream, 'update').mockResolvedValue(updated as any);

      const result = await service.updateStream('stream-1', 'user-1', { title: '새 방송 제목' });

      expect(result.title).toBe('새 방송 제목');
      expect(prismaService.liveStream.update).toHaveBeenCalledWith({
        where: { id: 'stream-1' },
        data: { title: '새 방송 제목' },
      });
    });

    it('should update expiresAt of PENDING stream', async () => {
      const newExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const updated = { ...mockStream, expiresAt: newExpiresAt };
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(mockStream as any);
      jest.spyOn(prismaService.liveStream, 'update').mockResolvedValue(updated as any);

      const result = await service.updateStream('stream-1', 'user-1', {
        expiresAt: newExpiresAt.toISOString(),
      });

      expect(result.expiresAt).toEqual(newExpiresAt);
      expect(prismaService.liveStream.update).toHaveBeenCalledWith({
        where: { id: 'stream-1' },
        data: { expiresAt: expect.any(Date) },
      });
    });

    it('should throw STREAM_NOT_FOUND when stream not found', async () => {
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(null);

      await expect(service.updateStream('invalid-id', 'user-1', { title: '제목' })).rejects.toThrow(
        BusinessException,
      );
    });

    it('should throw INVALID_STREAM_STATE when stream is LIVE', async () => {
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(mockLiveStream as any);

      await expect(service.updateStream('stream-2', 'user-1', { title: '제목' })).rejects.toThrow(
        BusinessException,
      );
    });

    it('should only update provided fields', async () => {
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(mockStream as any);
      jest.spyOn(prismaService.liveStream, 'update').mockResolvedValue(mockStream as any);

      await service.updateStream('stream-1', 'user-1', {});

      expect(prismaService.liveStream.update).toHaveBeenCalledWith({
        where: { id: 'stream-1' },
        data: {},
      });
    });
  });

  describe('cancelStream', () => {
    it('should cancel PENDING stream and set status to OFFLINE', async () => {
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(mockStream as any);
      jest.spyOn(prismaService.liveStream, 'update').mockResolvedValue({
        ...mockStream,
        status: 'OFFLINE',
      } as any);
      jest.spyOn(redisService, 'del').mockResolvedValue(undefined);

      await service.cancelStream('stream-1', 'user-1');

      expect(prismaService.liveStream.update).toHaveBeenCalledWith({
        where: { id: 'stream-1' },
        data: { status: 'OFFLINE' },
      });
      expect(redisService.del).toHaveBeenCalledWith('stream:abc123:meta');
      expect(redisService.del).toHaveBeenCalledWith('stream:abc123:viewers');
    });

    it('should throw STREAM_NOT_FOUND when stream not found', async () => {
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(null);

      await expect(service.cancelStream('invalid-id', 'user-1')).rejects.toThrow(BusinessException);
    });

    it('should throw INVALID_STREAM_STATE when stream is LIVE', async () => {
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(mockLiveStream as any);

      await expect(service.cancelStream('stream-2', 'user-1')).rejects.toThrow(BusinessException);
    });

    it('should throw STREAM_NOT_FOUND when userId does not match', async () => {
      jest.spyOn(prismaService.liveStream, 'findFirst').mockResolvedValue(null);

      await expect(service.cancelStream('stream-1', 'wrong-user')).rejects.toThrow(
        BusinessException,
      );
    });
  });

  // ── getFeaturedProduct smoke tests (FSM data integrity) ───────────────────────
  describe('getFeaturedProduct', () => {
    const mockProduct = {
      id: 'prod-1',
      name: '테스트 상품',
      price: { toNumber: () => 29900 },
      imageUrl: 'https://example.com/img.jpg',
      quantity: 10,
      colorOptions: ['빨강', '파랑'],
      sizeOptions: ['S', 'M', 'L'],
      status: 'AVAILABLE',
      streamKey: 'abc123',
    };

    it('should return null when no featured product in Redis', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(null);

      const result = await service.getFeaturedProduct('abc123');

      expect(result).toBeNull();
      expect(redisService.get).toHaveBeenCalledWith('stream:abc123:featured-product');
      expect(prismaService.product.findUnique).not.toHaveBeenCalled();
    });

    it('should return shaped product when Redis has valid product id', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue('prod-1');
      jest.spyOn(prismaService.product, 'findUnique').mockResolvedValue(mockProduct as any);

      const result = await service.getFeaturedProduct('abc123');

      expect(result).not.toBeNull();
      expect(result.id).toBe('prod-1');
      expect(result.name).toBe('테스트 상품');
      expect(result.price).toBe(29900);
      expect(result.stock).toBe(10);
      expect(result.status).toBe('AVAILABLE');
      expect(result.colorOptions).toEqual(['빨강', '파랑']);
    });

    it('should clean up stale Redis entry and return null when product deleted from DB', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue('prod-deleted');
      jest.spyOn(prismaService.product, 'findUnique').mockResolvedValue(null);
      jest.spyOn(redisService, 'del').mockResolvedValue(undefined);

      const result = await service.getFeaturedProduct('abc123');

      expect(result).toBeNull();
      // stale Redis key must be cleaned up — data integrity
      expect(redisService.del).toHaveBeenCalledWith('stream:abc123:featured-product');
    });

    it('should use correct Redis key format: stream:{streamKey}:featured-product', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(null);

      await service.getFeaturedProduct('my-stream-key');

      expect(redisService.get).toHaveBeenCalledWith('stream:my-stream-key:featured-product');
    });

    it('should return numeric price (not Decimal object) for FSM card rendering', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue('prod-1');
      jest.spyOn(prismaService.product, 'findUnique').mockResolvedValue(mockProduct as any);

      const result = await service.getFeaturedProduct('abc123');

      expect(typeof result.price).toBe('number');
      expect(result.price).toBe(29900);
    });
  });
});
