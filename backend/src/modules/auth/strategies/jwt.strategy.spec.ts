import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '../../../common/exceptions/business.exception';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import { TokenPayload } from '../dto/auth.dto';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let redisService: { exists: jest.Mock };
  let prismaService: {
    authSession: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
  };

  const basePayload: TokenPayload = {
    sub: 'user-123',
    userId: 'user-123',
    sid: 'session-123',
    email: 'qa@example.com',
    kakaoId: 'kakao-123',
    name: 'QA User',
    role: 'USER',
    profileComplete: true,
    type: 'access',
    jti: 'jti-123',
    exp: Math.floor(Date.now() / 1000) + 900,
  };

  beforeEach(async () => {
    redisService = {
      exists: jest.fn().mockResolvedValue(false),
    };

    prismaService = {
      authSession: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 'user-123',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'ACTIVE',
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') return 'test-secret';
              return undefined;
            }),
          },
        },
        { provide: RedisService, useValue: redisService },
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
  });

  it('accepts an active session-backed access token', async () => {
    const result = await strategy.validate(basePayload);

    expect(prismaService.authSession.findUnique).toHaveBeenCalledWith({
      where: { id: 'session-123' },
      select: { userId: true, revokedAt: true, expiresAt: true },
    });
    expect(result).toMatchObject({
      userId: 'user-123',
      sessionId: 'session-123',
      tokenJti: 'jti-123',
      email: 'qa@example.com',
    });
  });

  it('rejects a revoked session immediately', async () => {
    prismaService.authSession.findUnique.mockResolvedValue({
      userId: 'user-123',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(strategy.validate(basePayload)).rejects.toThrow(UnauthorizedException);
    await expect(strategy.validate(basePayload)).rejects.toThrow('Token has been revoked');
  });

  it('rejects a token whose session belongs to another user', async () => {
    prismaService.authSession.findUnique.mockResolvedValue({
      userId: 'other-user',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(strategy.validate(basePayload)).rejects.toThrow('Token has been revoked');
  });

  it('keeps backward compatibility when sid is missing', async () => {
    const payloadWithoutSid: TokenPayload = {
      ...basePayload,
      sid: undefined,
    };

    const result = await strategy.validate(payloadWithoutSid);

    expect(prismaService.authSession.findUnique).not.toHaveBeenCalled();
    expect(result.sessionId).toBeUndefined();
  });
});
