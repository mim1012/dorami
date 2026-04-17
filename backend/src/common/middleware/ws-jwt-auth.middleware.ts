import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: process.env.REDIS_PASSWORD ?? undefined,
      lazyConnect: true,
    });
    void redisClient.connect().catch(() => {
      // intentional: lazy connect errors are ignored
    });
  }
  return redisClient;
}

export interface JwtPayload {
  userId: string;
  sub?: string;
  sid?: string;
  email: string;
  name: string;
  role: string;
  type?: string;
  jti?: string;
}

export type AuthenticatedSocket = Socket & {
  user: {
    userId: string;
    email: string;
    name: string;
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
  prismaService: PrismaService,
): Promise<AuthenticatedSocket> {
  const token =
    (socket.handshake.auth.token as string | undefined) ??
    socket.handshake.headers.authorization?.split(' ')[1] ??
    parseCookieToken(socket.handshake.headers.cookie as string | undefined);

  if (!token) {
    throw new WsException('No token provided');
  }

  try {
    const payload = (await jwtService.verifyAsync(token, {
      secret: process.env.JWT_SECRET,
    })) as JwtPayload;

    // Reject non-access tokens
    if (payload.type && payload.type !== 'access') {
      throw new WsException('Invalid token type');
    }

    // Check Redis blacklist by both jti AND userId.
    // logout() writes blacklist:{userId}; checking both ensures logout revokes WebSocket connections.
    try {
      const redis = getRedisClient();
      const uid = payload.userId ?? payload.sub;
      const [jtiBlacklisted, userBlacklisted] = await Promise.all([
        payload.jti ? redis.exists(`blacklist:${payload.jti}`) : Promise.resolve(0),
        uid ? redis.exists(`blacklist:${uid}`) : Promise.resolve(0),
      ]);
      if (jtiBlacklisted === 1 || userBlacklisted === 1) {
        throw new WsException('Token has been revoked');
      }
    } catch (err) {
      if (err instanceof WsException) {
        throw err;
      }
      // Graceful degradation if Redis unavailable
    }

    // Enforce per-session revocation immediately for access-token-backed sockets.
    // If sid is present, the session must still be active.
    if (payload.sid) {
      try {
        const uid = payload.userId ?? payload.sub;
        const session = await prismaService.authSession.findUnique({
          where: { id: payload.sid },
          select: { userId: true, revokedAt: true, expiresAt: true },
        });
        if (!session || session.userId !== uid || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
          throw new WsException('Token has been revoked');
        }
      } catch (err) {
        if (err instanceof WsException) {
          throw err;
        }
        // Graceful degradation if DB unavailable
      }
    }

    // Check if user is suspended via Redis blacklist
    // When admin suspends a user, their userId is added to blacklist
    try {
      const redis = getRedisClient();
      const uid = payload.userId ?? payload.sub;
      if (!uid) {
        throw new WsException('Invalid token');
      }
      const isSuspended = await redis.exists(`suspended:${uid}`);
      if (isSuspended === 1) {
        throw new WsException('Account is suspended');
      }
      const user = await prismaService.user.findUnique({
        where: { id: uid },
        select: { status: true },
      });
      if (!user) {
        throw new WsException('User not found');
      }
      if (user.status === 'SUSPENDED') {
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
      name: payload.name,
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
