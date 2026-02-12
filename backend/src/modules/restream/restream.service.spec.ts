import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException } from '@nestjs/common';
import { ReStreamService } from './restream.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ReStreamPlatformDto } from './dto/restream.dto';
import * as childProcess from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process.spawn
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

// Mock PrismaService to avoid @prisma/client binary initialization
jest.mock('../../common/prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

describe('ReStreamService', () => {
  let service: ReStreamService;
  let prismaService: PrismaService;
  let _configService: ConfigService;
  let eventEmitter: EventEmitter2;

  const mockTarget = {
    id: 'target-1',
    userId: 'user-admin',
    platform: 'YOUTUBE' as const,
    name: 'YouTube Channel',
    rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2/',
    streamKey: 'yt-stream-key-123',
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTarget2 = {
    ...mockTarget,
    id: 'target-2',
    platform: 'INSTAGRAM' as const,
    name: 'Instagram Live',
    rtmpUrl: 'rtmps://live-upload.instagram.com:443/rtmp/',
    streamKey: 'ig-stream-key-456',
  };

  const mockLog = {
    id: 'log-1',
    targetId: 'target-1',
    liveStreamId: 'stream-1',
    status: 'CONNECTING' as const,
    startedAt: new Date(),
    endedAt: null,
    errorMessage: null,
    restartCount: 0,
    createdAt: new Date(),
  };

  const mockLiveStream = {
    id: 'stream-1',
    streamKey: 'live-stream-key',
    userId: 'user-admin',
    status: 'LIVE' as const,
    title: 'Test Stream',
    startedAt: new Date(),
    endedAt: null,
    totalDuration: null,
    peakViewers: 0,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };

  /**
   * Creates a mock ChildProcess (EventEmitter) for spawn tests
   */
  function createMockProcess() {
    const proc = new EventEmitter() as any;
    proc.stdin = null;
    proc.stdout = null;
    proc.stderr = new EventEmitter();
    proc.exitCode = null;
    proc.kill = jest.fn((signal?: string) => {
      // Simulate async exit
      setTimeout(() => {
        proc.exitCode = signal === 'SIGKILL' ? 137 : 0;
        proc.emit('close', proc.exitCode);
      }, 10);
      return true;
    });
    return proc;
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReStreamService,
        {
          provide: PrismaService,
          useValue: {
            reStreamTarget: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            reStreamLog: {
              create: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            liveStream: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('rtmp://nginx-rtmp:1935/live'),
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

    service = module.get<ReStreamService>(ReStreamService);
    prismaService = module.get<PrismaService>(PrismaService);
    _configService = module.get<ConfigService>(ConfigService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  // ─── CRUD Tests ───────────────────────────────────────

  describe('createTarget', () => {
    it('should create a restream target with all fields', async () => {
      jest.spyOn(prismaService.reStreamTarget, 'create').mockResolvedValue(mockTarget as any);

      const result = await service.createTarget('user-admin', {
        platform: ReStreamPlatformDto.YOUTUBE,
        name: 'YouTube Channel',
        rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2/',
        streamKey: 'yt-stream-key-123',
        enabled: true,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('target-1');
      expect(result.platform).toBe('YOUTUBE');
      expect(result.name).toBe('YouTube Channel');
      expect(prismaService.reStreamTarget.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-admin',
          platform: ReStreamPlatformDto.YOUTUBE,
          name: 'YouTube Channel',
          rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2/',
          streamKey: 'yt-stream-key-123',
          enabled: true,
        },
      });
    });

    it('should default enabled to true when not provided', async () => {
      jest.spyOn(prismaService.reStreamTarget, 'create').mockResolvedValue(mockTarget as any);

      await service.createTarget('user-admin', {
        platform: ReStreamPlatformDto.YOUTUBE,
        name: 'YouTube Channel',
        rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2/',
        streamKey: 'yt-stream-key-123',
      });

      expect(prismaService.reStreamTarget.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ enabled: true }),
        }),
      );
    });
  });

  describe('getTargets', () => {
    it('should return targets for a user ordered by createdAt desc', async () => {
      jest
        .spyOn(prismaService.reStreamTarget, 'findMany')
        .mockResolvedValue([mockTarget, mockTarget2] as any);

      const result = await service.getTargets('user-admin');

      expect(result).toHaveLength(2);
      expect(prismaService.reStreamTarget.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-admin' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no targets exist', async () => {
      jest.spyOn(prismaService.reStreamTarget, 'findMany').mockResolvedValue([]);

      const result = await service.getTargets('user-admin');

      expect(result).toHaveLength(0);
    });
  });

  describe('updateTarget', () => {
    it('should update target fields', async () => {
      const updated = { ...mockTarget, name: 'Updated Name' };
      jest.spyOn(prismaService.reStreamTarget, 'findUnique').mockResolvedValue(mockTarget as any);
      jest.spyOn(prismaService.reStreamTarget, 'update').mockResolvedValue(updated as any);

      const result = await service.updateTarget('target-1', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(prismaService.reStreamTarget.update).toHaveBeenCalledWith({
        where: { id: 'target-1' },
        data: { name: 'Updated Name' },
      });
    });

    it('should throw NotFoundException when target not found', async () => {
      jest.spyOn(prismaService.reStreamTarget, 'findUnique').mockResolvedValue(null);

      await expect(service.updateTarget('invalid-id', { name: 'Updated' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update enabled to false (deactivate target)', async () => {
      const deactivated = { ...mockTarget, enabled: false };
      jest.spyOn(prismaService.reStreamTarget, 'findUnique').mockResolvedValue(mockTarget as any);
      jest.spyOn(prismaService.reStreamTarget, 'update').mockResolvedValue(deactivated as any);

      const result = await service.updateTarget('target-1', { enabled: false });

      expect(result.enabled).toBe(false);
    });
  });

  describe('deleteTarget', () => {
    it('should delete target', async () => {
      jest.spyOn(prismaService.reStreamTarget, 'findUnique').mockResolvedValue(mockTarget as any);
      jest.spyOn(prismaService.reStreamTarget, 'delete').mockResolvedValue(mockTarget as any);

      await service.deleteTarget('target-1');

      expect(prismaService.reStreamTarget.delete).toHaveBeenCalledWith({
        where: { id: 'target-1' },
      });
    });

    it('should throw NotFoundException when target not found', async () => {
      jest.spyOn(prismaService.reStreamTarget, 'findUnique').mockResolvedValue(null);

      await expect(service.deleteTarget('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── startRestreaming Tests ───────────────────────────

  describe('startRestreaming', () => {
    it('should spawn FFmpeg for each enabled target', async () => {
      jest.spyOn(prismaService.reStreamTarget, 'findMany').mockResolvedValue([mockTarget] as any);
      jest.spyOn(prismaService.reStreamLog, 'create').mockResolvedValue(mockLog as any);

      const mockProc = createMockProcess();
      (childProcess.spawn as jest.Mock).mockReturnValue(mockProc);

      await service.startRestreaming('stream-1', 'live-stream-key', 'user-admin');

      expect(prismaService.reStreamTarget.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-admin', enabled: true },
      });
      expect(childProcess.spawn).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining([
          '-i',
          'rtmp://nginx-rtmp:1935/live/live-stream-key',
          '-c',
          'copy',
          '-f',
          'flv',
          'rtmp://a.rtmp.youtube.com/live2/yt-stream-key-123',
        ]),
        expect.any(Object),
      );
      expect(prismaService.reStreamLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          targetId: 'target-1',
          liveStreamId: 'stream-1',
          status: 'CONNECTING',
        }),
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'restream:status:updated',
        expect.objectContaining({
          liveStreamId: 'stream-1',
          targetId: 'target-1',
          status: 'CONNECTING',
        }),
      );
    });

    it('should spawn FFmpeg for multiple enabled targets', async () => {
      jest
        .spyOn(prismaService.reStreamTarget, 'findMany')
        .mockResolvedValue([mockTarget, mockTarget2] as any);
      jest.spyOn(prismaService.reStreamLog, 'create').mockResolvedValue(mockLog as any);

      const mockProc = createMockProcess();
      (childProcess.spawn as jest.Mock).mockReturnValue(mockProc);

      await service.startRestreaming('stream-1', 'live-stream-key', 'user-admin');

      expect(childProcess.spawn).toHaveBeenCalledTimes(2);
    });

    it('should do nothing when no enabled targets found', async () => {
      jest.spyOn(prismaService.reStreamTarget, 'findMany').mockResolvedValue([]);

      await service.startRestreaming('stream-1', 'live-stream-key', 'user-admin');

      expect(childProcess.spawn).not.toHaveBeenCalled();
      expect(prismaService.reStreamLog.create).not.toHaveBeenCalled();
    });

    it('should emit CONNECTING status and create log entry', async () => {
      jest.spyOn(prismaService.reStreamTarget, 'findMany').mockResolvedValue([mockTarget] as any);
      jest.spyOn(prismaService.reStreamLog, 'create').mockResolvedValue(mockLog as any);

      const mockProc = createMockProcess();
      (childProcess.spawn as jest.Mock).mockReturnValue(mockProc);

      await service.startRestreaming('stream-1', 'live-stream-key', 'user-admin');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'restream:status:updated',
        expect.objectContaining({ status: 'CONNECTING' }),
      );
    });
  });

  // ─── FFmpeg stderr ACTIVE detection ───────────────────

  describe('FFmpeg status detection', () => {
    it('should transition to ACTIVE when FFmpeg outputs frame= data', async () => {
      jest.spyOn(prismaService.reStreamTarget, 'findMany').mockResolvedValue([mockTarget] as any);
      jest.spyOn(prismaService.reStreamLog, 'create').mockResolvedValue(mockLog as any);
      jest
        .spyOn(prismaService.reStreamLog, 'update')
        .mockResolvedValue({ ...mockLog, status: 'ACTIVE' } as any);

      const mockProc = createMockProcess();
      (childProcess.spawn as jest.Mock).mockReturnValue(mockProc);

      await service.startRestreaming('stream-1', 'live-stream-key', 'user-admin');

      // Simulate FFmpeg stderr output with frame data
      mockProc.stderr.emit('data', Buffer.from('frame=  100 fps=30 size=  512kB time=00:00:03.33'));

      // Wait for async handler
      await new Promise((r) => setTimeout(r, 50));

      expect(prismaService.reStreamLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: { status: 'ACTIVE' },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'restream:status:updated',
        expect.objectContaining({
          targetId: 'target-1',
          status: 'ACTIVE',
        }),
      );
    });

    it('should detect ACTIVE from size= output', async () => {
      jest.spyOn(prismaService.reStreamTarget, 'findMany').mockResolvedValue([mockTarget] as any);
      jest.spyOn(prismaService.reStreamLog, 'create').mockResolvedValue(mockLog as any);
      jest
        .spyOn(prismaService.reStreamLog, 'update')
        .mockResolvedValue({ ...mockLog, status: 'ACTIVE' } as any);

      const mockProc = createMockProcess();
      (childProcess.spawn as jest.Mock).mockReturnValue(mockProc);

      await service.startRestreaming('stream-1', 'live-stream-key', 'user-admin');

      mockProc.stderr.emit('data', Buffer.from('size=  1024kB time=00:00:10.00'));

      await new Promise((r) => setTimeout(r, 50));

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'restream:status:updated',
        expect.objectContaining({ status: 'ACTIVE' }),
      );
    });

    it('should only emit ACTIVE once even with multiple frame outputs', async () => {
      jest.spyOn(prismaService.reStreamTarget, 'findMany').mockResolvedValue([mockTarget] as any);
      jest.spyOn(prismaService.reStreamLog, 'create').mockResolvedValue(mockLog as any);
      jest
        .spyOn(prismaService.reStreamLog, 'update')
        .mockResolvedValue({ ...mockLog, status: 'ACTIVE' } as any);

      const mockProc = createMockProcess();
      (childProcess.spawn as jest.Mock).mockReturnValue(mockProc);

      await service.startRestreaming('stream-1', 'live-stream-key', 'user-admin');

      // Emit multiple frame outputs
      mockProc.stderr.emit('data', Buffer.from('frame=  100 fps=30'));
      mockProc.stderr.emit('data', Buffer.from('frame=  200 fps=30'));
      mockProc.stderr.emit('data', Buffer.from('frame=  300 fps=30'));

      await new Promise((r) => setTimeout(r, 50));

      const activeCalls = (eventEmitter.emit as jest.Mock).mock.calls.filter(
        (call) => call[0] === 'restream:status:updated' && call[1].status === 'ACTIVE',
      );
      expect(activeCalls).toHaveLength(1);
    });
  });

  // ─── stopRestreaming Tests ────────────────────────────

  describe('stopRestreaming', () => {
    it('should kill all FFmpeg processes for a stream', async () => {
      jest.spyOn(prismaService.reStreamTarget, 'findMany').mockResolvedValue([mockTarget] as any);
      jest.spyOn(prismaService.reStreamLog, 'create').mockResolvedValue(mockLog as any);
      jest.spyOn(prismaService.reStreamLog, 'update').mockResolvedValue(mockLog as any);

      const mockProc = createMockProcess();
      (childProcess.spawn as jest.Mock).mockReturnValue(mockProc);

      await service.startRestreaming('stream-1', 'live-stream-key', 'user-admin');
      await service.stopRestreaming('stream-1');

      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should do nothing when no processes exist for stream', async () => {
      // No processes spawned
      await service.stopRestreaming('nonexistent-stream');

      // Should not throw or call anything
      expect(prismaService.reStreamLog.update).not.toHaveBeenCalled();
    });

    it('should emit STOPPED status after killing process', async () => {
      jest.spyOn(prismaService.reStreamTarget, 'findMany').mockResolvedValue([mockTarget] as any);
      jest.spyOn(prismaService.reStreamLog, 'create').mockResolvedValue(mockLog as any);
      jest.spyOn(prismaService.reStreamLog, 'update').mockResolvedValue(mockLog as any);

      const mockProc = createMockProcess();
      (childProcess.spawn as jest.Mock).mockReturnValue(mockProc);

      await service.startRestreaming('stream-1', 'live-stream-key', 'user-admin');

      // Clear previous CONNECTING emit
      (eventEmitter.emit as jest.Mock).mockClear();

      await service.stopRestreaming('stream-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'restream:status:updated',
        expect.objectContaining({
          targetId: 'target-1',
          status: 'STOPPED',
        }),
      );
    });
  });

  // ─── manualStartTarget / manualStopTarget Tests ───────

  describe('manualStartTarget', () => {
    it('should start restream for a specific target', async () => {
      jest.spyOn(prismaService.liveStream, 'findUnique').mockResolvedValue(mockLiveStream as any);
      jest.spyOn(prismaService.reStreamTarget, 'findUnique').mockResolvedValue(mockTarget as any);
      jest.spyOn(prismaService.reStreamLog, 'create').mockResolvedValue(mockLog as any);

      const mockProc = createMockProcess();
      (childProcess.spawn as jest.Mock).mockReturnValue(mockProc);

      await service.manualStartTarget('stream-1', 'target-1');

      expect(childProcess.spawn).toHaveBeenCalledTimes(1);
      expect(prismaService.reStreamLog.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when stream is not LIVE', async () => {
      jest.spyOn(prismaService.liveStream, 'findUnique').mockResolvedValue({
        ...mockLiveStream,
        status: 'OFFLINE',
      } as any);

      await expect(service.manualStartTarget('stream-1', 'target-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when stream not found', async () => {
      jest.spyOn(prismaService.liveStream, 'findUnique').mockResolvedValue(null);

      await expect(service.manualStartTarget('invalid', 'target-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when target not found', async () => {
      jest.spyOn(prismaService.liveStream, 'findUnique').mockResolvedValue(mockLiveStream as any);
      jest.spyOn(prismaService.reStreamTarget, 'findUnique').mockResolvedValue(null);

      await expect(service.manualStartTarget('stream-1', 'invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('manualStopTarget', () => {
    it('should stop a specific target process', async () => {
      jest.spyOn(prismaService.reStreamTarget, 'findMany').mockResolvedValue([mockTarget] as any);
      jest.spyOn(prismaService.reStreamLog, 'create').mockResolvedValue(mockLog as any);
      jest.spyOn(prismaService.reStreamLog, 'update').mockResolvedValue(mockLog as any);

      const mockProc = createMockProcess();
      (childProcess.spawn as jest.Mock).mockReturnValue(mockProc);

      await service.startRestreaming('stream-1', 'live-stream-key', 'user-admin');
      await service.manualStopTarget('stream-1', 'target-1');

      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should do nothing when no process exists for target', async () => {
      await service.manualStopTarget('stream-1', 'target-1');

      expect(prismaService.reStreamLog.update).not.toHaveBeenCalled();
    });
  });

  // ─── Auto Restart Tests ───────────────────────────────

  describe('Auto restart on failure', () => {
    it('should emit FAILED status on abnormal exit', async () => {
      jest.useFakeTimers();
      jest.spyOn(prismaService.reStreamTarget, 'findMany').mockResolvedValue([mockTarget] as any);
      jest.spyOn(prismaService.reStreamLog, 'create').mockResolvedValue(mockLog as any);
      jest.spyOn(prismaService.reStreamLog, 'update').mockResolvedValue(mockLog as any);
      jest.spyOn(prismaService.liveStream, 'findUnique').mockResolvedValue(mockLiveStream as any);

      const mockProc = createMockProcess();
      // Override kill to not auto-close (we'll manually trigger close)
      mockProc.kill = jest.fn().mockReturnValue(true);
      (childProcess.spawn as jest.Mock).mockReturnValue(mockProc);

      await service.startRestreaming('stream-1', 'live-stream-key', 'user-admin');

      // Clear previous emit calls
      (eventEmitter.emit as jest.Mock).mockClear();

      // Simulate abnormal exit (code 1)
      mockProc.exitCode = 1;
      mockProc.emit('close', 1);

      // Wait for async handlers
      await Promise.resolve();
      await Promise.resolve();

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'restream:status:updated',
        expect.objectContaining({ status: 'FAILED' }),
      );
      expect(prismaService.reStreamLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          restartCount: 1,
          errorMessage: expect.stringContaining('code 1'),
        }),
      });
    });

    it('should not restart on normal exit (code 0)', async () => {
      jest.spyOn(prismaService.reStreamTarget, 'findMany').mockResolvedValue([mockTarget] as any);
      jest.spyOn(prismaService.reStreamLog, 'create').mockResolvedValue(mockLog as any);
      jest.spyOn(prismaService.reStreamLog, 'update').mockResolvedValue(mockLog as any);

      const mockProc = createMockProcess();
      mockProc.kill = jest.fn().mockReturnValue(true);
      (childProcess.spawn as jest.Mock).mockReturnValue(mockProc);

      await service.startRestreaming('stream-1', 'live-stream-key', 'user-admin');

      (eventEmitter.emit as jest.Mock).mockClear();

      // Normal exit
      mockProc.exitCode = 0;
      mockProc.emit('close', 0);

      await Promise.resolve();
      await Promise.resolve();

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'restream:status:updated',
        expect.objectContaining({ status: 'STOPPED' }),
      );
    });
  });

  // ─── getStatus Tests ──────────────────────────────────

  describe('getStatus', () => {
    it('should return restream logs with target info', async () => {
      const logWithTarget = { ...mockLog, target: mockTarget };
      jest.spyOn(prismaService.reStreamLog, 'findMany').mockResolvedValue([logWithTarget] as any);

      const result = await service.getStatus('stream-1');

      expect(result).toHaveLength(1);
      expect(result[0].target).toBeDefined();
      expect(prismaService.reStreamLog.findMany).toHaveBeenCalledWith({
        where: { liveStreamId: 'stream-1' },
        include: { target: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no logs exist', async () => {
      jest.spyOn(prismaService.reStreamLog, 'findMany').mockResolvedValue([]);

      const result = await service.getStatus('stream-1');

      expect(result).toHaveLength(0);
    });
  });

  // ─── onModuleDestroy Tests ────────────────────────────

  describe('onModuleDestroy', () => {
    it('should kill all running FFmpeg processes on shutdown', async () => {
      jest.spyOn(prismaService.reStreamTarget, 'findMany').mockResolvedValue([mockTarget] as any);
      jest.spyOn(prismaService.reStreamLog, 'create').mockResolvedValue(mockLog as any);
      jest.spyOn(prismaService.reStreamLog, 'update').mockResolvedValue(mockLog as any);

      const mockProc = createMockProcess();
      (childProcess.spawn as jest.Mock).mockReturnValue(mockProc);

      await service.startRestreaming('stream-1', 'live-stream-key', 'user-admin');

      await service.onModuleDestroy();

      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should handle cleanup when no processes are running', async () => {
      // Should not throw
      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });
});
