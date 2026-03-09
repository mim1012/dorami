import { Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateReStreamTargetDto, UpdateReStreamTargetDto } from './dto/restream.dto';
import { ChildProcess, spawn } from 'child_process';

interface FFmpegProcess {
  process: ChildProcess;
  targetId: string;
  logId: string;
  restartCount: number;
  restartTimer?: ReturnType<typeof setTimeout>;
}

@Injectable()
export class ReStreamService implements OnModuleDestroy {
  private readonly logger = new Logger(ReStreamService.name);
  private readonly shuttingDownStreams = new Set<string>();

  /**
   * Map<liveStreamId, Map<targetId, FFmpegProcess>>
   */
  private readonly processes = new Map<string, Map<string, FFmpegProcess>>();

  private readonly MAX_RESTART_COUNT = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── CRUD ────────────────────────────────────────────

  async createTarget(userId: string, dto: CreateReStreamTargetDto) {
    const target = await this.prisma.reStreamTarget.create({
      data: {
        userId,
        platform: dto.platform,
        name: dto.name,
        rtmpUrl: dto.rtmpUrl,
        streamKey: dto.streamKey,
        enabled: dto.enabled ?? true,
        muteAudio: dto.muteAudio ?? false,
      },
    });
    return target;
  }

  async getTargets(userId: string) {
    return this.prisma.reStreamTarget.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTarget(id: string, dto: UpdateReStreamTargetDto) {
    const target = await this.prisma.reStreamTarget.findUnique({
      where: { id },
    });
    if (!target) {
      throw new NotFoundException('ReStream target not found');
    }

    return this.prisma.reStreamTarget.update({
      where: { id },
      data: dto,
    });
  }

  async deleteTarget(id: string) {
    const target = await this.prisma.reStreamTarget.findUnique({
      where: { id },
    });
    if (!target) {
      throw new NotFoundException('ReStream target not found');
    }

    return this.prisma.reStreamTarget.delete({ where: { id } });
  }

  async deleteTargets(ids: string[]) {
    const uniqIds = Array.from(new Set(ids.filter(Boolean)));
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

    const existingTargets = await this.prisma.reStreamTarget.findMany({
      where: { id: { in: uniqIds } },
      select: { id: true },
    });

    const existingIds = existingTargets.map((target) => target.id);
    const existingSet = new Set(existingIds);
    const skippedIds = uniqIds.filter((id) => !existingSet.has(id));

    if (existingIds.length > 0) {
      const stopJobs: Promise<void>[] = [];

      for (const targetId of existingIds) {
        for (const [liveStreamId, targetMap] of this.processes.entries()) {
          const runningProcess = targetMap.get(targetId);
          if (!runningProcess) {
            continue;
          }

          const stopJob = this.killFFmpegProcess(runningProcess, liveStreamId, targetId)
            .catch((error) => {
              this.logger.warn(
                `Failed to stop restream target ${targetId} while deleting for stream ${liveStreamId}: ${
                  (error as Error).message
                }`,
              );
            })
            .finally(() => {
              const mapAfter = this.processes.get(liveStreamId);
              mapAfter?.delete(targetId);
            });
          stopJobs.push(stopJob);
        }
      }

      await Promise.all(stopJobs);

      await this.prisma.reStreamTarget.deleteMany({
        where: { id: { in: existingIds } },
      });

      for (const [liveStreamId, targetMap] of this.processes.entries()) {
        if (targetMap.size === 0) {
          this.processes.delete(liveStreamId);
        }
      }
    }

    return {
      requestedCount,
      deletedCount: existingIds.length,
      skippedCount: skippedIds.length,
      deletedIds: existingIds,
      skippedIds,
    };
  }

  // ─── FFmpeg Process Management ────────────────────────

  async startRestreaming(liveStreamId: string, streamKey: string, userId: string) {
    const targets = await this.prisma.reStreamTarget.findMany({
      where: { userId, enabled: true },
    });

    if (targets.length === 0) {
      this.logger.log('No enabled restream targets found');
      return;
    }

    this.logger.log(`Starting restream for ${targets.length} targets (stream: ${streamKey})`);

    for (const target of targets) {
      await this.spawnFFmpegForTarget(liveStreamId, streamKey, target);
    }
  }

  async stopRestreaming(liveStreamId: string) {
    if (this.shuttingDownStreams.has(liveStreamId)) {
      return;
    }

    this.shuttingDownStreams.add(liveStreamId);

    const targetMap = this.processes.get(liveStreamId);
    if (!targetMap) {
      this.shuttingDownStreams.delete(liveStreamId);
      return;
    }

    this.logger.log(
      `Stopping all restreams for liveStream ${liveStreamId} (${targetMap.size} processes)`,
    );

    const stopOps = Array.from(targetMap.entries()).map(([targetId, ffmpegProc]) =>
      this.killFFmpegProcess(ffmpegProc, liveStreamId, targetId).catch((error) => {
        this.logger.error(
          `Failed to stop restream target ${targetId} for stream ${liveStreamId}: ${
            (error as Error).message
          }`,
        );
      }),
    );

    await Promise.all(stopOps);

    this.processes.delete(liveStreamId);
    this.shuttingDownStreams.delete(liveStreamId);
  }

  async manualStartTarget(liveStreamId: string, targetId: string) {
    // Find the live stream to get the streamKey
    const liveStream = await this.prisma.liveStream.findUnique({
      where: { id: liveStreamId },
    });
    if (liveStream?.status !== 'LIVE') {
      throw new NotFoundException('Live stream not found or not active');
    }

    const target = await this.prisma.reStreamTarget.findUnique({
      where: { id: targetId },
    });
    if (!target) {
      throw new NotFoundException('ReStream target not found');
    }

    // Stop existing process if any
    const existing = this.processes.get(liveStreamId)?.get(targetId);
    if (existing) {
      await this.killFFmpegProcess(existing, liveStreamId, targetId);
    }

    await this.spawnFFmpegForTarget(liveStreamId, liveStream.streamKey, target);
  }

  async manualStopTarget(liveStreamId: string, targetId: string) {
    const targetMap = this.processes.get(liveStreamId);
    if (!targetMap) {
      return;
    }

    const ffmpegProc = targetMap.get(targetId);
    if (!ffmpegProc) {
      return;
    }

    await this.killFFmpegProcess(ffmpegProc, liveStreamId, targetId);
    targetMap.delete(targetId);

    if (targetMap.size === 0) {
      this.processes.delete(liveStreamId);
    }
  }

  async getStatus(liveStreamId: string) {
    const logs = await this.prisma.reStreamLog.findMany({
      where: { liveStreamId },
      include: { target: true },
      orderBy: { createdAt: 'desc' },
    });
    return logs;
  }

  // ─── Internal FFmpeg Helpers ──────────────────────────

  private async spawnFFmpegForTarget(
    liveStreamId: string,
    streamKey: string,
    target: { id: string; rtmpUrl: string; streamKey: string; name: string; muteAudio: boolean },
    restartCount = 0,
  ) {
    const existingMap = this.processes.get(liveStreamId);
    const existingProc = existingMap?.get(target.id);
    if (existingProc) {
      await this.killFFmpegProcess(existingProc, liveStreamId, target.id);
    }

    const rtmpInternalUrl =
      this.configService.get<string>('RTMP_INTERNAL_URL') ?? 'rtmp://srs:1935/live';

    const inputUrl = `${rtmpInternalUrl}/${streamKey}`;

    // Instagram/Facebook uses RTMPS (TLS). For RTMPS output FFmpeg needs the
    // stream key passed via -rtmp_playpath so TLS handshake completes correctly.
    // Plain RTMP targets keep the existing concatenated URL format.
    const isRtmps = target.rtmpUrl.startsWith('rtmps://');
    // RTMPS: append stream key directly to URL (librtmp -rtmp_playpath doesn't work with RTMPS)
    // RTMP: concatenate directly with stream key
    const outputUrl = `${target.rtmpUrl}${target.streamKey}`;

    // For plain RTMP only, extract numeric part and use -rtmp_playpath to avoid URL parameter truncation
    const rtmpsExtraArgs: string[] = isRtmps
      ? []
      : (() => {
          const streamKeyForPlaypath = target.streamKey.split('?')[0];
          return ['-rtmp_playpath', streamKeyForPlaypath, '-rtmp_live', 'live'];
        })();

    // Create log entry
    const log = await this.prisma.reStreamLog.create({
      data: {
        targetId: target.id,
        liveStreamId,
        status: 'CONNECTING',
        startedAt: new Date(),
      },
    });

    this.emitStatus(liveStreamId, target.id, 'CONNECTING', log.id);

    // muteAudio: drop audio track (-an), copy video only
    // normal: copy video + transcode audio to AAC (Instagram requires AAC 44100Hz)
    const args = [
      '-rw_timeout',
      '10000000', // 10s network timeout
      '-i',
      inputUrl,
      '-c:v',
      'copy',
      ...(target.muteAudio ? ['-an'] : ['-c:a', 'aac', '-ar', '44100', '-b:a', '128k', '-ac', '2']),
      '-f',
      'flv',
      ...rtmpsExtraArgs,
      outputUrl,
    ];

    this.logger.log(`Spawning FFmpeg for target "${target.name}": ffmpeg ${args.join(' ')}`);

    const ffmpegProcess = spawn('ffmpeg', args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    const proc: FFmpegProcess = {
      process: ffmpegProcess,
      targetId: target.id,
      logId: log.id,
      restartCount,
    };

    // Store process
    if (!this.processes.has(liveStreamId)) {
      this.processes.set(liveStreamId, new Map());
    }
    this.processes.get(liveStreamId)!.set(target.id, proc);

    // Monitor stderr for status detection
    let detectedActive = false;
    ffmpegProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();

      // Detect active streaming via FFmpeg progress output
      if (!detectedActive && /frame=\s*\d+|size=\s*\d+/.test(output)) {
        detectedActive = true;
        void this.onProcessActive(liveStreamId, target.id, log.id);
      }
    });

    ffmpegProcess.on('close', (code) => {
      void this.onProcessClose(code, liveStreamId, streamKey, target, proc);
    });

    ffmpegProcess.on('error', (err) => {
      this.logger.error(`FFmpeg process error for target "${target.name}": ${err.message}`);
    });
  }

