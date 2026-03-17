import { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Throttler configuration for rate limiting
 *
 * Provides multiple rate limit tiers:
 * - short: Burst protection (configurable via THROTTLE_SHORT_LIMIT, default 10/s)
 * - medium: Normal rate limit (configurable via THROTTLE_MEDIUM_LIMIT, default 20/10s)
 * - long: Extended rate limit (configurable via THROTTLE_LONG_LIMIT, default 100/min)
 *
 * Dev mode auto-scales limits 3x higher unless overridden by env vars.
 */
const isDev = process.env.NODE_ENV !== 'production';

const shortLimit = parseInt(process.env.THROTTLE_SHORT_LIMIT ?? (isDev ? '30' : '5000'), 10);
const mediumLimit = parseInt(process.env.THROTTLE_MEDIUM_LIMIT ?? (isDev ? '200' : '10000'), 10);
const longLimit = parseInt(process.env.THROTTLE_LONG_LIMIT ?? (isDev ? '1000' : '50000'), 10);

export const throttlerConfig: ThrottlerModuleOptions = [
  {
    name: 'short',
    ttl: 1000, // 1 second
    limit: shortLimit,
  },
  {
    name: 'medium',
    ttl: 10000, // 10 seconds
    limit: mediumLimit,
  },
  {
    name: 'long',
    ttl: 60000, // 1 minute
    limit: longLimit,
  },
];

/**
 * Auth-specific rate limit configuration
 * More restrictive for login/auth endpoints to prevent brute force
 * Configurable via AUTH_THROTTLE_WINDOW_MS and AUTH_THROTTLE_LIMIT env vars.
 */
export const authThrottlerConfig = {
  ttl: parseInt(process.env.AUTH_THROTTLE_WINDOW_MS ?? '60000', 10),
  limit: parseInt(process.env.AUTH_THROTTLE_LIMIT ?? '500', 10),
};
