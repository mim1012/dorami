import { createHash } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { UnauthorizedException } from '../../common/exceptions/business.exception';
import { AuthSessionRepository } from './auth-session.repository';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let redisService: RedisService;
  let prismaService: PrismaService;
  let authSessionRepository: AuthSessionRepository;

  const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

  const mockUser = {
    id: 'user-123',
    kakaoId: 'kakao-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER',
    status: 'ACTIVE',
    kakaoPhone: null,
    instagramId: null,
    depositorName: null,
    shippingAddress: null,
    profileCompletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const mockTokenPayload = {
    sub: 'user-123',
    userId: 'user-123',
    sid: 'session-123',
    email: 'test@example.com',
    kakaoId: 'kakao-123',
    name: 'Test User',
    role: 'USER',
    type: 'refresh',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest
              .fn()
              .mockReturnValueOnce('mock-access-token')
              .mockReturnValueOnce('mock-refresh-token'),
            verify: jest.fn().mockReturnValue(mockTokenPayload),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                ADMIN_EMAILS: '',
                JWT_ACCESS_EXPIRES_IN: '15m',
                JWT_REFRESH_EXPIRES_IN: '30d',
                AUTH_BLACKLIST_TTL_SECONDS: '900',
                JWT_EXPIRY_HOURS: '24',
              };
              return config[key] || defaultValue;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              upsert: jest.fn(),
            },
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            exists: jest.fn(),
            getClient: jest.fn().mockReturnValue({
              set: jest.fn().mockResolvedValue('OK'),
              del: jest.fn().mockResolvedValue(1),
            }),
          },
        },
        {
          provide: AuthSessionRepository,
          useValue: {
            createSession: jest.fn(),
            getSession: jest.fn(),
            updateRefreshToken: jest.fn(),
            revokeAllSessionsForUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    redisService = module.get<RedisService>(RedisService);
    prismaService = module.get<PrismaService>(PrismaService);
    authSessionRepository = module.get<AuthSessionRepository>(AuthSessionRepository);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should generate access and refresh tokens with the same sid', async () => {
      const result = await service.login(mockUser as any);

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: expect.objectContaining({
          id: mockUser.id,
          kakaoId: mockUser.kakaoId,
          email: mockUser.email,
          name: mockUser.name,
          role: mockUser.role,
          profileComplete: false,
        }),
      });

      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      const accessPayload = (jwtService.sign as jest.Mock).mock.calls[0][0];
      const refreshPayload = (jwtService.sign as jest.Mock).mock.calls[1][0];

      expect(accessPayload.sid).toBeDefined();
      expect(refreshPayload.sid).toBe(accessPayload.sid);
      expect(accessPayload.type).toBe('access');
      expect(refreshPayload.type).toBe('refresh');
    });

    it('should create an auth session using the hashed refresh token', async () => {
      await service.login(mockUser as any);

      expect(authSessionRepository.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          userId: mockUser.id,
          refreshTokenHash: hashToken('mock-refresh-token'),
          expiresAt: expect.any(Date),
          lastUsedAt: expect.any(Date),
        }),
      );
      expect(redisService.set).not.toHaveBeenCalledWith(
        `refresh_token:${mockUser.id}`,
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('refreshToken', () => {
    const validRefreshToken = 'valid-refresh-token';
    const refreshedAccessToken = 'rotated-access-token';
    const refreshedRefreshToken = 'rotated-refresh-token';

    beforeEach(() => {
      (jwtService.sign as jest.Mock)
        .mockReset()
        .mockReturnValueOnce(refreshedAccessToken)
        .mockReturnValueOnce(refreshedRefreshToken);
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(authSessionRepository, 'getSession').mockResolvedValue({
        id: 'session-123',
        userId: mockUser.id,
        refreshTokenHash: hashToken(validRefreshToken),
        familyId: null,
        deviceName: null,
        deviceType: null,
        userAgent: null,
        ipAddress: null,
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should rotate tokens by session id and keep the response shape stable', async () => {
      const result = await service.refreshToken(validRefreshToken);

      expect(authSessionRepository.getSession).toHaveBeenCalledWith('session-123');
      expect(authSessionRepository.updateRefreshToken).toHaveBeenCalledWith(
        'session-123',
        hashToken(refreshedRefreshToken),
        expect.any(Date),
        expect.any(Date),
      );
      expect(redisService.set).toHaveBeenCalledWith(
        'refresh_result:session-123',
        JSON.stringify(result),
        30,
      );
      expect(result).toEqual({
        accessToken: refreshedAccessToken,
        refreshToken: refreshedRefreshToken,
        user: expect.objectContaining({
          id: mockUser.id,
          kakaoId: mockUser.kakaoId,
          email: mockUser.email,
          name: mockUser.name,
          role: mockUser.role,
          profileComplete: false,
        }),
      });
    });

    it('should reject refresh tokens without a session id claim', async () => {
      jest.spyOn(jwtService, 'verify').mockReturnValue({
        ...mockTokenPayload,
        sid: undefined,
      });

      const refreshPromise = service.refreshToken(validRefreshToken);
      await expect(refreshPromise).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(refreshPromise).rejects.toThrow('Invalid refresh token');
    });

    it('should reject refresh tokens whose hash does not match the stored session hash', async () => {
      jest.spyOn(authSessionRepository, 'getSession').mockResolvedValue({
        id: 'session-123',
        userId: mockUser.id,
        refreshTokenHash: hashToken('different-token'),
        familyId: null,
        deviceName: null,
        deviceType: null,
        userAgent: null,
        ipAddress: null,
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(service.refreshToken(validRefreshToken)).rejects.toThrow(UnauthorizedException);
      expect(authSessionRepository.updateRefreshToken).not.toHaveBeenCalled();
    });

    it('should reuse cached refresh result during cross-instance lock contention by session id', async () => {
      jest.useFakeTimers();

      const cachedResult = {
        accessToken: 'cached-access-token',
        refreshToken: 'cached-refresh-token',
        user: {
          id: mockUser.id,
          kakaoId: mockUser.kakaoId,
          email: mockUser.email,
          name: mockUser.name,
          role: mockUser.role,
          profileComplete: false,
        },
      };

      const redisClient = redisService.getClient() as unknown as { set: jest.Mock };
      redisClient.set.mockResolvedValueOnce(null);

      let cacheReads = 0;
      jest.spyOn(redisService, 'get').mockImplementation((key: string) => {
        if (key === 'refresh_result:session-123') {
          cacheReads += 1;
          return Promise.resolve(cacheReads >= 3 ? JSON.stringify(cachedResult) : null);
        }

        return Promise.resolve(null);
      });

      const refreshPromise = service.refreshToken(validRefreshToken);

      await jest.advanceTimersByTimeAsync(500);

      await expect(refreshPromise).resolves.toEqual(cachedResult);
      expect(redisService.get).toHaveBeenCalledWith('refresh_result:session-123');
      expect(authSessionRepository.getSession).not.toHaveBeenCalled();
    });

    it('should fail after the contention grace window if no cached refresh result appears', async () => {
      jest.useFakeTimers();

      const redisClient = redisService.getClient() as unknown as { set: jest.Mock };
      redisClient.set.mockResolvedValueOnce(null);
      jest.spyOn(redisService, 'get').mockResolvedValue(null);

      const refreshPromise = service.refreshToken(validRefreshToken);
      const guardedRefreshPromise = refreshPromise.catch((error) => error);

      await jest.advanceTimersByTimeAsync(4500);

      const error = await guardedRefreshPromise;
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.message).toBe('Invalid refresh token');
      expect(redisService.get).toHaveBeenCalledWith('refresh_result:session-123');
    });

    it('should wrap expired JWT verification failures', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refreshToken(validRefreshToken)).rejects.toThrow(
        'Invalid or expired refresh token',
      );
    });

    it('should propagate invalid token type errors', async () => {
      jest.spyOn(jwtService, 'verify').mockReturnValue({
        ...mockTokenPayload,
        type: 'access',
      });

      await expect(service.refreshToken(validRefreshToken)).rejects.toThrow('Invalid token type');
    });

    it('should propagate user not found errors', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);

      await expect(service.refreshToken(validRefreshToken)).rejects.toThrow('User not found');
    });
  });

  describe('validateKakaoUser', () => {
    const kakaoProfile = {
      kakaoId: 'kakao-real-456',
      nickname: 'Test User',
    };

    it('should only look up users by kakaoId', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prismaService.user, 'create').mockResolvedValue(mockUser as any);

      const result = await service.validateKakaoUser(kakaoProfile);

      expect(result.id).toBe(mockUser.id);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { kakaoId: kakaoProfile.kakaoId },
      });
    });

    it('should update an existing kakao user without changing kakaoId', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(mockUser as any);
      jest.spyOn(prismaService.user, 'update').mockResolvedValue(mockUser as any);

      await service.validateKakaoUser({ kakaoId: 'kakao-123', nickname: 'Updated Name' });

      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Updated Name',
          }),
        }),
      );
    });
  });

  describe('logout', () => {
    it('should blacklist the user and revoke all auth sessions', async () => {
      await service.logout(mockUser.id);

      expect(redisService.set).toHaveBeenCalledWith(`blacklist:${mockUser.id}`, 'true', expect.any(Number));
      expect(authSessionRepository.revokeAllSessionsForUser).toHaveBeenCalledWith(mockUser.id);
      expect(redisService.del).toHaveBeenCalledWith(`refresh_token:${mockUser.id}`);
    });
  });
});
