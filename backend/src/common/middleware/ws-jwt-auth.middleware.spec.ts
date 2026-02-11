import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';

// Mock ioredis before importing the middleware
const mockRedisExists = jest.fn();
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    exists: mockRedisExists,
  }));
});

import { authenticateSocket } from './ws-jwt-auth.middleware';

describe('ws-jwt-auth middleware', () => {
  let mockJwtService: Partial<JwtService>;

  const validPayload = {
    userId: 'user-123',
    email: 'test@example.com',
    role: 'USER',
    type: 'access',
    jti: 'token-jti-123',
  };

  beforeEach(() => {
    mockJwtService = {
      verifyAsync: jest.fn().mockResolvedValue(validPayload),
    };
    mockRedisExists.mockResolvedValue(0); // not blacklisted
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function createMockSocket(token?: string, authMethod: 'auth' | 'header' = 'auth') {
    const socket: any = {
      handshake: {
        auth: {},
        headers: {},
      },
    };
    if (token && authMethod === 'auth') {
      socket.handshake.auth.token = token;
    }
    if (token && authMethod === 'header') {
      socket.handshake.headers.authorization = `Bearer ${token}`;
    }
    return socket;
  }

  describe('authenticateSocket', () => {
    it('should authenticate socket with token from auth object', async () => {
      const socket = createMockSocket('valid-token', 'auth');

      const result = await authenticateSocket(socket, mockJwtService as JwtService);

      expect(result.user.userId).toBe('user-123');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.role).toBe('USER');
    });

    it('should authenticate socket with token from authorization header', async () => {
      const socket = createMockSocket('valid-token', 'header');

      const result = await authenticateSocket(socket, mockJwtService as JwtService);

      expect(result.user.userId).toBe('user-123');
    });

    it('should throw WsException when no token provided', async () => {
      const socket = createMockSocket();

      await expect(authenticateSocket(socket, mockJwtService as JwtService)).rejects.toThrow(
        WsException,
      );
    });

    it('should throw WsException when token verification fails', async () => {
      const socket = createMockSocket('invalid-token');
      (mockJwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error('invalid token'));

      await expect(authenticateSocket(socket, mockJwtService as JwtService)).rejects.toThrow(
        WsException,
      );
    });

    it('should throw WsException when token type is not access', async () => {
      const socket = createMockSocket('refresh-token');
      (mockJwtService.verifyAsync as jest.Mock).mockResolvedValue({
        ...validPayload,
        type: 'refresh',
      });

      await expect(authenticateSocket(socket, mockJwtService as JwtService)).rejects.toThrow(
        WsException,
      );
    });

    it('should throw WsException when token is blacklisted', async () => {
      const socket = createMockSocket('blacklisted-token');
      mockRedisExists.mockResolvedValue(1);

      await expect(authenticateSocket(socket, mockJwtService as JwtService)).rejects.toThrow(
        WsException,
      );
    });

    it('should allow access when Redis is unavailable (graceful degradation)', async () => {
      const socket = createMockSocket('valid-token');
      mockRedisExists.mockRejectedValue(new Error('Redis down'));

      const result = await authenticateSocket(socket, mockJwtService as JwtService);

      expect(result.user.userId).toBe('user-123');
    });
  });
});
