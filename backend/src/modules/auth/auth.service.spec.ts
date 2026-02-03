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
                JWT_REFRESH_EXPIRES_IN: '7d',
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
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    redisService = module.get<RedisService>(RedisService);
    prismaService = module.get<PrismaService>(PrismaService);
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

      await expect(service.refreshToken(validRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token not found in Redis', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(null);

      await expect(service.refreshToken(validRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);

      await expect(service.refreshToken(validRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return new tokens on successful refresh', async () => {
      const result = await service.refreshToken(validRefreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
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
