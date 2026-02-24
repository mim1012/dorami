import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { TokenPayload } from '../dto/auth.dto';
import { RedisService } from '../../../common/redis/redis.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { UnauthorizedException } from '../../../common/exceptions/business.exception';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
    private prismaService: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          // Extract from cookie first (HTTP-only cookie)
          const token = request?.cookies?.accessToken;
          if (token) {
            return token;
          }

          // Fallback to Authorization header
          return ExtractJwt.fromAuthHeaderAsBearerToken()(request);
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: TokenPayload) {
    // Reject non-access tokens (e.g., refresh tokens)
    if (payload.type && payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Check if token is blacklisted by jti (preferred) or userId (fallback)
    // Gracefully handle Redis unavailability — assume not blacklisted if Redis is down
    try {
      const blacklistKey = payload.jti ? `blacklist:${payload.jti}` : `blacklist:${payload.sub}`;
      const isBlacklisted = await this.redisService.exists(blacklistKey);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // Redis unavailable — skip blacklist check rather than blocking all requests
    }

    // Check if user is suspended (blacklisted)
    try {
      const user = await this.prismaService.user.findUnique({
        where: { id: payload.sub },
        select: { status: true },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (user.status === 'SUSPENDED') {
        throw new UnauthorizedException('Account is suspended');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // DB unavailable — skip status check rather than blocking all requests
    }

    return {
      userId: payload.sub,
      email: payload.email,
      kakaoId: payload.kakaoId,
      role: payload.role,
    };
  }
}
