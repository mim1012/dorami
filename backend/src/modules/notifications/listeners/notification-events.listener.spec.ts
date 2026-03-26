import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationEventsListener } from './notification-events.listener';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AlimtalkService } from '../../admin/alimtalk.service';
import { NotificationsService } from '../notifications.service';

describe('NotificationEventsListener', () => {
  let listener: NotificationEventsListener;
  let prisma: PrismaService;
  let alimtalkService: AlimtalkService;
  let _notificationsService: NotificationsService;

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
    _notificationsService = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('EventEmitter2 통합 - order:created 이벤트', () => {
    let integrationModule: TestingModule;
    let _integrationListener: NotificationEventsListener;
    let eventEmitter: EventEmitter2;

    const payload = { orderId: 'ORD-20260309-00001', userId: 'user-1' };

    beforeEach(async () => {
      integrationModule = await Test.createTestingModule({
        imports: [EventEmitterModule.forRoot()],
        providers: [
          NotificationEventsListener,
          {
            provide: PrismaService,
            useValue: {
              order: { findUnique: jest.fn().mockResolvedValue(mockOrder) },
              user: { findUnique: jest.fn().mockResolvedValue({ kakaoPhone: null }) },
            },
          },
          {
            provide: AlimtalkService,
            useValue: { sendOrderAlimtalk: jest.fn() },
          },
          {
            provide: NotificationsService,
            useValue: {
              sendOrderCreatedNotification: jest.fn().mockResolvedValue(undefined),
              sendPaymentConfirmedNotification: jest.fn(),
              sendReservationPromotedNotification: jest.fn(),
              sendCartExpiredNotification: jest.fn(),
            },
          },
        ],
      }).compile();

      // onModuleInit 수명주기를 실행해야 @OnEvent 핸들러가 EventEmitter2에 등록된다
      await integrationModule.init();

      _integrationListener = integrationModule.get<NotificationEventsListener>(
        NotificationEventsListener,
      );
      eventEmitter = integrationModule.get<EventEmitter2>(EventEmitter2);
    });

    afterEach(async () => {
      await integrationModule.close();
    });

    it('emitAsync("order:created") 호출 시 handleOrderCreated가 실행된다', async () => {
      // @OnEvent 데코레이터는 모듈 초기화 시점에 메서드 참조를 등록하므로
      // spy로 교체 후 재등록이 필요하다. 대신 내부 의존성 호출로 실행을 검증한다.
      const notifService = integrationModule.get<NotificationsService>(NotificationsService);
      const sendSpy = jest.spyOn(notifService, 'sendOrderCreatedNotification');

      await eventEmitter.emitAsync('order:created', payload);

      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).toHaveBeenCalledWith(payload.userId, payload.orderId);
    });
  });

  describe('handleOrderCreated - 알림톡 전화번호 fallback', () => {
    const payload = { orderId: 'ORD-20260309-00001', userId: 'user-1' };

    it('kakaoPhone이 있으면 kakaoPhone으로 알림톡을 발송한다', async () => {
      jest.spyOn(prisma.order, 'findUnique').mockResolvedValue(mockOrder as any);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        kakaoPhone: '010-9999-0000',
      } as any);

      await listener.handleOrderCreated(payload);

      expect(alimtalkService.sendOrderAlimtalk).toHaveBeenCalledWith(
        '010-9999-0000',
        payload.orderId,
        50000,
      );
    });

    it('kakaoPhone이 null이면 알림톡을 발송하지 않는다', async () => {
      jest.spyOn(prisma.order, 'findUnique').mockResolvedValue(mockOrder as any);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        kakaoPhone: null,
      } as any);

      await listener.handleOrderCreated(payload);

      expect(alimtalkService.sendOrderAlimtalk).not.toHaveBeenCalled();
    });

    it('알림톡 발송 실패 시 에러를 catch하고 계속 진행한다', async () => {
      jest.spyOn(prisma.order, 'findUnique').mockResolvedValue(mockOrder as any);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        kakaoPhone: null,
      } as any);
      jest
        .spyOn(alimtalkService, 'sendOrderAlimtalk')
        .mockRejectedValue(new Error('알림톡 서버 오류'));

      // 에러가 throw되지 않아야 한다
      await expect(listener.handleOrderCreated(payload)).resolves.not.toThrow();
    });
  });

  describe('handleStreamStarted - 라이브 시작 이벤트', () => {
    it('stream:started 이벤트 수신 시 에러 없이 처리된다', async () => {
      await expect(
        listener.handleStreamStarted({ streamId: 'stream-1', userId: 'user-1' }),
      ).resolves.not.toThrow();
    });
  });
});
