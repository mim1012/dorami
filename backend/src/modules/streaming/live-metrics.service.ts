import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import * as os from 'os';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SocketIoProvider } from '../websocket/socket-io.provider';
import { getPerformanceStats } from '../../common/monitoring/performance.interceptor';

interface MetricSnapshot {
  timestamp: Date;
  cpuUsagePercent: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  memoryUsagePercent: number;
  wsConnectionCount: number;
  httpRequests: number;
  avgResponseMs: number;
  slowRequests: number;
  errorRate: number;
}

interface LiveSession {
  streamId: string;
  streamKey?: string;
  startedAt: Date;
  intervalHandle: ReturnType<typeof setInterval>;
  snapshots: MetricSnapshot[];
}

@Injectable()
export class LiveMetricsService {
  private readonly logger = new Logger(LiveMetricsService.name);
  private readonly activeSessions = new Map<string, LiveSession>();
  private readonly COLLECT_INTERVAL_MS = 10 * 60 * 1000; // 10분

  constructor(
    private readonly prisma: PrismaService,
    private readonly socketIoProvider: SocketIoProvider,
    private readonly configService: ConfigService,
  ) {}

  @OnEvent('stream:started')
  handleStreamStarted(payload: { streamId: string; streamKey?: string }) {
    if (this.activeSessions.has(payload.streamId)) {
      return;
    }

    this.logger.log(`Metrics collection started for stream ${payload.streamId}`);

    const session: LiveSession = {
      streamId: payload.streamId,
      streamKey: payload.streamKey,
      startedAt: new Date(),
      intervalHandle: setInterval(
        () => void this.collectSnapshot(payload.streamId),
        this.COLLECT_INTERVAL_MS,
      ),
      snapshots: [],
    };

    this.activeSessions.set(payload.streamId, session);

    // 즉시 첫 스냅샷 수집
    void this.collectSnapshot(payload.streamId);
  }

  @OnEvent('stream:ended')
  async handleStreamEnded(payload: { streamId: string }) {
    const session = this.activeSessions.get(payload.streamId);
    if (!session) {
      return;
    }

    clearInterval(session.intervalHandle);

    // 마지막 스냅샷 수집
    this.collectSnapshot(payload.streamId);

    this.logger.log(
      `Stream ${payload.streamId} ended. ${session.snapshots.length} snapshots collected over ${this.formatDuration(session.startedAt, new Date())}`,
    );

    // 리포트 생성 및 전송
    await this.sendReport(session);

    this.activeSessions.delete(payload.streamId);
  }

  private collectSnapshot(streamId: string): void {
    const session = this.activeSessions.get(streamId);
    if (!session) {
      return;
    }

    try {
      const cpus = os.cpus();
      const cpuUsage =
        cpus.reduce((acc, cpu) => {
          const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
          const idle = cpu.times.idle;
          return acc + ((total - idle) / total) * 100;
        }, 0) / cpus.length;

      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;

      let wsCount = 0;
      try {
        wsCount = this.socketIoProvider.server.engine.clientsCount;
      } catch {
        // Socket.IO not yet initialized
      }

      const perfStats = getPerformanceStats();

      const snapshot: MetricSnapshot = {
        timestamp: new Date(),
        cpuUsagePercent: Math.round(cpuUsage * 10) / 10,
        memoryUsedMB: Math.round(usedMem / 1024 / 1024),
        memoryTotalMB: Math.round(totalMem / 1024 / 1024),
        memoryUsagePercent: Math.round((usedMem / totalMem) * 1000) / 10,
        wsConnectionCount: wsCount,
        httpRequests: perfStats.totalRequests,
        avgResponseMs: perfStats.averageDuration,
        slowRequests: perfStats.slowRequests,
        errorRate: perfStats.errorRate,
      };

      session.snapshots.push(snapshot);

      this.logger.debug(
        `[${streamId}] CPU: ${snapshot.cpuUsagePercent}% | Mem: ${snapshot.memoryUsagePercent}% | WS: ${wsCount} | Errors: ${snapshot.errorRate}%`,
      );
    } catch (error) {
      this.logger.error(`Failed to collect snapshot for ${streamId}`, (error as Error).message);
    }
  }

  private async sendReport(session: LiveSession): Promise<void> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    const chatId = this.configService.get<string>('TELEGRAM_CHAT_ID');

