import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { KakaoTalkClient } from './clients/kakao-talk.client';
import { PushNotificationService } from './push-notification.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let kakaoTalkClient: KakaoTalkClient;
  let pushNotificationService: PushNotificationService;
  let prismaService: PrismaService;

  const mockTemplate = {
    id: 'template-1',
    type: 'ORDER_CREATED',
    template: '주문번호 {{orderId}}가 접수되었습니다.',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: KakaoTalkClient,
          useValue: {
            sendCustomMessage: jest.fn().mockResolvedValue({ success: true }),
            sendTemplateMessage: jest.fn().mockResolvedValue({ success: true }),
          },
        },
        {
          provide: PushNotificationService,
          useValue: {
            sendNotificationToUser: jest.fn().mockResolvedValue({ sent: 1, failed: 0 }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                NOTIFICATION_MAX_RETRIES: 3,
                NOTIFICATION_RETRY_DELAY_MS: 10, // fast for tests
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            notificationTemplate: {
              findFirst: jest.fn().mockResolvedValue(mockTemplate),
            },
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    kakaoTalkClient = module.get<KakaoTalkClient>(KakaoTalkClient);
    pushNotificationService = module.get<PushNotificationService>(PushNotificationService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendOrderCreatedNotification', () => {
    it('should send order created notification via KakaoTalk', async () => {
      await service.sendOrderCreatedNotification('user-1', 'ORD-20260212-00001');

      expect(kakaoTalkClient.sendCustomMessage).toHaveBeenCalledWith(
        'user-1',
        '주문 완료',
        '주문번호 ORD-20260212-00001가 접수되었습니다.',
      );
    });

    it('should use fallback message when template not found', async () => {
      jest.spyOn(prismaService.notificationTemplate, 'findFirst').mockResolvedValue(null);

      await service.sendOrderCreatedNotification('user-1', 'ORD-001');

      expect(kakaoTalkClient.sendCustomMessage).toHaveBeenCalledWith(
        'user-1',
        '주문 완료',
        '알림이 도착했습니다.',
      );
    });
  });

  describe('sendReservationPromotedNotification', () => {
    it('should send reservation promoted notification', async () => {
      jest.spyOn(prismaService.notificationTemplate, 'findFirst').mockResolvedValue({
        ...mockTemplate,
        type: 'RESERVATION_PROMOTED',
        template: '상품 {{productId}} 구매 기회가 생겼습니다!',
      } as any);

      await service.sendReservationPromotedNotification('user-1', 'product-1');

      expect(kakaoTalkClient.sendCustomMessage).toHaveBeenCalledWith(
        'user-1',
        '예비번호 승급',
        '상품 product-1 구매 기회가 생겼습니다!',
      );
    });
  });

  describe('sendPaymentConfirmedNotification', () => {
    it('should send payment confirmed notification', async () => {
      jest.spyOn(prismaService.notificationTemplate, 'findFirst').mockResolvedValue({
        ...mockTemplate,
        type: 'PAYMENT_CONFIRMED',
        template: '주문 {{orderId}} 입금이 확인되었습니다.',
      } as any);

      await service.sendPaymentConfirmedNotification('user-1', 'ORD-001');

      expect(kakaoTalkClient.sendCustomMessage).toHaveBeenCalledWith(
        'user-1',
        '결제 확인 완료',
        '주문 ORD-001 입금이 확인되었습니다.',
      );
    });
  });

  describe('sendPaymentReminderNotification - dual channel', () => {
    it('should send via web push first when available', async () => {
      jest.spyOn(prismaService.notificationTemplate, 'findFirst').mockResolvedValue({
        ...mockTemplate,
        type: 'PAYMENT_REMINDER',
        template: '주문 {{orderId}} 입금 바랍니다. 금액: {{amount}}원',
      } as any);

      await service.sendPaymentReminderNotification('user-1', 'ORD-001', 50000, '홍길동');

      // Web push called first
      expect(pushNotificationService.sendNotificationToUser).toHaveBeenCalledWith(
        'user-1',
        '입금 안내',
        expect.stringContaining('ORD-001'),
        expect.objectContaining({ type: 'payment_reminder', orderId: 'ORD-001' }),
      );
      // KakaoTalk should NOT be called since web push succeeded
      expect(kakaoTalkClient.sendCustomMessage).not.toHaveBeenCalled();
    });

    it('should fallback to KakaoTalk when web push fails', async () => {
      jest
        .spyOn(pushNotificationService, 'sendNotificationToUser')
        .mockRejectedValue(new Error('Push failed'));
      jest.spyOn(prismaService.notificationTemplate, 'findFirst').mockResolvedValue({
        ...mockTemplate,
        type: 'PAYMENT_REMINDER',
        template: '입금 안내 - 주문 {{orderId}}',
      } as any);

      await service.sendPaymentReminderNotification('user-1', 'ORD-001', 50000, '홍길동');

      expect(kakaoTalkClient.sendCustomMessage).toHaveBeenCalledWith(
        'user-1',
        '결제 알림',
        '입금 안내 - 주문 ORD-001',
      );
    });

    it('should fallback to KakaoTalk when web push has no subscribers', async () => {
      jest.spyOn(pushNotificationService, 'sendNotificationToUser').mockResolvedValue({
        sent: 0,
        failed: 0,
      });
      jest.spyOn(prismaService.notificationTemplate, 'findFirst').mockResolvedValue({
        ...mockTemplate,
        type: 'PAYMENT_REMINDER',
        template: '입금 안내',
      } as any);

      await service.sendPaymentReminderNotification('user-1', 'ORD-001', 50000, '홍길동');

      expect(kakaoTalkClient.sendCustomMessage).toHaveBeenCalled();
    });
  });

  describe('sendShippingNotification - dual channel', () => {
    it('should send via web push first', async () => {
      jest.spyOn(prismaService.notificationTemplate, 'findFirst').mockResolvedValue({
        ...mockTemplate,
        type: 'SHIPPING_STARTED',
        template: '주문 {{orderId}} 배송이 시작되었습니다. 운송장: {{trackingNumber}}',
      } as any);

      await service.sendShippingNotification('user-1', 'ORD-001', '1234567890');

      expect(pushNotificationService.sendNotificationToUser).toHaveBeenCalledWith(
        'user-1',
        '배송 시작',
        expect.stringContaining('1234567890'),
        expect.objectContaining({ type: 'shipping', trackingNumber: '1234567890' }),
      );
    });

    it('should fallback to KakaoTalk when web push fails', async () => {
      jest
        .spyOn(pushNotificationService, 'sendNotificationToUser')
        .mockRejectedValue(new Error('Push failed'));
      jest.spyOn(prismaService.notificationTemplate, 'findFirst').mockResolvedValue({
        ...mockTemplate,
        type: 'SHIPPING_STARTED',
        template: '배송 시작 - {{orderId}}',
      } as any);

      await service.sendShippingNotification('user-1', 'ORD-001', '1234567890');

      expect(kakaoTalkClient.sendCustomMessage).toHaveBeenCalledWith(
        'user-1',
        '배송 시작',
        '배송 시작 - ORD-001',
      );
    });
  });

  describe('retry mechanism', () => {
    it('should retry on failure and succeed on second attempt', async () => {
      jest
        .spyOn(kakaoTalkClient, 'sendCustomMessage')
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ success: true });

      await service.sendOrderCreatedNotification('user-1', 'ORD-001');

      expect(kakaoTalkClient.sendCustomMessage).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries exhausted', async () => {
      jest
        .spyOn(kakaoTalkClient, 'sendCustomMessage')
        .mockRejectedValue(new Error('Persistent failure'));

      await expect(service.sendOrderCreatedNotification('user-1', 'ORD-001')).rejects.toThrow(
        'Persistent failure',
      );

      expect(kakaoTalkClient.sendCustomMessage).toHaveBeenCalledTimes(3); // maxRetries = 3
    });

    it('should succeed on third (final) attempt', async () => {
      jest
        .spyOn(kakaoTalkClient, 'sendCustomMessage')
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce({ success: true });

      await service.sendOrderCreatedNotification('user-1', 'ORD-001');

      expect(kakaoTalkClient.sendCustomMessage).toHaveBeenCalledTimes(3);
    });
  });

  describe('template variable replacement', () => {
    it('should replace multiple variables in template', async () => {
      jest.spyOn(prismaService.notificationTemplate, 'findFirst').mockResolvedValue({
        ...mockTemplate,
        type: 'PAYMENT_REMINDER',
        template: '주문 {{orderId}} - {{depositorName}}님 {{amount}}원 입금해주세요.',
      } as any);

      await service.sendPaymentReminderNotification('user-1', 'ORD-001', 50000, '홍길동');

      // Web push should have the replaced message
      expect(pushNotificationService.sendNotificationToUser).toHaveBeenCalledWith(
        'user-1',
        '입금 안내',
        '주문 ORD-001 - 홍길동님 50,000원 입금해주세요.',
        expect.any(Object),
      );
    });
  });
});
