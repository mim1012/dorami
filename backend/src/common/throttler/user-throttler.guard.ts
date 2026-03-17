import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'crypto';

/**
 * User-aware throttler guard.
 *
 * Tracks rate limits by (in priority order):
 * 1. Authenticated user ID (JWT)
 * 2. Session ID + User-Agent hash (anonymous visitors — prevents session spoofing)
 * 3. X-Forwarded-For real IP (CDN/proxy)
 * 4. req.ip fallback
 *
 * This prevents Kakao/Instagram in-app browser users sharing CDN proxy IPs
 * from exhausting each other's rate limits.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  /**
   * Hash a string to a short hex digest for use as a tracker key suffix.
   */
  private shortHash(input: string): string {
    return createHash('sha256').update(input).digest('hex').slice(0, 12);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    // 1. Authenticated user (JWT parsed by JwtAuthGuard)
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }

    // 2. Anonymous session + UA fingerprint (set by SessionIdMiddleware)
    const sessionId = req.cookies?.['session_id'] ?? req.sessionId;
    if (sessionId) {
      const ua = (req.headers?.['user-agent'] as string) ?? 'unknown';
      return `session:${sessionId}:${this.shortHash(ua)}`;
    }

    // 3. Real client IP from proxy header
    const xff = req.headers?.['x-forwarded-for'];
    if (xff) {
      const realIp = (Array.isArray(xff) ? xff[0] : xff).split(',')[0].trim();
      if (realIp) {
        return `ip:${realIp}`;
      }
    }

    // 4. Fallback
    return `ip:${req.ip}`;
  }

  protected getRequestResponse(context: ExecutionContext) {
    const ctx = context.switchToHttp();
    return { req: ctx.getRequest(), res: ctx.getResponse() };
  }
}
