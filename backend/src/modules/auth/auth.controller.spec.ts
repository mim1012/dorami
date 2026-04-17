import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const createResponse = () => {
    const res = {
      clearCookie: jest.fn(),
      cookie: jest.fn(),
      json: jest.fn((body) => body),
      status: jest.fn().mockReturnThis(),
      redirect: jest.fn(),
    };

    return res as any;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            logout: jest.fn(),
            logoutAll: jest.fn(),
            listSessions: jest.fn(),
            revokeSession: jest.fn(),
            refreshToken: jest.fn(),
            getProfileCompletionStatus: jest.fn(),
            validateDevLoginUser: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                FRONTEND_URL: 'http://localhost:3000',
                NODE_ENV: 'test',
                JWT_ACCESS_EXPIRES_IN: '15m',
                JWT_REFRESH_EXPIRES_IN: '7d',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  it('should revoke the current session on logout and clear auth cookies', async () => {
    authService.logout.mockResolvedValue({ scope: 'current', sessionId: 'session-123' } as any);
    const req = { cookies: { refreshToken: 'refresh-cookie-token' } } as any;
    const res = createResponse();

    const result = (await controller.logout('user-123', 'session-123', 'jti-123', req, res)) as any;

    expect(authService.logout).toHaveBeenCalledWith('user-123', {
      sessionId: 'session-123',
      refreshToken: 'refresh-cookie-token',
      currentTokenJti: 'jti-123',
    });
    expect(res.clearCookie).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
  });

  it('should list sessions for the current user', async () => {
    authService.listSessions.mockResolvedValue([
      { id: 'session-123', current: true, expiresAt: '2026-01-01T00:00:00.000Z', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
    ] as any);

    const result = await controller.listSessions('user-123', 'session-123');

    expect(authService.listSessions).toHaveBeenCalledWith('user-123', 'session-123');
    expect(result).toEqual({
      sessions: [
        expect.objectContaining({
          id: 'session-123',
          current: true,
        }),
      ],
    });
  });

  it('should clear cookies when revoking the current session', async () => {
    authService.revokeSession.mockResolvedValue({ revokedCurrentSession: true });
    const res = createResponse();

    const result = (await controller.revokeSession(
      'user-123',
      'session-123',
      'jti-123',
      'session-123',
      res,
    )) as any;

    expect(authService.revokeSession).toHaveBeenCalledWith(
      'user-123',
      'session-123',
      'session-123',
      'jti-123',
    );
    expect(res.clearCookie).toHaveBeenCalledTimes(2);
    expect(result.data.revokedCurrentSession).toBe(true);
  });

  it('should logout all sessions and clear cookies', async () => {
    authService.logoutAll.mockResolvedValue(undefined);
    const res = createResponse();

    const result = (await controller.logoutAll('user-123', 'jti-123', res)) as any;

    expect(authService.logoutAll).toHaveBeenCalledWith('user-123', 'jti-123');
    expect(res.clearCookie).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
  });
});
