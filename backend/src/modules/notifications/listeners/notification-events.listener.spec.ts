jest.mock(
  '@bizgo/bizgo-sdk-comm-js',
  () => {
    class ChainableBuilder {
      setSenderKey() {
        return this;
      }
      setBaseURL() {
        return this;
      }
      setApiKey() {
        return this;
      }
      setMsgType() {
        return this;
      }
      setTemplateCode() {
        return this;
      }
      setText() {
        return this;
      }
      setAttachment() {
        return this;
      }
      setType() {
        return this;
      }
      setName() {
        return this;
      }
      setUrlMobile() {
        return this;
      }
      setUrlPc() {
        return this;
      }
      setTo() {
        return this;
      }
      setDestinations() {
        return this;
      }
      setMessageFlow() {
        return this;
      }
      build() {
        return {};
      }
    }

    return {
      Bizgo: class {
        send = { OMNI: jest.fn() };
      },
      BizgoOptionsBuilder: ChainableBuilder,
      AlimtalkBuilder: ChainableBuilder,
      AlimtalkAttachmentBuilder: ChainableBuilder,
      BrandMessageBuilder: ChainableBuilder,
      BrandMessageAttachmentBuilder: ChainableBuilder,
      DestinationBuilder: ChainableBuilder,
      OMNIRequestBodyBuilder: ChainableBuilder,
      KakaoButtonBuilder: ChainableBuilder,
    };
  },
  { virtual: true },
);

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationEventsListener } from './notification-events.listener';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AlimtalkService } from '../../admin/alimtalk.service';
import { NotificationsService } from '../notifications.service';
import { OrderConfirmationBatchService } from '../order-confirmation-batch.service';

describe('NotificationEventsListener', () => {
  let listener: NotificationEventsListener;
  let prisma: {
    order: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock; findMany: jest.Mock };
    liveStream: { findUnique: jest.Mock };
    product: { findUnique: jest.Mock };
  };
  let alimtalkService: {
    sendOrderAlimtalk: jest.Mock;
    sendCartExpiringAlimtalk: jest.Mock;
    sendCartReminderFriendtalk: jest.Mock;
    sendLiveStartAlimtalk: jest.Mock;
  };
  let notificationsService: {
    sendPaymentConfirmedNotification: jest.Mock;
    sendReservationPromotedNotification: jest.Mock;
    sendCartExpiredNotification: jest.Mock;
  };
  let batchService: {
    shouldUseGroupedFlow: jest.Mock;
    hasPendingOrSentBatchForOrder: jest.Mock;
    scheduleBatchesForStreamEnd: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      order: { findUnique: jest.fn() },
      user: { findUnique: jest.fn(), findMany: jest.fn() },
      liveStream: { findUnique: jest.fn() },
      product: { findUnique: jest.fn() },
    };

    alimtalkService = {
      sendOrderAlimtalk: jest.fn(),
      sendCartExpiringAlimtalk: jest.fn(),
      sendCartReminderFriendtalk: jest.fn(),
      sendLiveStartAlimtalk: jest.fn(),
    };

    notificationsService = {
      sendPaymentConfirmedNotification: jest.fn(),
      sendReservationPromotedNotification: jest.fn(),
      sendCartExpiredNotification: jest.fn(),
    };

    batchService = {
      shouldUseGroupedFlow: jest.fn().mockResolvedValue(false),
      hasPendingOrSentBatchForOrder: jest.fn().mockResolvedValue(false),
      scheduleBatchesForStreamEnd: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationEventsListener,
        { provide: PrismaService, useValue: prisma },
        { provide: AlimtalkService, useValue: alimtalkService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: OrderConfirmationBatchService, useValue: batchService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('https://www.doremi-live.com') },
        },
      ],
    }).compile();

    listener = module.get(NotificationEventsListener);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('skips immediate ORDER_CONFIRMATION on order:created when grouped live flow applies', async () => {
    batchService.shouldUseGroupedFlow.mockResolvedValue(true);

    await listener.handleOrderCreated({
      orderId: 'ORD-1',
      userId: 'user-1',
      streamKeys: ['stream-1'],
    });

    expect(batchService.shouldUseGroupedFlow).toHaveBeenCalledWith(['stream-1']);
    expect(alimtalkService.sendOrderAlimtalk).not.toHaveBeenCalled();
  });

  it('sends immediate ORDER_CONFIRMATION on order:created for non-live orders', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'ORD-1', total: 50000, pointsUsed: 0 });
    prisma.user.findUnique.mockResolvedValue({ kakaoPhone: '01012345678' });

    await listener.handleOrderCreated({ orderId: 'ORD-1', userId: 'user-1', streamKeys: [] });

    expect(alimtalkService.sendOrderAlimtalk).toHaveBeenCalledWith('01012345678', 'ORD-1', 50000);
  });

  it('skips immediate ORDER_CONFIRMATION on order:paid when grouped batch already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ kakaoPhone: '01012345678' });
    prisma.order.findUnique.mockResolvedValue({
      id: 'ORD-1',
      total: 50000,
      orderItems: [{ Product: { streamKey: 'stream-1' } }],
    });
    batchService.hasPendingOrSentBatchForOrder.mockResolvedValue(true);

    await listener.handleOrderPaid({ orderId: 'ORD-1', userId: 'user-1' });

    expect(alimtalkService.sendOrderAlimtalk).not.toHaveBeenCalled();
    expect(notificationsService.sendPaymentConfirmedNotification).toHaveBeenCalledWith(
      'user-1',
      'ORD-1',
    );
  });

  it('schedules grouped batches on stream end', async () => {
    await listener.handleStreamEnded({ streamId: 'stream-id', streamKey: 'stream-1' });

    expect(batchService.scheduleBatchesForStreamEnd).toHaveBeenCalledWith({
      streamId: 'stream-id',
      streamKey: 'stream-1',
    });
  });

  it('renders cart reminder payload from all stream cart products', async () => {
    prisma.user.findUnique.mockResolvedValue({ kakaoPhone: '01012345678' });

    await listener.handleCartReminder({
      userId: 'user-1',
      productIds: ['product-1', 'product-2', 'product-3'],
      productNames: ['첫 상품', '둘째 상품', '셋째 상품'],
      streamKey: 'stream-1',
      reminderDelayHours: 0,
      streamEndedAt: new Date('2026-04-16T11:59:00.000Z'),
    });

    expect(alimtalkService.sendCartReminderFriendtalk).toHaveBeenCalledWith(
      '01012345678',
      '첫 상품',
      2,
      'stream-1',
    );
  });

  it('handles stream:started without throwing', async () => {
    prisma.liveStream.findUnique.mockResolvedValue({
      title: '라이브',
      streamKey: 'stream-1',
      description: '설명',
    });
    prisma.user.findMany.mockResolvedValue([{ kakaoPhone: '01012345678' }]);

    await expect(
      listener.handleStreamStarted({ streamId: 'stream-id', userId: 'admin-1' }),
    ).resolves.not.toThrow();
  });
});