  private async onProcessActive(liveStreamId: string, targetId: string, logId: string) {
    this.logger.log(`ReStream target ${targetId} is now ACTIVE (stream: ${liveStreamId})`);

    await this.prisma.reStreamLog
      .update({
        where: { id: logId },
        data: { status: 'ACTIVE' },
      })
      .catch(() => {});

    this.emitStatus(liveStreamId, targetId, 'ACTIVE', logId);
  }

  private async onProcessClose(
    code: number | null,
    liveStreamId: string,
    streamKey: string,
    target: { id: string; rtmpUrl: string; streamKey: string; name: string; muteAudio: boolean },
    proc: FFmpegProcess,
  ) {
    const isNormalExit = code === 0 || code === 255;
    const currentMap = this.processes.get(liveStreamId);
    const isStillTracked = currentMap?.get(target.id) === proc;

    if (this.shuttingDownStreams.has(liveStreamId)) {
      if (currentMap) {
        currentMap.delete(target.id);
        if (currentMap.size === 0) {
          this.processes.delete(liveStreamId);
        }
      }

      await this.prisma.reStreamLog
        .update({
          where: { id: proc.logId },
          data: {
            status: 'STOPPED',
            endedAt: new Date(),
          },
        })
        .catch(() => {});

      this.emitStatus(liveStreamId, target.id, 'STOPPED', proc.logId);
      return;
    }

    if (!isStillTracked) {
      // A newer process for the same target replaced this one.
      this.logger.log(`Old FFmpeg process for target "${target.name}" exited (code: ${code})`);

      await this.prisma.reStreamLog
        .update({
          where: { id: proc.logId },
          data: {
            status: 'STOPPED',
            endedAt: new Date(),
          },
        })
        .catch(() => {});

      this.emitStatus(liveStreamId, target.id, 'STOPPED', proc.logId);
      return;
    }

    if (isNormalExit) {
      // Normal exit
      this.logger.log(`FFmpeg for target "${target.name}" exited (code: ${code})`);

      await this.prisma.reStreamLog
        .update({
          where: { id: proc.logId },
          data: {
            status: 'STOPPED',
            endedAt: new Date(),
          },
        })
        .catch(() => {});

      this.emitStatus(liveStreamId, target.id, 'STOPPED', proc.logId);
      currentMap?.delete(target.id);
      if (currentMap?.size === 0) {
        this.processes.delete(liveStreamId);
      }
      return;
    }

    // Abnormal exit → try restart
    if (proc.restartCount < this.MAX_RESTART_COUNT) {
      proc.restartCount++;
      const delay = Math.pow(2, proc.restartCount) * 1000; // 2s, 4s, 8s

      this.logger.warn(
        `FFmpeg for target "${target.name}" crashed (code: ${code}). ` +
          `Restarting in ${delay}ms (attempt ${proc.restartCount}/${this.MAX_RESTART_COUNT})`,
      );

      await this.prisma.reStreamLog
        .update({
          where: { id: proc.logId },
          data: {
            status: 'FAILED',
            errorMessage: `Process exited with code ${code}`,
            restartCount: proc.restartCount,
          },
        })
        .catch(() => {});

      this.emitStatus(liveStreamId, target.id, 'FAILED', proc.logId);

      proc.restartTimer = setTimeout(() => {
        // Check if the stream is still live and target is still enabled before restarting
        void Promise.all([
          this.prisma.liveStream.findUnique({ where: { id: liveStreamId } }).catch(() => null),
          this.prisma.reStreamTarget
            .findUnique({ where: { id: target.id }, select: { enabled: true } })
            .catch(() => null),
        ])
          .then(([liveStream, freshTarget]) => {
            if (liveStream?.status === 'LIVE' && freshTarget?.enabled) {
              return this.spawnFFmpegForTarget(liveStreamId, streamKey, target, proc.restartCount);
            }
          })
          .catch(() => {});
      }, delay);
    } else {
      this.logger.error(`FFmpeg for target "${target.name}" exceeded max restart attempts`);

      await this.prisma.reStreamLog
        .update({
          where: { id: proc.logId },
          data: {
            status: 'FAILED',
            endedAt: new Date(),
            errorMessage: `Exceeded max restart attempts (code: ${code})`,
            restartCount: proc.restartCount,
          },
        })
        .catch(() => {});

      this.emitStatus(liveStreamId, target.id, 'FAILED', proc.logId);
      currentMap?.delete(target.id);
    }
  }

