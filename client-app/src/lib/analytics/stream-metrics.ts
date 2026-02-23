/**
 * Stream Quality Metrics — Production Monitoring
 *
 * Collects and reports video stream KPI metrics to Sentry for production analysis.
 * - Production-only: metrics are silently dropped in dev/test environments.
 * - Offline-resilient: up to 10 pending events are queued in localStorage and
 *   flushed on the next sendStreamMetrics call.
 * - Privacy-safe: no PII is included; only technical stream metadata.
 */

export interface StreamMetrics {
  streamKey: string;
  timestamp: string;
  metrics: {
    firstFrameMs: number;
    rebufferCount: number;
    stallDurationMs: number;
    reconnectCount: number;
    totalConnectionTimeMs: number;
  };
  connectionState: 'CONNECTED' | 'RECONNECTING' | 'FAILED';
  circuitBreakerState?: {
    failures: number;
    isOpen: boolean;
    cooldownRemainingMs: number;
  };
}

// ── Threshold constants ────────────────────────────────────────────────────────

const THRESHOLD = {
  /** reconnectCount 초과 시 WARNING */
  RECONNECT_WARNING: 3,
  /** stallDurationMs 초과 시 ERROR (30초) */
  STALL_ERROR_MS: 30_000,
  /** firstFrameMs 초과 시 WARNING (5초) */
  FIRST_FRAME_WARNING_MS: 5_000,
} as const;

// ── Batch queue (localStorage) ─────────────────────────────────────────────────

const QUEUE_KEY = 'dorami:stream_metrics_queue';
const MAX_QUEUE_SIZE = 10;

function readQueue(): StreamMetrics[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as StreamMetrics[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: StreamMetrics[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore quota errors
  }
}

function enqueue(metrics: StreamMetrics): void {
  const queue = readQueue();
  queue.push(metrics);
  // Keep only the most recent MAX_QUEUE_SIZE entries
  if (queue.length > MAX_QUEUE_SIZE) {
    queue.splice(0, queue.length - MAX_QUEUE_SIZE);
  }
  writeQueue(queue);
}

function drainQueue(): StreamMetrics[] {
  const queue = readQueue();
  if (queue.length > 0) {
    writeQueue([]);
  }
  return queue;
}

// ── Sentry dispatch ────────────────────────────────────────────────────────────

/**
 * Determine the Sentry severity level based on metric thresholds.
 */
function resolveSeverity(metrics: StreamMetrics): 'info' | 'warning' | 'error' {
  const m = metrics.metrics;

  if (metrics.connectionState === 'FAILED' || m.stallDurationMs > THRESHOLD.STALL_ERROR_MS) {
    return 'error';
  }

  if (
    m.reconnectCount > THRESHOLD.RECONNECT_WARNING ||
    m.firstFrameMs > THRESHOLD.FIRST_FRAME_WARNING_MS ||
    metrics.connectionState === 'RECONNECTING'
  ) {
    return 'warning';
  }

  return 'info';
}

async function dispatchToSentry(metrics: StreamMetrics): Promise<void> {
  const severity = resolveSeverity(metrics);
  const label = `[stream-metrics] ${metrics.connectionState} | key=${metrics.streamKey}`;

  try {
    const Sentry = await import('@sentry/nextjs');

    // Breadcrumb so the Sentry timeline shows the event chain
    Sentry.addBreadcrumb({
      category: 'stream.metrics',
      message: label,
      level: severity,
      data: metrics.metrics,
    });

    Sentry.captureMessage(label, severity);
  } catch {
    // @sentry/nextjs not installed — fall back to console in non-production
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[stream-metrics][${severity}]`, metrics);
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Send stream KPI metrics to Sentry.
 *
 * - In development / test: queues are still written so offline support works,
 *   but nothing is dispatched to Sentry.
 * - In production: flushes the pending localStorage queue, then sends the
 *   current entry.
 */
export async function sendStreamMetrics(metrics: StreamMetrics): Promise<void> {
  try {
    const isProduction = process.env.NODE_ENV === 'production';

    // Always persist to queue for offline resilience
    enqueue(metrics);

    if (!isProduction) {
      // Dev: just log at debug level
      console.debug('[stream-metrics][dev]', {
        state: metrics.connectionState,
        severity: resolveSeverity(metrics),
        ...metrics.metrics,
      });
      return;
    }

    // Flush the full queue (includes the item we just enqueued)
    const pending = drainQueue();
    await Promise.all(pending.map(dispatchToSentry));
  } catch (error) {
    console.warn('[stream-metrics] Failed to send metrics:', error);
  }
}

/**
 * Convenience helper: build a StreamMetrics snapshot from VideoPlayer's
 * internal metricsRef values.
 */
export function buildStreamMetrics(
  streamKey: string,
  raw: {
    playStartTime: number;
    firstFrameTime: number;
    rebufferCount: number;
    totalStallDuration: number;
    reconnectCount: number;
  },
  connectionState: StreamMetrics['connectionState'],
  circuitBreakerState?: StreamMetrics['circuitBreakerState'],
): StreamMetrics {
  const now = performance.now();
  return {
    streamKey,
    timestamp: new Date().toISOString(),
    metrics: {
      firstFrameMs: raw.firstFrameTime > 0 ? Math.round(raw.firstFrameTime - raw.playStartTime) : 0,
      rebufferCount: raw.rebufferCount,
      stallDurationMs: Math.round(raw.totalStallDuration),
      reconnectCount: raw.reconnectCount,
      totalConnectionTimeMs: raw.playStartTime > 0 ? Math.round(now - raw.playStartTime) : 0,
    },
    connectionState,
    circuitBreakerState,
  };
}
