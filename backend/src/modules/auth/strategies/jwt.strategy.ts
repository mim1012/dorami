import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
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
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: TokenPayload) {
    // Check if token is blacklisted (logged out)
    const isBlacklisted = await this.redisService.exists(
      `blacklist:${payload.sub}`,
    );

    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return {
      userId: payload.sub,
      kakaoId: payload.kakaoId,
      role: payload.role,
    };
  }
}
