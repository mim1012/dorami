import { Injectable } from '@nestjs/common';
import { AuthSession } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface AuthSessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
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
}

export interface CreateAuthSessionInput {
  id: string;
  userId: string;
  refreshTokenHash: string;
  familyId?: string | null;
  deviceName?: string | null;
  deviceType?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  lastUsedAt?: Date | null;
  expiresAt: Date;
  revokedAt?: Date | null;
}

@Injectable()
export class AuthSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(session: AuthSession): AuthSessionRecord {
    return {
      id: session.id,
      userId: session.userId,
      refreshTokenHash: session.refreshTokenHash,
      familyId: session.familyId,
      deviceName: session.deviceName,
      deviceType: session.deviceType,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  async createSession(input: CreateAuthSessionInput): Promise<AuthSessionRecord> {
    const session = await this.prisma.authSession.create({
      data: {
        id: input.id,
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        familyId: input.familyId,
        deviceName: input.deviceName,
        deviceType: input.deviceType,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
        lastUsedAt: input.lastUsedAt,
        expiresAt: input.expiresAt,
        revokedAt: input.revokedAt,
      },
    });

    return this.toRecord(session);
  }

  async getSession(sessionId: string): Promise<AuthSessionRecord | null> {
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
    });

    return session ? this.toRecord(session) : null;
  }

  async updateRefreshToken(
    sessionId: string,
    refreshTokenHash: string,
    expiresAt: Date,
    lastUsedAt?: Date,
  ): Promise<void> {
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash,
        expiresAt,
        ...(lastUsedAt ? { lastUsedAt } : {}),
      },
    });
  }

  async touchSession(sessionId: string, lastUsedAt: Date): Promise<void> {
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: { lastUsedAt },
    });
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessionsForUser(userId: string): Promise<number> {
    const result = await this.prisma.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return result.count;
  }

  async listSessionsForUser(userId: string): Promise<AuthSessionRecord[]> {
    const sessions = await this.prisma.authSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map((session) => this.toRecord(session));
  }
}
