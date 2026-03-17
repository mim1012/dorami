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
  // email is NOT collected from Kakao (privacy policy: user provides email manually via CompleteProfileDto)
  kakaoPhone?: string; // optional phone from Kakao, used as backup reference only
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
    // Log Kakao profile data for debugging (email not collected per privacy policy)
    this.logger.log(
      `[Kakao] Profile received: kakaoId=${profile.kakaoId}, nickname=${profile.nickname}`,
    );

    // Find existing user by kakaoId only (email no longer collected from Kakao)
    let user = await this.prisma.user.findUnique({
      where: { kakaoId: profile.kakaoId },
    });

    if (user) {
      this.logger.log(`[Kakao] Found existing user by kakaoId: ${user.id}`);
    }

    // Role: USER by default (admin promotion via ADMIN_EMAILS only applies to email-based login)
    const assignedRole = 'USER';

    if (!user) {
      // Auto-registration for new Kakao users; email left null until user completes profile
      user = await this.prisma.user.create({
        data: {
          kakaoId: profile.kakaoId,
          email: null,
          kakaoPhone: profile.kakaoPhone ?? null,
          name: profile.nickname,
          role: assignedRole,
          status: 'ACTIVE',
          lastLoginAt: new Date(),
        },
      });

      this.logger.log(`New user created: ${user.id} (role: ${assignedRole})`);
    } else {
      // Update nickname, lastLoginAt, and kakaoPhone; preserve role and email (user-provided)
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name: profile.nickname,
          kakaoPhone: profile.kakaoPhone ?? user.kakaoPhone,
          lastLoginAt: new Date(),
        },
      });

      this.logger.log(`Returning user: ${user.id} (role: ${user.role})`);
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
    const profileStatus = this.getProfileCompletionStatus(user);

    const payload: TokenPayload = {
      sub: user.id,
      userId: user.id,
      email: user.email ?? '',
      kakaoId: user.kakaoId,
      name: user.name,
      role: user.role,
      profileComplete: profileStatus.profileComplete,
      shippingAddressComplete: !!user.shippingAddress,
    };

    const accessToken = this.jwtService.sign(
      { ...payload, type: 'access', jti: randomUUID() },
      { expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN') ?? '1h' },
    );

    const refreshExpiresIn = this.configService.get('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh', jti: randomUUID() },
      { expiresIn: refreshExpiresIn },
    );

    const refreshTokenTTL = this.parseExpiresInToSeconds(refreshExpiresIn);
    try {
      await this.redisService.set(`refresh_token:${user.id}`, refreshToken, refreshTokenTTL);
      // Clear blacklist entry so new tokens are not rejected after a previous logout
      await this.redisService.del(`blacklist:${user.id}`);
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
        profileComplete: profileStatus.profileComplete,
      },
    };
  }

  // In-memory dedupe for concurrent refresh requests (same process)
  private readonly refreshLocks = new Map<string, Promise<LoginResponseDto>>();

  async refreshToken(refreshToken: string): Promise<LoginResponseDto> {
    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(refreshToken);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type && payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const userId = payload.sub;

    // In-memory dedupe: if refresh is already in-flight for this user, return same promise
    const existing = this.refreshLocks.get(userId);
    if (existing) {
      return existing;
    }

    const promise = this._doRefreshToken(userId, refreshToken);
    this.refreshLocks.set(userId, promise);

    try {
      return await promise;
    } finally {
      this.refreshLocks.delete(userId);
    }
  }

  private async _doRefreshToken(userId: string, refreshToken: string): Promise<LoginResponseDto> {
    try {
      const storedToken = await this.redisService.get(`refresh_token:${userId}`);

      if (!storedToken || storedToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Redis lock: dedupe across multiple server instances
      const lockKey = `refresh_lock:${userId}`;
      const acquired = await this.redisService.getClient().set(lockKey, '1', 'EX', 5, 'NX');

      if (!acquired) {
        // Another instance is processing — wait and check cached result
        await new Promise((r) => setTimeout(r, 200));
        const cached = await this.redisService.get(`refresh_result:${userId}`);
        if (cached) {
          return JSON.parse(cached) as LoginResponseDto;
        }
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      await this.redisService.del(`refresh_token:${userId}`);

      const result = await this.login(user);

      // Cache result briefly for concurrent requests across instances
      await this.redisService.set(`refresh_result:${userId}`, JSON.stringify(result), 5);

      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
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
        status: 'ACTIVE',
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

    // Clear suspension flag so previously-suspended test accounts can reconnect via WebSocket
    try {
      await this.redisService.del(`suspended:${user.id}`);
    } catch (error) {
      this.logger.warn(
        `Failed to clear suspension flag for ${user.id}: ${(error as Error).message}`,
      );
    }

    this.logger.log(`[Dev Auth] Upserted user: ${user.id} (${email}, ${user.role})`);
    return user;
  }

  getProfileCompletionStatus(user: User): {
    profileComplete: boolean;
    isNewUser: boolean;
    missingFields: {
      email: boolean;
      phone: boolean;
      instagramId: boolean;
      shippingAddress: boolean;
    };
  } {
    const missingEmail = !user.email;
    const missingPhone = !user.kakaoPhone;
    const missingInstagramId = !user.instagramId;
    const missingShippingAddress = !user.shippingAddress;

    // Use profileCompletedAt as single source of truth.
    // phone and instagramId are optional in CompleteProfileDto, so requiring them here
    // would trap users who skip those fields in a frontend redirect loop.
    const profileComplete = !!user.profileCompletedAt;

    // A user is "new" if they have no email yet (freshly registered via Kakao)
    const isNewUser = !user.email;

    return {
      profileComplete,
      isNewUser,
      missingFields: {
        email: missingEmail,
        phone: missingPhone,
        instagramId: missingInstagramId,
        shippingAddress: missingShippingAddress,
      },
    };
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