  private async killFFmpegProcess(
    ffmpegProc: FFmpegProcess,
    liveStreamId: string,
    targetId: string,
  ) {
    if (ffmpegProc.restartTimer) {
      clearTimeout(ffmpegProc.restartTimer);
    }

    const proc = ffmpegProc.process;
    if (proc.exitCode !== null) {
      return; // Already exited
    }

    // Try graceful SIGTERM first
    proc.kill('SIGTERM');

    // Force kill after 5 seconds
    const forceKillTimer = setTimeout(() => {
      if (proc.exitCode === null) {
        this.logger.warn(`Force killing FFmpeg process for target ${targetId}`);
        proc.kill('SIGKILL');
      }
    }, 5000);

    await new Promise<void>((resolve) => {
      proc.on('close', () => {
        clearTimeout(forceKillTimer);
        resolve();
      });
      // If already exited, resolve immediately
      if (proc.exitCode !== null) {
        clearTimeout(forceKillTimer);
        resolve();
      }
    });

    await this.prisma.reStreamLog
      .update({
        where: { id: ffmpegProc.logId },
        data: {
          status: 'STOPPED',
          endedAt: new Date(),
        },
      })
      .catch(() => {});

    this.emitStatus(liveStreamId, targetId, 'STOPPED', ffmpegProc.logId);
  }

  private emitStatus(liveStreamId: string, targetId: string, status: string, logId: string) {
    this.eventEmitter.emit('restream:status:updated', {
      liveStreamId,
      targetId,
      status,
      logId,
    });
  }

  // ─── Cleanup ──────────────────────────────────────────

  async onModuleDestroy() {
    this.logger.log('Cleaning up all FFmpeg processes...');
    for (const liveStreamId of this.processes.keys()) {
      this.shuttingDownStreams.add(liveStreamId);
    }

    for (const [liveStreamId, targetMap] of this.processes) {
      for (const [targetId, ffmpegProc] of targetMap) {
        await this.killFFmpegProcess(ffmpegProc, liveStreamId, targetId);
      }
    }

    this.processes.clear();
    this.shuttingDownStreams.clear();
  }
}
