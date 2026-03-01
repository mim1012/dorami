import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

interface PerformanceMetrics {
  path: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  userAgent?: string;
  userId?: string;
}

// In-memory metrics store (replace with Redis/Prometheus in production)
const metricsStore: PerformanceMetrics[] = [];
const MAX_METRICS = 1000;

// Thresholds for slow request warnings
const SLOW_REQUEST_THRESHOLD_MS = 1000;
const VERY_SLOW_REQUEST_THRESHOLD_MS = 3000;

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Performance');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();
    const startTime = Date.now();

    const { method, url, headers } = request;
    const userAgent = headers['user-agent'];
    const userId = request.user?.id;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          // Log slow requests
          if (duration >= VERY_SLOW_REQUEST_THRESHOLD_MS) {
            this.logger.error(
              `VERY SLOW REQUEST: ${method} ${url} - ${duration}ms (status: ${statusCode})`,
            );
          } else if (duration >= SLOW_REQUEST_THRESHOLD_MS) {
            this.logger.warn(
              `Slow request: ${method} ${url} - ${duration}ms (status: ${statusCode})`,
            );
          }

          // Store metrics
          this.storeMetrics({
            path: url,
            method,
            statusCode,
            duration,
            timestamp: new Date(),
            userAgent,
            userId,
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error(`Request failed: ${method} ${url} - ${duration}ms - ${error.message}`);

          this.storeMetrics({
            path: url,
            method,
            statusCode: (error as { status?: number }).status ?? 500,
            duration,
            timestamp: new Date(),
            userAgent,
            userId,
          });
        },
      }),
    );
  }

  private storeMetrics(metrics: PerformanceMetrics): void {
    metricsStore.push(metrics);

    // Keep only last MAX_METRICS entries
    if (metricsStore.length > MAX_METRICS) {
      metricsStore.shift();
    }
  }
}

/**
 * Get performance statistics
 */
export function getPerformanceStats(): {
  totalRequests: number;
  averageDuration: number;
  slowRequests: number;
  errorRate: number;
  topEndpoints: { path: string; count: number; avgDuration: number }[];
} {
  if (metricsStore.length === 0) {
    return {
      totalRequests: 0,
      averageDuration: 0,
      slowRequests: 0,
      errorRate: 0,
      topEndpoints: [],
    };
  }

  const totalRequests = metricsStore.length;
  const totalDuration = metricsStore.reduce((sum, m) => sum + m.duration, 0);
  const averageDuration = Math.round(totalDuration / totalRequests);
  const slowRequests = metricsStore.filter((m) => m.duration >= SLOW_REQUEST_THRESHOLD_MS).length;
  const errorRequests = metricsStore.filter((m) => m.statusCode >= 400).length;
  const errorRate = Math.round((errorRequests / totalRequests) * 100);

  // Group by endpoint
  const endpointMap = new Map<string, { count: number; totalDuration: number }>();
  metricsStore.forEach((m) => {
    const key = `${m.method} ${m.path.split('?')[0]}`; // Remove query params
    const existing = endpointMap.get(key) ?? { count: 0, totalDuration: 0 };
    endpointMap.set(key, {
      count: existing.count + 1,
      totalDuration: existing.totalDuration + m.duration,
    });
  });

  const topEndpoints = Array.from(endpointMap.entries())
    .map(([path, data]) => ({
      path,
      count: data.count,
      avgDuration: Math.round(data.totalDuration / data.count),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalRequests,
    averageDuration,
    slowRequests,
    errorRate,
    topEndpoints,
  };
}

/**
 * Clear metrics (for testing)
 */
export function clearMetrics(): void {
  metricsStore.length = 0;
}
