import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { AuthenticatedSocket } from '../../common/middleware/ws-jwt-auth.middleware';

describe('ChatGateway', () => {
  let gateway: ChatGateway;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  const mockJwtService = {
    verifyAsync: jest.fn(),
  };

  const createMockClient = (userId = 'user-123'): AuthenticatedSocket => {
    return {
      id: 'socket-1',
      user: { userId, email: 'test@test.com', role: 'USER' },
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      disconnect: jest.fn(),
      handshake: {
        auth: { token: 'valid-token' },
        headers: {},
      },
    } as unknown as AuthenticatedSocket;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatGateway, { provide: JwtService, useValue: mockJwtService }],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    (gateway as any).server = mockServer;

    jest.clearAllMocks();
  });

  describe('handleJoinRoom', () => {
    it('should join the room and notify members', async () => {
      const client = createMockClient();
      const payload = { liveId: 'live-1' };

      const result = await gateway.handleJoinRoom(client, payload);

      expect(client.join).toHaveBeenCalledWith('live:live-1');
      expect(mockServer.to).toHaveBeenCalledWith('live:live-1');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'chat:user-joined',
        expect.objectContaining({
          type: 'chat:user-joined',
          data: expect.objectContaining({
            userId: 'user-123',
            liveId: 'live-1',
          }),
        }),
      );
      expect(result.type).toBe('chat:join-room:success');
    });
  });

  describe('handleLeaveRoom', () => {
    it('should leave the room and notify members', async () => {
      const client = createMockClient();
      const payload = { liveId: 'live-1' };

      const result = await gateway.handleLeaveRoom(client, payload);

      expect(client.leave).toHaveBeenCalledWith('live:live-1');
      expect(mockServer.to).toHaveBeenCalledWith('live:live-1');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'chat:user-left',
        expect.objectContaining({
          type: 'chat:user-left',
        }),
      );
      expect(result.type).toBe('chat:leave-room:success');
    });
  });

  describe('handleSendMessage', () => {
    it('should broadcast sanitized message to room', async () => {
      const client = createMockClient();
      const payload = { liveId: 'live-1', message: 'Hello everyone!' };

      const result = await gateway.handleSendMessage(client, payload);

      expect(mockServer.to).toHaveBeenCalledWith('live:live-1');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'chat:message',
        expect.objectContaining({
          type: 'chat:message',
          data: expect.objectContaining({
            liveId: 'live-1',
            userId: 'user-123',
            message: 'Hello everyone!',
          }),
        }),
      );
      expect(result.type).toBe('chat:send-message:success');
    });

    it('should strip HTML tags from message (XSS prevention)', async () => {
      const client = createMockClient();
      const payload = {
        liveId: 'live-1',
        message: '<script>alert("xss")</script>Hello',
      };

      await gateway.handleSendMessage(client, payload);

      expect(mockServer.emit).toHaveBeenCalledWith(
        'chat:message',
        expect.objectContaining({
          data: expect.objectContaining({
            message: 'alert("xss")Hello',
          }),
        }),
      );
    });

    it('should reject empty message', async () => {
      const client = createMockClient();
      const payload = { liveId: 'live-1', message: '' };

      await gateway.handleSendMessage(client, payload);

      expect(client.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          errorCode: 'INVALID_MESSAGE',
        }),
      );
      expect(mockServer.to).not.toHaveBeenCalled();
    });

    it('should reject non-string message', async () => {
      const client = createMockClient();
      const payload = { liveId: 'live-1', message: null as any };

      await gateway.handleSendMessage(client, payload);

      expect(client.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          errorCode: 'INVALID_MESSAGE',
        }),
      );
    });

    it('should reject message over 500 characters', async () => {
      const client = createMockClient();
      const payload = { liveId: 'live-1', message: 'a'.repeat(501) };

      await gateway.handleSendMessage(client, payload);

      expect(client.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          errorCode: 'MESSAGE_TOO_LONG',
        }),
      );
    });

    it('should reject message that becomes empty after HTML stripping', async () => {
      const client = createMockClient();
      const payload = { liveId: 'live-1', message: '<div></div>' };

      await gateway.handleSendMessage(client, payload);

      expect(client.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          errorCode: 'MESSAGE_TOO_LONG',
        }),
      );
    });
  });

  describe('handleDisconnect', () => {
    it('should log disconnection without error', () => {
      const client = createMockClient();

      expect(() => gateway.handleDisconnect(client)).not.toThrow();
    });
  });
});
