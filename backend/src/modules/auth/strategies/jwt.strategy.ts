import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { TokenPayload } from '../dto/auth.dto';
import { RedisService } from '../../../common/redis/redis.service';
import { UnauthorizedException } from '../../../common/exceptions/business.exception';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          // Extract from cookie first (HTTP-only cookie)
          const token = request?.cookies?.accessToken;
          if (token) {return token;}

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
    if (payload.jti) {
      const isBlacklisted = await this.redisService.exists(
        `blacklist:${payload.jti}`,
      );
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }
    } else {
      const isBlacklisted = await this.redisService.exists(
        `blacklist:${payload.sub}`,
      );
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    return {
      userId: payload.sub,
      email: payload.email,
      kakaoId: payload.kakaoId,
      role: payload.role,
    };
  }
}
