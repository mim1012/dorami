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
    // Find existing user by kakaoId OR email (preserve existing user profiles)
    const whereConditions: Array<{ kakaoId?: string; email?: string }> = [
      { kakaoId: profile.kakaoId },
    ];
    if (profile.email) {
      whereConditions.push({ email: profile.email });
    }

    let user = await this.prisma.user.findFirst({
      where: {
        OR: whereConditions,
      },
    });

    // Check if user email is in cached admin whitelist
    const isAdmin = profile.email && this.adminEmailSet.has(profile.email);
    const assignedRole = isAdmin ? 'ADMIN' : 'USER';

    if (!user) {
      // Auto-registration for new Kakao users
      user = await this.prisma.user.create({
        data: {
          kakaoId: profile.kakaoId,
          email: profile.email ?? null,
          name: profile.nickname,
          role: assignedRole,
          status: 'ACTIVE',
          lastLoginAt: new Date(),
        },
      });

      this.logger.log(`New user created: ${user.id} (role: ${assignedRole})`);
    } else {
      // Update user profile, link kakaoId if missing, and update lastLoginAt
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          kakaoId: user.kakaoId || profile.kakaoId,
          name: profile.nickname,
          email: profile.email ?? user.email,
          role: assignedRole,
          lastLoginAt: new Date(),
        },
      });

      this.logger.log(`Returning user: ${user.id} (role: ${assignedRole})`);
    }

    return user;
  }

  private parseExpiresInToSeconds(expiresIn: string): number {
    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    if (!match) {
      return 30 * 24 * 60 * 60;
    }
    const value = parseInt(match[1], 10);
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[match[2]] ?? 86400);
  }

  async login(user: User): Promise<LoginResponseDto> {
    const payload: TokenPayload = {
      sub: user.id,
      userId: user.id,
      email: user.email ?? '',
      kakaoId: user.kakaoId,
      name: user.name,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(
      { ...payload, type: 'access', jti: randomUUID() },
      { expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN') ?? '15m' },
    );

    const refreshExpiresIn = this.configService.get('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh', jti: randomUUID() },
      { expiresIn: refreshExpiresIn },
    );

    const refreshTokenTTL = this.parseExpiresInToSeconds(refreshExpiresIn);
    try {
      await this.redisService.set(`refresh_token:${user.id}`, refreshToken, refreshTokenTTL);
    } catch (error) {
      this.logger.warn(`Failed to store refresh token in Redis: ${(error as Error).message}`);
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        kakaoId: user.kakaoId,
        email: user.email ?? undefined,
        name: user.name,
        role: user.role,
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<LoginResponseDto> {
    try {
      const payload = this.jwtService.verify<TokenPayload>(refreshToken);

      if (payload.type && payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const storedToken = await this.redisService.get(`refresh_token:${payload.sub}`);

      if (!storedToken || storedToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      await this.redisService.del(`refresh_token:${payload.sub}`);

      return this.login(user);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async validateDevLoginUser(email: string, name?: string): Promise<User> {
    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    const roleToAssign = this.adminEmailSet.has(email) ? 'ADMIN' : 'USER';
    const finalRole = existingUser?.role === 'ADMIN' ? 'ADMIN' : roleToAssign;

    const user = await this.prisma.user.upsert({
      where: { email },
      update: {
        lastLoginAt: new Date(),
        role: finalRole,
      },
      create: {
        kakaoId: `dev_${randomUUID()}`,
        email,
        name: name || email.split('@')[0],
        role: roleToAssign,
        status: 'ACTIVE',
        lastLoginAt: new Date(),
      },
    });

    this.logger.log(`[Dev Auth] Upserted user: ${user.id} (${email}, ${user.role})`);
    return user;
  }

  async logout(userId: string): Promise<void> {
    // Add user to blacklist to prevent token reuse
    const ttl = parseInt(this.configService.get<string>('JWT_EXPIRY_HOURS', '24'), 10) * 60 * 60;
    await this.redisService.set(`blacklist:${userId}`, 'true', ttl);

    // Delete refresh token from Redis
    await this.redisService.del(`refresh_token:${userId}`);

    this.logger.log(`[Auth] User logged out: ${userId}`);
  }
}
