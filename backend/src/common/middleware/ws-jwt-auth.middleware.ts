import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import Redis from 'ioredis';

let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
    });
    redisClient.connect().catch(() => {});
  }
  return redisClient;
}

export type AuthenticatedSocket = Socket & {
  user: {
    userId: string;
    email: string;
    role: string;
  };
};

function parseCookieToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) {
    return null;
  }
  const match = cookieHeader.match(/(?:^|;\s*)accessToken=([^;]*)/);
  return match ? match[1] : null;
}

export async function authenticateSocket(
  socket: Socket,
  jwtService: JwtService,
): Promise<AuthenticatedSocket> {
  const token =
    socket.handshake.auth.token ||
    socket.handshake.headers.authorization?.split(' ')[1] ||
    parseCookieToken(socket.handshake.headers.cookie as string | undefined);

  if (!token) {
    throw new WsException('No token provided');
  }

  try {
    const payload = await jwtService.verifyAsync(token, {
      secret: process.env.JWT_SECRET,
    });

    // Reject non-access tokens
    if (payload.type && payload.type !== 'access') {
      throw new WsException('Invalid token type');
    }

    // Check Redis blacklist by jti
    if (payload.jti) {
      try {
        const redis = getRedisClient();
        const isBlacklisted = await redis.exists(`blacklist:${payload.jti}`);
        if (isBlacklisted === 1) {
          throw new WsException('Token has been revoked');
        }
      } catch (err) {
        if (err instanceof WsException) {
          throw err;
        }
        // Graceful degradation if Redis unavailable
      }
    }

    // Check if user is suspended via Redis blacklist
    // When admin suspends a user, their userId is added to blacklist
    try {
      const redis = getRedisClient();
      const uid = payload.userId || payload.sub;
      const isSuspended = await redis.exists(`suspended:${uid}`);
      if (isSuspended === 1) {
        throw new WsException('Account is suspended');
      }
    } catch (err) {
      if (err instanceof WsException) {
        throw err;
      }
      // Graceful degradation if Redis unavailable
    }

    (socket as AuthenticatedSocket).user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    return socket as AuthenticatedSocket;
  } catch (error) {
    if (error instanceof WsException) {
      throw error;
    }
    throw new WsException('Invalid token');
  }
}
