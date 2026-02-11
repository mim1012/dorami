import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PushNotificationService } from './push-notification.service';
import { PrismaService } from '../../common/prisma/prisma.service';

// Mock web-push module
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

import * as webpush from 'web-push';

describe('PushNotificationService', () => {
  let service: PushNotificationService;

  const mockPrisma = {
    notificationSubscription: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    liveStream: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    // Set VAPID keys before creating module
    process.env.VAPID_PUBLIC_KEY = 'test-public-key';
    process.env.VAPID_PRIVATE_KEY = 'test-private-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [PushNotificationService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<PushNotificationService>(PushNotificationService);

    jest.clearAllMocks();
  });

  describe('subscribe', () => {
    const userId = 'user-123';
    const subscribeDto = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test',
      p256dh: 'test-p256dh-key',
      auth: 'test-auth-key',
    };

    it('should create a new subscription', async () => {
      mockPrisma.notificationSubscription.upsert.mockResolvedValue({
        id: 'sub-1',
        userId,
        liveStreamId: null,
        createdAt: new Date(),
      });

      const result = await service.subscribe(userId, subscribeDto);

      expect(result.id).toBe('sub-1');
      expect(result.userId).toBe(userId);
      expect(mockPrisma.notificationSubscription.upsert).toHaveBeenCalled();
    });

    it('should verify live stream exists when liveStreamId provided', async () => {
      const dto = { ...subscribeDto, liveStreamId: 'stream-1' };
      mockPrisma.liveStream.findUnique.mockResolvedValue({ id: 'stream-1' });
      mockPrisma.notificationSubscription.upsert.mockResolvedValue({
        id: 'sub-1',
        userId,
        liveStreamId: 'stream-1',
        createdAt: new Date(),
      });

      const result = await service.subscribe(userId, dto);

      expect(mockPrisma.liveStream.findUnique).toHaveBeenCalledWith({
        where: { id: 'stream-1' },
      });
      expect(result.liveStreamId).toBe('stream-1');
    });

    it('should throw NotFoundException for invalid liveStreamId', async () => {
      const dto = { ...subscribeDto, liveStreamId: 'nonexistent' };
      mockPrisma.liveStream.findUnique.mockResolvedValue(null);

      await expect(service.subscribe(userId, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('unsubscribe', () => {
    it('should delete subscription', async () => {
      mockPrisma.notificationSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-123',
      });
      mockPrisma.notificationSubscription.delete.mockResolvedValue({});

      const result = await service.unsubscribe('user-123', 'https://fcm.test/endpoint');

      expect(result.success).toBe(true);
      expect(mockPrisma.notificationSubscription.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if subscription not found', async () => {
      mockPrisma.notificationSubscription.findUnique.mockResolvedValue(null);

      await expect(service.unsubscribe('user-123', 'https://nonexistent/endpoint')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSubscriptions', () => {
    it('should return user subscriptions', async () => {
      mockPrisma.notificationSubscription.findMany.mockResolvedValue([
        { id: 'sub-1', userId: 'user-123', liveStreamId: null, createdAt: new Date() },
      ]);

      const result = await service.getSubscriptions('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sub-1');
    });

    it('should return empty array when no subscriptions', async () => {
      mockPrisma.notificationSubscription.findMany.mockResolvedValue([]);

      const result = await service.getSubscriptions('user-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('sendNotificationToUser', () => {
    it('should send push to all user subscriptions', async () => {
      mockPrisma.notificationSubscription.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          userId: 'user-123',
          endpoint: 'https://fcm/1',
          p256dh: 'key1',
          auth: 'auth1',
        },
        {
          id: 'sub-2',
          userId: 'user-123',
          endpoint: 'https://fcm/2',
          p256dh: 'key2',
          auth: 'auth2',
        },
      ]);
      (webpush.sendNotification as jest.Mock).mockResolvedValue({});

      const result = await service.sendNotificationToUser('user-123', 'Title', 'Body');

      expect(result).toEqual({ sent: 2, failed: 0 });
      expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    });

    it('should return sent=0 when no subscriptions', async () => {
      mockPrisma.notificationSubscription.findMany.mockResolvedValue([]);

      const result = await service.sendNotificationToUser('user-123', 'Title', 'Body');

      expect(result).toEqual({ sent: 0, failed: 0 });
    });

    it('should handle failed push and clean up expired subscriptions', async () => {
      mockPrisma.notificationSubscription.findMany.mockResolvedValue([
        { id: 'sub-1', userId: 'user-123', endpoint: 'https://fcm/1', p256dh: 'k', auth: 'a' },
      ]);
      (webpush.sendNotification as jest.Mock).mockRejectedValue({ statusCode: 410 });
      mockPrisma.notificationSubscription.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.sendNotificationToUser('user-123', 'Title', 'Body');

      expect(result).toEqual({ sent: 0, failed: 1 });
      expect(mockPrisma.notificationSubscription.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['sub-1'] } },
      });
    });
  });

  describe('sendLiveStartNotification', () => {
    it('should send notifications to stream and global subscribers', async () => {
      mockPrisma.liveStream.findUnique.mockResolvedValue({
        id: 'stream-1',
        title: 'Live Now',
        streamKey: 'key-1',
        user: { name: 'Streamer' },
      });
      mockPrisma.notificationSubscription.findMany.mockResolvedValue([
        { id: 'sub-1', userId: 'user-1', endpoint: 'https://fcm/1', p256dh: 'k', auth: 'a' },
      ]);
      (webpush.sendNotification as jest.Mock).mockResolvedValue({});

      const result = await service.sendLiveStartNotification('stream-1');

      expect(result).toEqual({ sent: 1, failed: 0 });
    });

    it('should throw NotFoundException for unknown stream', async () => {
      mockPrisma.liveStream.findUnique.mockResolvedValue(null);

      await expect(service.sendLiveStartNotification('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return 0 when no subscribers', async () => {
      mockPrisma.liveStream.findUnique.mockResolvedValue({
        id: 'stream-1',
        title: 'Live',
        streamKey: 'key-1',
        user: { name: 'Streamer' },
      });
      mockPrisma.notificationSubscription.findMany.mockResolvedValue([]);

      const result = await service.sendLiveStartNotification('stream-1');

      expect(result).toEqual({ sent: 0, failed: 0 });
    });
  });
});
