import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { LoginResponseDto, TokenPayload } from './dto/auth.dto';
import { UnauthorizedException } from '../../common/exceptions/business.exception';
import { User } from '@prisma/client';

interface KakaoUserProfile {
  kakaoId: string;
  email?: string;
  nickname: string;
  profileImage?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
  ) {}

  async validateKakaoUser(profile: KakaoUserProfile): Promise<User> {
    // Find existing user or create new one
    let user = await this.prisma.user.findUnique({
      where: { kakaoId: profile.kakaoId },
    });

    if (!user) {
      // Auto-registration for new Kakao users
      user = await this.prisma.user.create({
        data: {
          kakaoId: profile.kakaoId,
          email: profile.email,
          name: profile.nickname,
          role: 'USER', // Default role
        },
      });
    } else {
      // Update user profile if changed
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name: profile.nickname,
          email: profile.email || user.email,
        },
      });
    }

    return user;
  }

  async login(user: User): Promise<LoginResponseDto> {
    const payload: TokenPayload = {
      sub: user.id,
      kakaoId: user.kakaoId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRES_IN') || '1h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') || '30d',
    });

    // Store refresh token in Redis (TTL: 30 days)
    const refreshTokenTTL = 30 * 24 * 60 * 60; // 30 days in seconds
    await this.redisService.set(
      `refresh_token:${user.id}`,
      refreshToken,
      refreshTokenTTL,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        kakaoId: user.kakaoId,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<LoginResponseDto> {
    try {
      const payload = this.jwtService.verify<TokenPayload>(refreshToken);

      // Verify refresh token exists in Redis
      const storedToken = await this.redisService.get(
        `refresh_token:${payload.sub}`,
      );

      if (!storedToken || storedToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Get user from database
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Issue new tokens
      return this.login(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    // Add user to blacklist (prevent token reuse)
    const blacklistTTL = 60 * 60; // 1 hour (match access token expiry)
    await this.redisService.set(
      `blacklist:${userId}`,
      'true',
      blacklistTTL,
    );

    // Remove refresh token from Redis
    await this.redisService.del(`refresh_token:${userId}`);
  }
}
