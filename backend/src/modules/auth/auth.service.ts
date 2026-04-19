import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { AuthSessionSummaryDto, LoginResponseDto, TokenPayload } from './dto/auth.dto';
import {
  EntityNotFoundException,
  UnauthorizedException,
} from '../../common/exceptions/business.exception';
import { User } from '@prisma/client';
import { AuthSessionRepository } from './auth-session.repository';

type JwtExpiry = `${number}${'s' | 'm' | 'h' | 'd'}`;

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
  private readonly refreshLockTtlSeconds = 5;
  private readonly refreshResultTtlSeconds = 30;
  private readonly refreshContentionWaitMs = 4000;
  private readonly refreshContentionPollMs = 250;

  // In-memory dedupe for concurrent refresh requests (same process)
  private readonly refreshLocks = new Map<string, Promise<LoginResponseDto>>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
    private authSessionRepository: AuthSessionRepository,
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

  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private buildTokenPayload(user: User): TokenPayload {
    const profileStatus = this.getProfileCompletionStatus(user);

    return {
      sub: user.id,
      userId: user.id,
      email: user.email ?? '',
      kakaoId: user.kakaoId,
      name: user.name,
      role: user.role,
      profileComplete: profileStatus.profileComplete,
      shippingAddressComplete: !!user.shippingAddress,
    };
  }

  private buildLoginResponse(
    user: User,
    profileComplete: boolean,
    accessToken: string,
    refreshToken: string,
  ): LoginResponseDto {
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        kakaoId: user.kakaoId,
        email: user.email ?? undefined,
        name: user.name,
        role: user.role,
        profileComplete,
      },
    };
  }

  private issueAccessToken(user: User, sessionId: string): string {
    const payload = this.buildTokenPayload(user);
    const accessExpiresIn = (this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ??
      '15m') as JwtExpiry;

    return this.jwtService.sign(
      { ...payload, sid: sessionId, type: 'access', jti: randomUUID() },
      { expiresIn: accessExpiresIn },
    );
  }

  private issueTokensForSession(
    user: User,
    sessionId: string,
  ): {
    accessToken: string;
    refreshToken: string;
    refreshTokenHash: string;
    refreshTokenTTL: number;
    refreshExpiresAt: Date;
    profileComplete: boolean;
  } {
    const payload = this.buildTokenPayload(user);
    const accessToken = this.issueAccessToken(user, sessionId);

    const refreshExpiresIn = (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ??
      '7d') as JwtExpiry;
    const refreshToken = this.jwtService.sign(
      { ...payload, sid: sessionId, type: 'refresh', jti: randomUUID() },
      { expiresIn: refreshExpiresIn },
    );

    const refreshTokenTTL = this.parseExpiresInToSeconds(refreshExpiresIn);

    return {
      accessToken,
      refreshToken,
      refreshTokenHash: this.hashRefreshToken(refreshToken),
      refreshTokenTTL,
      refreshExpiresAt: new Date(Date.now() + refreshTokenTTL * 1000),
      profileComplete: payload.profileComplete === true,
    };
  }

  async login(user: User): Promise<LoginResponseDto> {
    const sessionId = randomUUID();
    const issuedTokens = this.issueTokensForSession(user, sessionId);

    await this.authSessionRepository.createSession({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: issuedTokens.refreshTokenHash,
      lastUsedAt: new Date(),
      expiresAt: issuedTokens.refreshExpiresAt,
    });

    try {
      await this.redisService.del(`refresh_token:${user.id}`);
      // Clear blacklist entry so new tokens are not rejected after a previous logout
      await this.redisService.del(`blacklist:${user.id}`);
    } catch (error) {
      this.logger.warn(`Failed to clear legacy auth cache state: ${(error as Error).message}`);
    }

    return this.buildLoginResponse(
      user,
      issuedTokens.profileComplete,
      issuedTokens.accessToken,
      issuedTokens.refreshToken,
    );
  }

  private logRefresh(
    level: 'log' | 'warn' | 'error',
    reason: string,
    userId: string,
    details?: Record<string, unknown>,
    trace?: string,
  ): void {
    const payload = JSON.stringify({
      reason,
      userId,
      ...details,
    });

    if (level === 'error') {
      this.logger.error(`[Refresh] ${payload}`, trace);
      return;
    }

    this.logger[level](`[Refresh] ${payload}`);
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async readCachedRefreshResult(
    sessionId: string,
    userId: string,
  ): Promise<LoginResponseDto | null> {
    const cacheKey = `refresh_result:${sessionId}`;
    const cached = await this.redisService.get(cacheKey);

    if (!cached) {
      return null;
    }

    try {
      return JSON.parse(cached) as LoginResponseDto;
    } catch (error) {
      this.logRefresh('warn', 'INVALID_CACHED_REFRESH_RESULT', userId, {
        sessionId,
        message: (error as Error).message || 'Failed to parse cached refresh result',
      });

      try {
        await this.redisService.del(cacheKey);
      } catch (cleanupError) {
        this.logRefresh('warn', 'CACHED_REFRESH_RESULT_DELETE_FAILED', userId, {
          sessionId,
          message: (cleanupError as Error).message || 'Failed to delete malformed cache entry',
        });
      }

      return null;
    }
  }

  private async waitForCachedRefreshResult(
    sessionId: string,
    userId: string,
  ): Promise<{
    attempts: number;
    waitedMs: number;
    result: LoginResponseDto | null;
  }> {
    const startedAt = Date.now();
    let attempts = 0;

    while (true) {
      attempts += 1;

      const result = await this.readCachedRefreshResult(sessionId, userId);
      if (result) {
        return {
          attempts,
          waitedMs: Date.now() - startedAt,
          result,
        };
      }

      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs >= this.refreshContentionWaitMs) {
        return {
          attempts,
          waitedMs: elapsedMs,
          result: null,
        };
      }

      await this.delay(
        Math.min(this.refreshContentionPollMs, this.refreshContentionWaitMs - elapsedMs),
      );
    }
  }

  async refreshToken(refreshToken: string): Promise<LoginResponseDto> {
    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(refreshToken);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logRefresh('warn', 'JWT_VERIFY_FAILED', 'unknown', {
        message: (error as Error).message || 'Unknown JWT verification error',
      });

      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type && payload.type !== 'refresh') {
      this.logRefresh('warn', 'INVALID_TOKEN_TYPE', payload.sub, {
        tokenType: payload.type,
      });
      throw new UnauthorizedException('Invalid token type');
    }

    if (!payload.sid) {
      this.logRefresh('warn', 'MISSING_SESSION_ID', payload.sub, {
        tokenType: payload.type ?? 'unknown',
      });
      return this.migrateLegacyRefreshToken(payload);
    }

    const inFlightKey = payload.sid;
    const existing = this.refreshLocks.get(inFlightKey);
    if (existing) {
      return existing;
    }

    const promise = this._doRefreshToken(payload.sub, payload.sid, refreshToken);
    this.refreshLocks.set(inFlightKey, promise);

    try {
      return await promise;
    } finally {
      this.refreshLocks.delete(inFlightKey);
    }
  }

  private async migrateLegacyRefreshToken(payload: TokenPayload): Promise<LoginResponseDto> {
    const userId = payload.sub;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      this.logRefresh('warn', 'LEGACY_USER_NOT_FOUND', userId);
      throw new UnauthorizedException('User not found');
    }

    const sessionId = randomUUID();
    const issuedTokens = this.issueTokensForSession(user, sessionId);
    const lastUsedAt = new Date();

    await this.authSessionRepository.createSession({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: issuedTokens.refreshTokenHash,
      lastUsedAt,
      expiresAt: issuedTokens.refreshExpiresAt,
    });

    this.logRefresh('log', 'LEGACY_REFRESH_MIGRATED', userId, { sessionId });

    return this.buildLoginResponse(
      user,
      issuedTokens.profileComplete,
      issuedTokens.accessToken,
      issuedTokens.refreshToken,
    );
  }

  private async _doRefreshToken(
    userId: string,
    sessionId: string,
    refreshToken: string,
  ): Promise<LoginResponseDto> {
    const lockKey = `refresh_lock:${sessionId}`;
    const cacheKey = `refresh_result:${sessionId}`;
    let lockAcquired = false;
    try {
      const acquired = await this.redisService
        .getClient()
        .set(lockKey, '1', 'EX', this.refreshLockTtlSeconds, 'NX');

      if (!acquired) {
        this.logRefresh('log', 'LOCK_CONTENTION', userId, {
          sessionId,
          waitWindowMs: this.refreshContentionWaitMs,
          pollIntervalMs: this.refreshContentionPollMs,
        });

        const waitResult = await this.waitForCachedRefreshResult(sessionId, userId);
        if (waitResult.result) {
          this.logRefresh('log', 'LOCK_CONTENTION_RECOVERED', userId, {
            sessionId,
            attempts: waitResult.attempts,
            waitedMs: waitResult.waitedMs,
          });
          return waitResult.result;
        }

        this.logRefresh('warn', 'LOCK_TIMEOUT', userId, {
          sessionId,
          attempts: waitResult.attempts,
          waitedMs: waitResult.waitedMs,
        });
        throw new UnauthorizedException('Invalid refresh token');
      }

      lockAcquired = true;

      const authSession = await this.authSessionRepository.getSession(sessionId);
      if (!authSession) {
        this.logRefresh('warn', 'SESSION_NOT_FOUND', userId, { sessionId });
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (authSession.userId !== userId) {
        this.logRefresh('warn', 'SESSION_USER_MISMATCH', userId, {
          sessionId,
          sessionUserId: authSession.userId,
        });
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (authSession.revokedAt) {
        this.logRefresh('warn', 'SESSION_REVOKED', userId, { sessionId });
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (authSession.expiresAt.getTime() <= Date.now()) {
        this.logRefresh('warn', 'SESSION_EXPIRED', userId, { sessionId });
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      if (authSession.refreshTokenHash !== this.hashRefreshToken(refreshToken)) {
        this.logRefresh('warn', 'TOKEN_MISMATCH', userId, {
          sessionId,
          possibleCause: 'reuse_or_rotation_race',
        });
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        this.logRefresh('warn', 'USER_NOT_FOUND', userId, { sessionId });
        throw new UnauthorizedException('User not found');
      }

      const accessToken = this.issueAccessToken(user, sessionId);
      const profileStatus = this.getProfileCompletionStatus(user);
      const lastUsedAt = new Date();

      await this.authSessionRepository.touchSession(sessionId, lastUsedAt);

      const result = this.buildLoginResponse(
        user,
        profileStatus.profileComplete,
        accessToken,
        refreshToken,
      );

      await this.redisService.set(cacheKey, JSON.stringify(result), this.refreshResultTtlSeconds);

      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logRefresh(
        'error',
        'UNEXPECTED_INFRA_ERROR',
        userId,
        {
          sessionId,
          message: (error as Error).message || 'no message',
          name: (error as Error).name || 'Error',
        },
        (error as Error).stack,
      );
      throw new UnauthorizedException('Invalid or expired refresh token');
    } finally {
      if (lockAcquired) {
        await this.redisService.getClient().del(lockKey);
      }
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
        name: name ?? email.split('@')[0],
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

  private getAccessTokenBlacklistTtlSeconds(): number {
    const accessExpiresIn = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
    return this.parseExpiresInToSeconds(accessExpiresIn);
  }

  private async blacklistTokenJti(tokenJti?: string): Promise<void> {
    if (!tokenJti) {
      return;
    }

    await this.redisService.set(
      `blacklist:${tokenJti}`,
      'true',
      Math.max(this.getAccessTokenBlacklistTtlSeconds(), 1),
    );
  }

  private async blacklistUser(userId: string): Promise<void> {
    const ttl = parseInt(this.configService.get<string>('JWT_EXPIRY_HOURS', '24'), 10) * 60 * 60;
    await this.redisService.set(`blacklist:${userId}`, 'true', ttl);
  }

  private resolveSessionIdFromRefreshToken(userId: string, refreshToken?: string): string | null {
    if (!refreshToken) {
      return null;
    }

    const decoded = this.jwtService.decode(refreshToken) as TokenPayload | null;
    if (!decoded?.sid || decoded.sub !== userId) {
      return null;
    }

    return decoded.sid;
  }

  private mapSessionSummary(
    session: {
      id: string;
      familyId?: string | null;
      deviceName?: string | null;
      deviceType?: string | null;
      userAgent?: string | null;
      ipAddress?: string | null;
      lastUsedAt?: Date | null;
      expiresAt: Date;
      revokedAt?: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    currentSessionId?: string,
  ): AuthSessionSummaryDto {
    return {
      id: session.id,
      current: session.id === currentSessionId,
      familyId: session.familyId ?? null,
      deviceName: session.deviceName ?? null,
      deviceType: session.deviceType ?? null,
      userAgent: session.userAgent ?? null,
      ipAddress: session.ipAddress ?? null,
      lastUsedAt: session.lastUsedAt?.toISOString() ?? null,
      expiresAt: session.expiresAt.toISOString(),
      revokedAt: session.revokedAt?.toISOString() ?? null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  async listSessions(userId: string, currentSessionId?: string): Promise<AuthSessionSummaryDto[]> {
    const sessions = await this.authSessionRepository.listSessionsForUser(userId);
    return sessions.map((session) => this.mapSessionSummary(session, currentSessionId));
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    currentSessionId?: string,
    currentTokenJti?: string,
  ): Promise<{ revokedCurrentSession: boolean }> {
    const session = await this.authSessionRepository.getSession(sessionId);

    if (session?.userId !== userId) {
      throw new EntityNotFoundException('Session', sessionId);
    }

    if (!session.revokedAt) {
      await this.authSessionRepository.revokeSession(sessionId);
    }

    const revokedCurrentSession = sessionId === currentSessionId;
    if (revokedCurrentSession) {
      await this.blacklistTokenJti(currentTokenJti);
    }

    this.logger.log(`[Auth] Session revoked: ${sessionId} for user ${userId}`);

    return { revokedCurrentSession };
  }

  async logout(
    userId: string,
    options?: {
      sessionId?: string;
      refreshToken?: string;
      currentTokenJti?: string;
    },
  ): Promise<{ scope: 'current' | 'all'; sessionId?: string }> {
    const resolvedSessionId =
      options?.sessionId ?? this.resolveSessionIdFromRefreshToken(userId, options?.refreshToken);

    if (resolvedSessionId) {
      await this.revokeSession(
        userId,
        resolvedSessionId,
        resolvedSessionId,
        options?.currentTokenJti,
      );
      await this.redisService.del(`refresh_token:${userId}`);
      this.logger.log(`[Auth] Current session logged out: ${userId} (${resolvedSessionId})`);
      return { scope: 'current', sessionId: resolvedSessionId };
    }

    await this.logoutAll(userId, options?.currentTokenJti);
    this.logger.log(
      `[Auth] Fallback logout-all applied for user without session context: ${userId}`,
    );
    return { scope: 'all' };
  }

  async logoutAll(userId: string, currentTokenJti?: string): Promise<void> {
    await this.blacklistUser(userId);
    await this.blacklistTokenJti(currentTokenJti);
    await this.authSessionRepository.revokeAllSessionsForUser(userId);

    // Delete legacy refresh token cache entry if it still exists
    await this.redisService.del(`refresh_token:${userId}`);

    this.logger.log(`[Auth] User logged out from all sessions: ${userId}`);
  }
}
