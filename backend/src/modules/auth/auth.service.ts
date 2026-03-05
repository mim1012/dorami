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
    // Log Kakao profile data for debugging
    this.logger.log(
      `[Kakao] Profile received: kakaoId=${profile.kakaoId}, email=${profile.email ?? 'MISSING'}, nickname=${profile.nickname}`,
    );

    // Find existing user by email FIRST, then kakaoId (email-based account linking)
    let user = null;
    let foundByEmail = false;

    // Priority 1: Find by email (email-based account linking for pre-Kakao users)
    if (profile.email) {
      user = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });
      if (user) {
        foundByEmail = true;
        this.logger.log(`[Kakao] Found existing user by email: ${user.id}`);
      }
    }

    // Priority 2: Find by kakaoId (if no email match)
    if (!user) {
      user = await this.prisma.user.findUnique({
        where: { kakaoId: profile.kakaoId },
      });
      if (user) {
        this.logger.log(`[Kakao] Found existing user by kakaoId: ${user.id}`);
      }
    }

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
      // Update user profile and update lastLoginAt
      // For existing users: preserve role UNLESS they're promoted to ADMIN via whitelist
      const finalRole =
        user.role === 'ADMIN' || !isAdmin
          ? user.role // Keep existing ADMIN status, or don't demote USER
          : 'ADMIN'; // Promote to ADMIN if in whitelist

      // If found by email, always link the real kakaoId so future kakaoId lookups work.
      // If found by kakaoId, keep the existing kakaoId (already correct).
      const newKakaoId = foundByEmail ? profile.kakaoId : user.kakaoId;

      // Check if newKakaoId conflicts with another user before updating
      if (foundByEmail && newKakaoId !== user.kakaoId) {
        const conflict = await this.prisma.user.findUnique({
          where: { kakaoId: newKakaoId },
        });
        if (conflict && conflict.id !== user.id) {
          // Another account already owns this kakaoId — log and keep existing kakaoId
          this.logger.warn(
            `[Kakao] kakaoId ${newKakaoId} already linked to user ${conflict.id}; skipping kakaoId update for user ${user.id}`,
          );
        } else {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: {
              kakaoId: newKakaoId,
              name: profile.nickname,
              email: profile.email ?? user.email,
              role: finalRole,
              lastLoginAt: new Date(),
            },
          });
          this.logger.log(`Returning user: ${user.id} (role: ${finalRole}, kakaoId linked)`);
          return user;
        }
      }

      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name: profile.nickname,
          email: profile.email ?? user.email,
          role: finalRole,
          lastLoginAt: new Date(),
        },
      });

      this.logger.log(`Returning user: ${user.id} (role: ${finalRole})`);
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
