import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { PushNotificationService } from './push-notification.service';
import { KakaoTalkClient } from './clients/kakao-talk.client';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockKakaoTalkClient = {
    sendCustomMessage: jest.fn(),
    sendTemplateMessage: jest.fn(),
  };

  const mockPushNotificationService = {
    sendNotificationToUser: jest.fn(),
  };

  const mockPrisma = {
    notificationTemplate: {
      findFirst: jest.fn(),
    },
  };

  const mockConfig = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        NOTIFICATION_MAX_RETRIES: 2,
        NOTIFICATION_RETRY_DELAY_MS: 10, // fast retries for tests
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: KakaoTalkClient, useValue: mockKakaoTalkClient },
        { provide: PushNotificationService, useValue: mockPushNotificationService },
        { provide: ConfigService, useValue: mockConfig },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    module.get<KakaoTalkClient>(KakaoTalkClient);
    module.get<PushNotificationService>(PushNotificationService);

    jest.clearAllMocks();
  });

  describe('sendOrderCreatedNotification', () => {
    it('should send order notification via KakaoTalk', async () => {
      mockPrisma.notificationTemplate.findFirst.mockResolvedValue({
        type: 'ORDER_CREATED',
        template: '주문이 완료되었습니다. 주문번호: {{orderId}}',
      });
      mockKakaoTalkClient.sendCustomMessage.mockResolvedValue({ success: true });

      await service.sendOrderCreatedNotification('user-1', 'ORD-001');

      expect(mockKakaoTalkClient.sendCustomMessage).toHaveBeenCalledWith(
        'user-1',
        '주문 완료',
        expect.stringContaining('ORD-001'),
      );
    });

    it('should use fallback message when template not found', async () => {
      mockPrisma.notificationTemplate.findFirst.mockResolvedValue(null);
      mockKakaoTalkClient.sendCustomMessage.mockResolvedValue({ success: true });

      await service.sendOrderCreatedNotification('user-1', 'ORD-001');

      expect(mockKakaoTalkClient.sendCustomMessage).toHaveBeenCalledWith(
        'user-1',
        '주문 완료',
        '알림이 도착했습니다.',
      );
    });
  });

  describe('sendPaymentReminderNotification', () => {
    it('should prefer web push when available', async () => {
      mockPrisma.notificationTemplate.findFirst.mockResolvedValue({
        type: 'PAYMENT_REMINDER',
        template: '입금 안내: {{orderId}}, {{amount}}원, 입금자: {{depositorName}}',
      });
      mockPushNotificationService.sendNotificationToUser.mockResolvedValue({
        sent: 1,
        failed: 0,
      });

      await service.sendPaymentReminderNotification('user-1', 'ORD-001', 50000, '홍길동');

      expect(mockPushNotificationService.sendNotificationToUser).toHaveBeenCalledWith(
        'user-1',
        '입금 안내',
        expect.any(String),
        expect.objectContaining({ type: 'payment_reminder', orderId: 'ORD-001' }),
      );
      // KakaoTalk should NOT be called since push succeeded
      expect(mockKakaoTalkClient.sendCustomMessage).not.toHaveBeenCalled();
    });

    it('should fallback to KakaoTalk when web push has no subscribers', async () => {
      mockPrisma.notificationTemplate.findFirst.mockResolvedValue({
        type: 'PAYMENT_REMINDER',
        template: '입금 안내',
      });
      mockPushNotificationService.sendNotificationToUser.mockResolvedValue({
        sent: 0,
        failed: 0,
      });
      mockKakaoTalkClient.sendCustomMessage.mockResolvedValue({ success: true });

      await service.sendPaymentReminderNotification('user-1', 'ORD-001', 50000, '홍길동');

      expect(mockKakaoTalkClient.sendCustomMessage).toHaveBeenCalled();
    });

    it('should fallback to KakaoTalk when web push throws', async () => {
      mockPrisma.notificationTemplate.findFirst.mockResolvedValue({
        type: 'PAYMENT_REMINDER',
        template: '입금 안내',
      });
      mockPushNotificationService.sendNotificationToUser.mockRejectedValue(
        new Error('Push failed'),
      );
      mockKakaoTalkClient.sendCustomMessage.mockResolvedValue({ success: true });

      await service.sendPaymentReminderNotification('user-1', 'ORD-001', 50000, '홍길동');

      expect(mockKakaoTalkClient.sendCustomMessage).toHaveBeenCalled();
    });
  });

  describe('sendShippingNotification', () => {
    it('should prefer web push for shipping notifications', async () => {
      mockPrisma.notificationTemplate.findFirst.mockResolvedValue({
        type: 'SHIPPING_STARTED',
        template: '배송이 시작되었습니다. 주문번호: {{orderId}}, 운송장: {{trackingNumber}}',
      });
      mockPushNotificationService.sendNotificationToUser.mockResolvedValue({
        sent: 1,
        failed: 0,
      });

      await service.sendShippingNotification('user-1', 'ORD-001', 'TRACK-123');

      expect(mockPushNotificationService.sendNotificationToUser).toHaveBeenCalledWith(
        'user-1',
        '배송 시작',
        expect.stringContaining('TRACK-123'),
        expect.objectContaining({ type: 'shipping', trackingNumber: 'TRACK-123' }),
      );
    });
  });

  describe('retry mechanism', () => {
    it('should retry on failure and succeed on second attempt', async () => {
      mockPrisma.notificationTemplate.findFirst.mockResolvedValue({
        type: 'CART_EXPIRED',
        template: '장바구니가 만료되었습니다.',
      });
      mockKakaoTalkClient.sendCustomMessage
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ success: true });

      await service.sendCartExpiredNotification('user-1');

      expect(mockKakaoTalkClient.sendCustomMessage).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries exceeded', async () => {
      mockPrisma.notificationTemplate.findFirst.mockResolvedValue({
        type: 'CART_EXPIRED',
        template: '만료',
      });
      mockKakaoTalkClient.sendCustomMessage.mockRejectedValue(new Error('Persistent error'));

      await expect(service.sendCartExpiredNotification('user-1')).rejects.toThrow(
        'Persistent error',
      );

      // maxRetries = 2 in test config
      expect(mockKakaoTalkClient.sendCustomMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendReservationPromotedNotification', () => {
    it('should send reservation promoted notification', async () => {
      mockPrisma.notificationTemplate.findFirst.mockResolvedValue({
        type: 'RESERVATION_PROMOTED',
        template: '예비번호가 승급되었습니다. 상품: {{productId}}',
      });
      mockKakaoTalkClient.sendCustomMessage.mockResolvedValue({ success: true });

      await service.sendReservationPromotedNotification('user-1', 'product-1');

      expect(mockKakaoTalkClient.sendCustomMessage).toHaveBeenCalledWith(
        'user-1',
        '예비번호 승급',
        expect.stringContaining('product-1'),
      );
    });
  });
});
