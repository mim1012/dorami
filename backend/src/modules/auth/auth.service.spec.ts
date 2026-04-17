import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { UnauthorizedException } from '../../common/exceptions/business.exception';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let redisService: RedisService;
  let prismaService: PrismaService;

  const mockUser = {
    id: 'user-123',
    kakaoId: 'kakao-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER',
    status: 'ACTIVE',
    instagramId: null,
    depositorName: null,
    shippingAddress: null,
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
    role: 'USER',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-token'),
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
            },
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            getClient: jest.fn().mockReturnValue({
              set: jest.fn().mockResolvedValue('OK'),
              del: jest.fn().mockResolvedValue(1),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    redisService = module.get<RedisService>(RedisService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should generate access and refresh tokens', async () => {
      const result = await service.login(mockUser as any);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.id).toBe(mockUser.id);
    });

    it('should store refresh token in Redis', async () => {
      await service.login(mockUser as any);

      expect(redisService.set).toHaveBeenCalledWith(
        `refresh_token:${mockUser.id}`,
        expect.any(String),
        expect.any(Number),
      );
    });
  });


    it('should include the same sid in issued access and refresh tokens', async () => {
      await service.login(mockUser as any);

      expect(jwtService.sign).toHaveBeenCalledTimes(2);

      const accessPayload = (jwtService.sign as jest.Mock).mock.calls[0][0];
      const refreshPayload = (jwtService.sign as jest.Mock).mock.calls[1][0];

      expect(accessPayload.sid).toBeDefined();
      expect(refreshPayload.sid).toBe(accessPayload.sid);
      expect(accessPayload.type).toBe('access');
      expect(refreshPayload.type).toBe('refresh');
    });

  describe('refreshToken', () => {
    const validRefreshToken = 'valid-refresh-token';

    beforeEach(() => {
      jest.spyOn(redisService, 'get').mockResolvedValue(validRefreshToken);
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
    });

    it('should delete old token before issuing new one (Token Rotation)', async () => {
      const delSpy = jest.spyOn(redisService, 'del');
      const setSpy = jest.spyOn(redisService, 'set');

      await service.refreshToken(validRefreshToken);

      // Verify deletion happens
      expect(delSpy).toHaveBeenCalledWith(`refresh_token:${mockUser.id}`);

      // Verify deletion is called before set (Token Rotation)
      const delCallOrder = delSpy.mock.invocationCallOrder[0];
      const setCallOrder = setSpy.mock.invocationCallOrder[0];
      expect(delCallOrder).toBeLessThan(setCallOrder);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue('different-token');

      await expect(service.refreshToken(validRefreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if token not found in Redis', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(null);

      await expect(service.refreshToken(validRefreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);

      await expect(service.refreshToken(validRefreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should wrap expired JWT error as "Invalid or expired refresh token"', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('jwt expired');
      });

      const error = await service.refreshToken(validRefreshToken).catch((e) => e);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.message).toBe('Invalid or expired refresh token');
    });

    it('should propagate UnauthorizedException with "Invalid token type" message', async () => {
      jest.spyOn(jwtService, 'verify').mockReturnValue({
        ...mockTokenPayload,
        type: 'access', // wrong type — triggers 'Invalid token type'
      });

      const error = await service.refreshToken(validRefreshToken).catch((e) => e);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.message).toBe('Invalid token type');
    });

    it('should propagate UnauthorizedException with "User not found" message', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);

      const error = await service.refreshToken(validRefreshToken).catch((e) => e);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.message).toBe('User not found');
    });

    it('should return new tokens on successful refresh', async () => {
      const result = await service.refreshToken(validRefreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
    });

    it('should reuse cached refresh result during cross-instance lock contention', async () => {
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

      const redisClient = redisService.getClient() as unknown as {
        set: jest.Mock;
      };
      redisClient.set.mockResolvedValueOnce(null);

      let cacheReads = 0;
      jest.spyOn(redisService, 'get').mockImplementation(async (key: string) => {
        if (key === `refresh_result:${mockUser.id}`) {
          cacheReads += 1;
          return cacheReads >= 3 ? JSON.stringify(cachedResult) : null;
        }

        return validRefreshToken;
      });

      const refreshPromise = service.refreshToken(validRefreshToken);

      await jest.advanceTimersByTimeAsync(500);

      await expect(refreshPromise).resolves.toEqual(cachedResult);
      expect(redisService.get).toHaveBeenCalledWith(`refresh_result:${mockUser.id}`);
    });

    it('should fail after the contention grace window if no cached refresh result appears', async () => {
      jest.useFakeTimers();

      const redisClient = redisService.getClient() as unknown as {
        set: jest.Mock;
      };
      redisClient.set.mockResolvedValueOnce(null);
      jest.spyOn(redisService, 'get').mockResolvedValue(null);

      const refreshPromise = service.refreshToken(validRefreshToken);

      await jest.advanceTimersByTimeAsync(4500);

      const error = await refreshPromise.catch((e) => e);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.message).toBe('Invalid refresh token');
    });
  });

  describe('validateKakaoUser', () => {
    const kakaoProfile = {
      kakaoId: 'kakao-real-456',
      email: 'test@example.com',
      nickname: 'Test User',
    };

    it('should NOT find users by email (email no longer collected from Kakao)', async () => {
      // As of Task #5, email is not collected from Kakao OAuth per privacy policy.
      // Users must provide their own email when completing their profile.
      // This test verifies that validateKakaoUser only looks up by kakaoId, not email.
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null); // no user with this kakaoId
      jest.spyOn(prismaService.user, 'create').mockResolvedValue(mockUser as any);

      const result = await service.validateKakaoUser(kakaoProfile);

      // User should be created (not found by email, since email isn't collected)
      expect(result.id).toBe(mockUser.id);
      expect(prismaService.user.create).toHaveBeenCalled();
    });

    it('should find existing user by kakaoId when email not provided', async () => {
      const profileNoEmail = { kakaoId: 'kakao-123', nickname: 'Test User' };
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(mockUser as any); // kakaoId lookup
      jest.spyOn(prismaService.user, 'update').mockResolvedValue(mockUser as any);

      const result = await service.validateKakaoUser(profileNoEmail);

      expect(result.id).toBe(mockUser.id);
      // kakaoId should NOT be updated in data (not found by email)
      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ kakaoId: expect.anything() }),
        }),
      );
    });

    it('should create new user when no email and no kakaoId match', async () => {
      const profileNoEmail = { kakaoId: 'kakao-new-999', nickname: 'New User' };
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(null); // kakaoId lookup
      jest.spyOn(prismaService.user, 'create').mockResolvedValue({
        ...mockUser,
        kakaoId: 'kakao-new-999',
        email: null,
      } as any);

      const result = await service.validateKakaoUser(profileNoEmail);

      expect(prismaService.user.create).toHaveBeenCalled();
      expect(result.kakaoId).toBe('kakao-new-999');
    });

    it('should skip kakaoId update when another user already owns that kakaoId', async () => {
      const existingUser = { ...mockUser, id: 'user-A', kakaoId: 'dev_placeholder' };
      const conflictUser = { ...mockUser, id: 'user-B', kakaoId: 'kakao-real-456' };
      const updatedUser = { ...existingUser }; // kakaoId unchanged

      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValueOnce(existingUser as any) // email lookup
        .mockResolvedValueOnce(conflictUser as any); // conflict check
      jest.spyOn(prismaService.user, 'update').mockResolvedValue(updatedUser as any);

      await service.validateKakaoUser(kakaoProfile);

      // update should be called without kakaoId in data
      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ kakaoId: expect.anything() }),
        }),
      );
    });

    it('should not update kakaoId when user already has the correct kakaoId', async () => {
      const existingUser = { ...mockUser, kakaoId: 'kakao-real-456' };
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(existingUser as any); // email lookup finds user with same kakaoId
      jest.spyOn(prismaService.user, 'update').mockResolvedValue(existingUser as any);

      await service.validateKakaoUser(kakaoProfile);

      // No conflict check needed, update called without kakaoId (same value, no change)
      expect(prismaService.user.update).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should add user to blacklist', async () => {
      await service.logout(mockUser.id);

      expect(redisService.set).toHaveBeenCalledWith(
        `blacklist:${mockUser.id}`,
        'true',
        expect.anything(), // TTL can be string or number from config
      );
    });

    it('should delete refresh token from Redis', async () => {
      await service.logout(mockUser.id);

      expect(redisService.del).toHaveBeenCalledWith(`refresh_token:${mockUser.id}`);
    });
  });
});
