import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import * as crypto from 'crypto';

export const SKIP_CSRF_KEY = 'skipCsrf';

/**
 * Decorator to skip CSRF check for specific routes
 */
export const SkipCsrf = () => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (propertyKey && descriptor) {
      Reflect.defineMetadata(SKIP_CSRF_KEY, true, descriptor.value);
    } else {
      Reflect.defineMetadata(SKIP_CSRF_KEY, true, target);
    }
  };
};

/**
 * CSRF Guard using Double Submit Cookie Pattern
 *
 * How it works:
 * 1. A CSRF token is set in a readable cookie (csrf-token)
 * 2. Frontend reads this cookie and sends it in X-CSRF-Token header
 * 3. Guard validates that the header matches the cookie
 *
 * This works because:
 * - Attackers can't read cookies from other domains (same-origin policy)
 * - Attackers can set cookies but can't read them to send in headers
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse();

    // Skip CSRF for safe methods (GET, HEAD, OPTIONS)
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(request.method)) {
      // Ensure CSRF token cookie exists for subsequent requests
      this.ensureCsrfToken(request, response);
      return true;
    }

    // Check if route has @SkipCsrf decorator
    const skipCsrf = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipCsrf) {
      return true;
    }

    // For development/testing, allow disabling CSRF
    if (process.env.NODE_ENV === 'development' && process.env.DISABLE_CSRF === 'true') {
      return true;
    }

    // Validate CSRF token
    const cookieToken = request.cookies?.['csrf-token'];
    const headerToken = request.headers['x-csrf-token'] as string;

    if (!cookieToken || !headerToken) {
      this.logger.warn(`CSRF token missing - Cookie: ${!!cookieToken}, Header: ${!!headerToken}`);
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: 'CSRF_TOKEN_MISSING',
        message: 'CSRF token is required for this request',
      });
    }

    // Use timing-safe comparison to prevent timing attacks
    if (!this.timingSafeEqual(cookieToken, headerToken)) {
      this.logger.warn('CSRF token mismatch');
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: 'CSRF_TOKEN_INVALID',
        message: 'Invalid CSRF token',
      });
    }

    // Rotate token after successful validation (optional, for extra security)
    this.ensureCsrfToken(request, response, true);

    return true;
  }

  /**
   * Ensure CSRF token exists in cookie
   */
  private ensureCsrfToken(request: Request, response: any, forceNew = false): void {
    const existingToken = request.cookies?.['csrf-token'];

    if (!existingToken || forceNew) {
      const newToken = this.generateCsrfToken();

      response.cookie('csrf-token', newToken, {
        httpOnly: false, // Must be readable by JavaScript
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
      });
    }
  }

  /**
   * Generate a secure random CSRF token
   */
  private generateCsrfToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Timing-safe string comparison
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    try {
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
      return false;
    }
  }
}
