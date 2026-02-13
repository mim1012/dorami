import { Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxEvents: number; // Max events per window
}

const logger = new Logger('RateLimiter');
const clientEventCounts = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiter for Socket.IO events
 * Prevents abuse by limiting events per client per time window
 */
export function rateLimitCheck(
  socket: Socket,
  eventName: string,
  config: RateLimitConfig = { windowMs: 10000, maxEvents: 100 },
): boolean {
  const key = `${socket.id}:${eventName}`;
  const now = Date.now();
  
  const record = clientEventCounts.get(key);
  
  if (!record || now > record.resetTime) {
    // First event or window expired - create new record
    clientEventCounts.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return true;
  }
  
  if (record.count >= config.maxEvents) {
    // Rate limit exceeded
    logger.warn(`⚠️ Rate limit exceeded for ${socket.id} on event ${eventName}`);
    socket.emit('error', {
      type: 'error',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please slow down.',
      timestamp: new Date().toISOString(),
    });
    return false;
  }
  
  // Increment count
  record.count++;
  return true;
}

// Cleanup old records every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of clientEventCounts.entries()) {
    if (now > record.resetTime) {
      clientEventCounts.delete(key);
    }
  }
}, 60000);
