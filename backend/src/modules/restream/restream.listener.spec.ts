import { Test, TestingModule } from '@nestjs/testing';
import { ReStreamListener } from './restream.listener';
import { ReStreamService } from './restream.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('ReStreamListener', () => {
  let listener: ReStreamListener;
  let restreamService: ReStreamService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReStreamListener,
        {
          provide: ReStreamService,
          useValue: {
            startRestreaming: jest.fn(),
            stopRestreaming: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            liveStream: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    listener = module.get<ReStreamListener>(ReStreamListener);
    restreamService = module.get<ReStreamService>(ReStreamService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── stream:started event ──────────────────────────────

  describe('handleStreamStarted', () => {
    it('should call startRestreaming with correct params when stream starts', async () => {
      jest.spyOn(prismaService.liveStream, 'findUnique').mockResolvedValue({
        id: 'stream-1',
        userId: 'user-admin',
      } as any);

      await listener.handleStreamStarted({
        streamId: 'stream-1',
        streamKey: 'test-key',
      });

      expect(prismaService.liveStream.findUnique).toHaveBeenCalledWith({
        where: { id: 'stream-1' },
        select: { userId: true },
      });
      expect(restreamService.startRestreaming).toHaveBeenCalledWith(
        'stream-1',
        'test-key',
        'user-admin',
      );
    });

    it('should not call startRestreaming when live stream not found', async () => {
      jest.spyOn(prismaService.liveStream, 'findUnique').mockResolvedValue(null);

      await listener.handleStreamStarted({
        streamId: 'invalid-stream',
        streamKey: 'test-key',
      });

      expect(restreamService.startRestreaming).not.toHaveBeenCalled();
    });

    it('should catch and log errors without throwing', async () => {
      jest
        .spyOn(prismaService.liveStream, 'findUnique')
        .mockRejectedValue(new Error('DB connection error'));

      // Should not throw
      await expect(
        listener.handleStreamStarted({
          streamId: 'stream-1',
          streamKey: 'test-key',
        }),
      ).resolves.toBeUndefined();

      expect(restreamService.startRestreaming).not.toHaveBeenCalled();
    });

    it('should handle startRestreaming failure gracefully', async () => {
      jest.spyOn(prismaService.liveStream, 'findUnique').mockResolvedValue({
        id: 'stream-1',
        userId: 'user-admin',
      } as any);
      jest
        .spyOn(restreamService, 'startRestreaming')
        .mockRejectedValue(new Error('FFmpeg spawn failed'));

      // Should not throw
      await expect(
        listener.handleStreamStarted({
          streamId: 'stream-1',
          streamKey: 'test-key',
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ─── stream:ended event ────────────────────────────────

  describe('handleStreamEnded', () => {
    it('should call stopRestreaming when stream ends', async () => {
      await listener.handleStreamEnded({
        streamId: 'stream-1',
        streamKey: 'test-key',
      });

      expect(restreamService.stopRestreaming).toHaveBeenCalledWith('stream-1');
    });

    it('should catch and log errors without throwing', async () => {
      jest
        .spyOn(restreamService, 'stopRestreaming')
        .mockRejectedValue(new Error('Kill process failed'));

      // Should not throw
      await expect(
        listener.handleStreamEnded({
          streamId: 'stream-1',
          streamKey: 'test-key',
        }),
      ).resolves.toBeUndefined();
    });
  });
});
