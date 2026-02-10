import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
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
  private readonly logger = new Logger(AuthService.name);
  private readonly adminEmailSet: Set<string>;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    // Cache admin whitelist at startup to avoid parsing on every login
    const adminEmails = this.configService.get<string>('ADMIN_EMAILS', '');
    this.adminEmailSet = new Set(
      adminEmails
        .split(',')
        .map((email) => email.trim())
        .filter((email) => email.length > 0),
    );
  }

  async validateKakaoUser(profile: KakaoUserProfile): Promise<User> {
    // Find existing user or create new one
    let user = await this.prisma.user.findUnique({
      where: { kakaoId: profile.kakaoId },
    });

    // Check if user email is in cached admin whitelist
    const isAdmin = profile.email && this.adminEmailSet.has(profile.email);
    const assignedRole = isAdmin ? 'ADMIN' : 'USER';

    if (!user) {
      // Auto-registration for new Kakao users
      user = await this.prisma.user.create({
        data: {
          kakaoId: profile.kakaoId,
          email: profile.email || null, // Set to null if undefined (user denied email permission)
          name: profile.nickname,
          role: assignedRole, // Assign role based on whitelist
          status: 'ACTIVE', // Set status to ACTIVE
          lastLoginAt: new Date(), // Set lastLoginAt
        },
      });

      this.logger.log(`New user created: ${user.id} (role: ${assignedRole})`);
    } else {
      // Update user profile, lastLoginAt, and role (in case whitelist changed)
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name: profile.nickname,
          email: profile.email || user.email,
          role: assignedRole, // Update role based on current whitelist
          lastLoginAt: new Date(), // Update lastLoginAt
        },
      });

      this.logger.log(`Returning user: ${user.id} (role: ${assignedRole})`);
    }

    return user;
  }

  async login(user: User): Promise<LoginResponseDto> {
    const payload: TokenPayload = {
      sub: user.id,
      userId: user.id, // Add userId for JWT strategy compatibility
      email: user.email, // Include email per Story 2.1 spec
      kakaoId: user.kakaoId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(
      { ...payload, type: 'access', jti: randomUUID() },
      { expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN') || '15m' },
    );

    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh', jti: randomUUID() },
      { expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d' },
    );

    // Store refresh token in Redis (TTL: 7 days)
    const refreshTokenTTL = 7 * 24 * 60 * 60; // 7 days in seconds
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

      // Reject access tokens used as refresh tokens
      if (payload.type && payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

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

      // Token Rotation: Delete old refresh token BEFORE issuing new one
      // This prevents race conditions where old token could be reused
      await this.redisService.del(`refresh_token:${payload.sub}`);

      // Issue new tokens (this will store new refresh token in Redis)
      return this.login(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string, accessToken?: string): Promise<void> {
    // Blacklist the specific token by jti if available
    if (accessToken) {
      try {
        const decoded = this.jwtService.decode(accessToken) as TokenPayload & { exp: number };
        if (decoded?.jti) {
          const now = Math.floor(Date.now() / 1000);
          const ttl = decoded.exp > now ? decoded.exp - now : 0;
          if (ttl > 0) {
            await this.redisService.set(`blacklist:${decoded.jti}`, 'true', ttl);
          }
        }
      } catch {
        // Fallback: blacklist by userId
        const blacklistTTL = this.configService.get<number>('AUTH_BLACKLIST_TTL_SECONDS', 900);
        await this.redisService.set(`blacklist:${userId}`, 'true', blacklistTTL);
      }
    } else {
      // Fallback: blacklist by userId
      const blacklistTTL = this.configService.get<number>('AUTH_BLACKLIST_TTL_SECONDS', 900);
      await this.redisService.set(`blacklist:${userId}`, 'true', blacklistTTL);
    }

    // Remove refresh token from Redis
    await this.redisService.del(`refresh_token:${userId}`);
  }
}
