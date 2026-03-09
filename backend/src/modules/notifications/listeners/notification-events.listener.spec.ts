import { Test, TestingModule } from '@nestjs/testing';
import { NotificationEventsListener } from './notification-events.listener';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AlimtalkService } from '../../admin/alimtalk.service';
import { NotificationsService } from '../notifications.service';

describe('NotificationEventsListener', () => {
  let listener: NotificationEventsListener;
  let prisma: PrismaService;
  let alimtalkService: AlimtalkService;
  let notificationsService: NotificationsService;

  const mockOrder = {
    id: 'ORD-20260309-00001',
    total: 50000,
    pointsUsed: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationEventsListener,
        {
          provide: PrismaService,
          useValue: {
            order: {
              findUnique: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: AlimtalkService,
          useValue: {
            sendOrderAlimtalk: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            sendOrderCreatedNotification: jest.fn(),
            sendPaymentConfirmedNotification: jest.fn(),
            sendReservationPromotedNotification: jest.fn(),
            sendCartExpiredNotification: jest.fn(),
          },
        },
      ],
    }).compile();

    listener = module.get<NotificationEventsListener>(NotificationEventsListener);
    prisma = module.get<PrismaService>(PrismaService);
    alimtalkService = module.get<AlimtalkService>(AlimtalkService);
    notificationsService = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleOrderCreated - 알림톡 전화번호 fallback', () => {
    const payload = { orderId: 'ORD-20260309-00001', userId: 'user-1' };

    it('phone이 있으면 phone으로 알림톡을 발송한다', async () => {
      jest.spyOn(prisma.order, 'findUnique').mockResolvedValue(mockOrder as any);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        phone: '010-1234-5678',
        kakaoPhone: '010-9999-0000',
      } as any);

      await listener.handleOrderCreated(payload);

      expect(alimtalkService.sendOrderAlimtalk).toHaveBeenCalledWith(
        '010-1234-5678',
        payload.orderId,
        50000,
      );
    });

    it('phone이 null이고 kakaoPhone이 있으면 kakaoPhone으로 알림톡을 발송한다 (fallback)', async () => {
      jest.spyOn(prisma.order, 'findUnique').mockResolvedValue(mockOrder as any);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        phone: null,
        kakaoPhone: '010-9999-0000',
      } as any);

      await listener.handleOrderCreated(payload);

      expect(alimtalkService.sendOrderAlimtalk).toHaveBeenCalledWith(
        '010-9999-0000',
        payload.orderId,
        50000,
      );
    });

    it('phone과 kakaoPhone 모두 null이면 알림톡을 발송하지 않는다', async () => {
      jest.spyOn(prisma.order, 'findUnique').mockResolvedValue(mockOrder as any);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        phone: null,
        kakaoPhone: null,
      } as any);

      await listener.handleOrderCreated(payload);

      expect(alimtalkService.sendOrderAlimtalk).not.toHaveBeenCalled();
    });

    it('알림톡 발송 실패 시 에러를 catch하고 계속 진행한다', async () => {
      jest.spyOn(prisma.order, 'findUnique').mockResolvedValue(mockOrder as any);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        phone: '010-1234-5678',
        kakaoPhone: null,
      } as any);
      jest
        .spyOn(alimtalkService, 'sendOrderAlimtalk')
        .mockRejectedValue(new Error('알림톡 서버 오류'));

      // 에러가 throw되지 않아야 한다
      await expect(listener.handleOrderCreated(payload)).resolves.not.toThrow();
    });
  });
});
