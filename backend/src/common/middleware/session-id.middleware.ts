import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

const SESSION_COOKIE_NAME = 'session_id';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class SessionIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Try multiple sources: cookie → header → query param (for QR/deep links)
    const fromCookie = req.cookies?.[SESSION_COOKIE_NAME];
    const fromHeader = req.headers['x-session-id'] as string | undefined;
    const fromQuery = req.query?.sid as string | undefined;

    const candidate = fromCookie || fromHeader || fromQuery;

    // Validate UUID format to prevent spoofing
    const isValid = candidate && UUID_REGEX.test(candidate);
    const sessionId = isValid ? candidate : randomUUID();

    // Always set/refresh the cookie so it persists
    if (!isValid || !fromCookie) {
      const cookieDomain = process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined;
      res.cookie(SESSION_COOKIE_NAME, sessionId, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax', // lax works for same-domain and is Safari ITP-safe
        secure: process.env.NODE_ENV === 'production',
        maxAge: SESSION_MAX_AGE_MS,
        ...(cookieDomain ? { domain: cookieDomain } : {}),
      });
    }

    (req as any).sessionId = sessionId;
    next();
  }
}