    if (!botToken || !chatId) {
      this.logger.warn('Telegram not configured — skipping report');
      return;
    }

    try {
      // DB에서 방송 정보 조회
      const stream = await this.prisma.liveStream.findUnique({
        where: { id: session.streamId },
        select: { title: true, streamKey: true },
      });

      // 비즈니스 KPI 조회
      const endedAt = new Date();
      const orderStats = await this.prisma.order.aggregate({
        where: {
          createdAt: { gte: session.startedAt, lte: endedAt },
        },
        _count: true,
        _sum: { total: true },
      });

      const report = this.buildReportMessage(session, stream, orderStats, endedAt);

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: report,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(`Telegram send failed: ${response.status} ${body}`);
      } else {
        this.logger.log(`Live report sent to Telegram for stream ${session.streamId}`);
      }
    } catch (error) {
      this.logger.error('Failed to send Telegram report', (error as Error).message);
    }
  }

  private buildReportMessage(
    session: LiveSession,
    stream: { title: string | null; streamKey: string } | null,
    orderStats: { _count: number; _sum: { total: unknown } },
    endedAt: Date,
  ): string {
    const title = stream?.title ?? session.streamKey ?? session.streamId;
    const duration = this.formatDuration(session.startedAt, endedAt);
    const snaps = session.snapshots;

    if (snaps.length === 0) {
      return `📊 *라이브 리포트: ${title}*\n\n방송 시간: ${duration}\n수집된 메트릭 없음`;
    }

    // 서버 메트릭 요약
    const avgCpu =
      Math.round((snaps.reduce((s, m) => s + m.cpuUsagePercent, 0) / snaps.length) * 10) / 10;
    const maxCpu = Math.max(...snaps.map((m) => m.cpuUsagePercent));
    const avgMem =
      Math.round((snaps.reduce((s, m) => s + m.memoryUsagePercent, 0) / snaps.length) * 10) / 10;
    const maxMem = Math.max(...snaps.map((m) => m.memoryUsagePercent));
    const peakWs = Math.max(...snaps.map((m) => m.wsConnectionCount));
    const avgResponse = Math.round(snaps.reduce((s, m) => s + m.avgResponseMs, 0) / snaps.length);
    const totalSlow = snaps[snaps.length - 1].slowRequests;
    const maxErrorRate = Math.max(...snaps.map((m) => m.errorRate));

    // 주문 통계
    const orderCount = orderStats._count;
    const totalRevenue = Number(orderStats._sum.total ?? 0);

    const lines = [
      `📊 *라이브 리포트: ${title}*`,
      ``,
      `⏱ *방송 정보*`,
      `시작: ${this.formatTime(session.startedAt)}`,
      `종료: ${this.formatTime(endedAt)}`,
      `시간: ${duration}`,
      `수집: ${snaps.length}회 (10분 간격)`,
      ``,
      `🖥 *서버 메트릭*`,
      `CPU: 평균 ${avgCpu}% / 최대 ${maxCpu}%`,
      `메모리: 평균 ${avgMem}% / 최대 ${maxMem}%`,
      `응답시간: 평균 ${avgResponse}ms`,
      `느린 요청: ${totalSlow}건`,
      `에러율: 최대 ${maxErrorRate}%`,
      ``,
      `🔌 *WebSocket*`,
      `피크 동시접속: ${peakWs}명`,
      ``,
      `💰 *주문 (방송 중)*`,
      `주문 수: ${orderCount}건`,
      `매출: ${totalRevenue.toLocaleString('ko-KR')}원`,
    ];

    // 경고 표시
    const warnings: string[] = [];
    if (maxCpu > 80) {
      warnings.push(`⚠️ CPU ${maxCpu}% 도달`);
    }
    if (maxMem > 85) {
      warnings.push(`⚠️ 메모리 ${maxMem}% 도달`);
    }
    if (maxErrorRate > 5) {
      warnings.push(`⚠️ 에러율 ${maxErrorRate}% 도달`);
    }

    if (warnings.length > 0) {
      lines.push('', '🚨 *경고*', ...warnings);
    }

    return lines.join('\n');
  }

  private formatDuration(start: Date, end: Date): string {
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  }

  private formatTime(date: Date): string {
    return date.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
