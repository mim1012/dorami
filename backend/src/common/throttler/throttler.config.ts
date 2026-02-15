import { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Throttler configuration for rate limiting
 *
 * Provides multiple rate limit tiers:
 * - short: Burst protection (3 requests per second)
 * - medium: Normal rate limit (20 requests per 10 seconds)
 * - long: Extended rate limit (100 requests per minute)
 */
const isDev = process.env.NODE_ENV !== 'production';

export const throttlerConfig: ThrottlerModuleOptions = [
  {
    name: 'short',
    ttl: 1000, // 1 second
    limit: isDev ? 30 : 10,
  },
  {
    name: 'medium',
    ttl: 10000, // 10 seconds
    limit: isDev ? 200 : 20,
  },
  {
    name: 'long',
    ttl: 60000, // 1 minute
    limit: isDev ? 1000 : 100,
  },
];

/**
 * Auth-specific rate limit configuration
 * More restrictive for login/auth endpoints to prevent brute force
 */
export const authThrottlerConfig = {
  ttl: 60000, // 1 minute
  limit: 5, // 5 attempts per minute
};
