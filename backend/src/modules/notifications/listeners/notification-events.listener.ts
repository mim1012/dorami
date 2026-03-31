import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { AlimtalkService } from '../../admin/alimtalk.service';
import { LoggerService } from '../../../common/logger/logger.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class NotificationEventsListener {
  private logger: LoggerService;

  constructor(
    private notificationsService: NotificationsService,
    private alimtalkService: AlimtalkService,
    private prisma: PrismaService,
  ) {
    this.logger = new LoggerService();
    this.logger.setContext('NotificationEventsListener');
  }

  @OnEvent('order:created')
  async handleOrderCreated(payload: { orderId: string; userId: string }) {
    this.logger.log(`Sending order created notification to user ${payload.userId}`);

    try {
      // Fetch order to check for pointsUsed
      const order = await this.prisma.order.findUnique({
        where: { id: payload.orderId },
      });

      if (order && order.pointsUsed > 0) {
        this.logger.log(`Order ${payload.orderId} used ${order.pointsUsed} points`);
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { kakaoPhone: true },
      });

      const effectivePhone = user?.kakaoPhone ?? null;

      if (effectivePhone && order) {
        await this.alimtalkService.sendOrderAlimtalk(
          effectivePhone,
          payload.orderId,
          Number(order.total),
        );
      }

      await this.notificationsService.sendOrderCreatedNotification(payload.userId, payload.orderId);
    } catch (error) {
      this.logger.error('Failed to send order created notification', (error as Error).message);
    }
  }

  @OnEvent('order:paid')
  async handleOrderPaid(payload: { orderId: string; userId: string }) {
    this.logger.log(`Sending payment confirmed notification to user ${payload.userId}`);

    const [user, order, activeLiveStream] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { kakaoPhone: true },
      }),
      this.prisma.order.findUnique({
        where: { id: payload.orderId },
      }),
      this.prisma.liveStream.findFirst({
        where: { status: 'LIVE' },
        select: { id: true },
      }),
    ]);

    const effectivePhone = user?.kakaoPhone ?? null;

    // 방송 중이 아닐 때만 즉시 알림톡 발송 (방송 중이면 stream:ended 에서 일괄 발송)
    if (effectivePhone && order && !activeLiveStream) {
      try {
        await this.alimtalkService.sendOrderAlimtalk(
          effectivePhone,
          payload.orderId,
          Number(order.total),
        );
      } catch (error) {
        this.logger.error('Failed to send payment alimtalk', (error as Error).message);
      }
    } else if (activeLiveStream) {
      this.logger.log(`Deferring invoice alimtalk for order ${payload.orderId} until stream ends`);
    }

    // Web Push는 항상 즉시 발송
    try {
      await this.notificationsService.sendPaymentConfirmedNotification(
        payload.userId,
        payload.orderId,
      );
    } catch (error) {
      this.logger.error('Failed to send payment confirmed notification', (error as Error).message);
    }
  }

  @OnEvent('stream:ended')
  async handleStreamEnded(payload: { streamId: string; streamKey?: string }) {
    this.logger.log(`Stream ended: ${payload.streamId}, sending deferred invoice alimtalks`);

    try {
      // 방송 시간 조회
      const stream = await this.prisma.liveStream.findUnique({
        where: { id: payload.streamId },
        select: { startedAt: true, endedAt: true },
      });

      if (!stream?.startedAt) {
        this.logger.warn(`Stream ${payload.streamId} has no startedAt, skipping invoice alimtalk`);
        return;
      }

      const streamStart = stream.startedAt;
      const streamEnd = stream.endedAt ?? new Date();

      // 방송 중 결제 확인된 주문 조회 (template + config는 sendOrderAlimtalkBatch에서 한 번만 fetch)
      const paidOrders = await this.prisma.order.findMany({
        where: {
          paymentStatus: 'CONFIRMED',
          paidAt: {
            gte: streamStart,
            lte: streamEnd,
          },
        },
        include: {
          user: {
            select: { kakaoPhone: true, name: true },
          },
          orderItems: { select: { productName: true }, orderBy: { productName: 'asc' } },
        },
      });

      if (paidOrders.length === 0) {
        this.logger.log('No paid orders during stream, skipping invoice alimtalk');
        return;
      }

      this.logger.log(`Sending ${paidOrders.length} deferred invoice alimtalks`);
      await this.alimtalkService.sendOrderAlimtalkBatch(paidOrders);
    } catch (error) {
      this.logger.error(
        'Failed to process stream ended invoice alimtalks',
        (error as Error).message,
      );
    }
  }

  @OnEvent('points:earned')
  async handlePointsEarned(payload: {
    userId: string;
    orderId: string;
    amount: number;
    newBalance: number;
  }) {
    this.logger.log(
      `Points earned: ${payload.amount} for user ${payload.userId}, order ${payload.orderId}. Balance: ${payload.newBalance}`,
    );
  }

  @OnEvent('points:expiring-soon')
  async handlePointsExpiringSoon(payload: {
    userId: string;
    expiringAmount: number;
    expiresAt: Date;
  }) {
    this.logger.log(
      `Points expiring soon: ${payload.expiringAmount} for user ${payload.userId}, expires at ${payload.expiresAt}`,
    );
    // Future: Send KakaoTalk notification about expiring points
  }

  @OnEvent('reservation:promoted')
  async handleReservationPromoted(payload: { userId: string; productId: string }) {
    this.logger.log(`Sending reservation promoted notification to user ${payload.userId}`);

    try {
      await this.notificationsService.sendReservationPromotedNotification(
        payload.userId,
        payload.productId,
      );
    } catch (error) {
      this.logger.error(
        'Failed to send reservation promoted notification',
        (error as Error).message,
      );
    }
  }

  @OnEvent('cart:expired')
  async handleCartExpired(payload: { userId?: string }) {
    if (!payload.userId) {
      return;
    }

    this.logger.log(`Sending cart expired notification to user ${payload.userId}`);

    try {
      await this.notificationsService.sendCartExpiredNotification(payload.userId);
    } catch (error) {
      this.logger.error('Failed to send cart expired notification', (error as Error).message);
    }
  }

  @OnEvent('cart:expired:user')
  async handleCartExpiredUser(payload: {
    userId: string;
    productIds: string[];
    itemCount: number;
    timestamp: Date;
  }) {
    this.logger.log(`Sending cart expired alimtalk to user ${payload.userId}`);

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { kakaoPhone: true, name: true },
      });

      if (!user?.kakaoPhone) {
        return;
      }

      const firstProductId = payload.productIds[0];
      const product = firstProductId
        ? await this.prisma.product.findUnique({
            where: { id: firstProductId },
            select: { name: true },
          })
        : null;

      const productName = product?.name ?? '상품';

      await this.alimtalkService.sendCartExpiringAlimtalk(
        user.kakaoPhone,
        user.name,
        productName,
        payload.itemCount,
      );
    } catch (error) {
      this.logger.error('Failed to send cart expired alimtalk', (error as Error).message);
    }
  }

  @OnEvent('cart:reminder')
  async handleCartReminder(payload: {
    userId: string;
    productIds: string[];
    productNames: string[];
    streamKey: string | null;
    minutesLeft: number;
  }) {
    this.logger.log(`Sending cart reminder friendtalk to user ${payload.userId}`);

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { kakaoPhone: true },
      });

      if (!user?.kakaoPhone) {
        return;
      }

      const productName = payload.productNames[0] ?? '상품';

      await this.alimtalkService.sendCartReminderFriendtalk(
        user.kakaoPhone,
        productName,
        payload.minutesLeft,
        payload.streamKey ?? undefined,
      );
    } catch (error) {
      this.logger.error('Failed to send cart reminder friendtalk', (error as Error).message);
    }
  }

  @OnEvent('stream:started')
  async handleStreamStarted(payload: { streamId: string; userId: string }) {
    this.logger.log(`Stream started: ${payload.streamId} by user: ${payload.userId}`);

    try {
      const stream = await this.prisma.liveStream.findUnique({
        where: { id: payload.streamId },
        select: { title: true, streamKey: true, description: true },
      });

      if (!stream) {
        this.logger.error(`Stream not found for alimtalk: ${payload.streamId}`, 'stream not found');
        return;
      }

      const users = await this.prisma.user.findMany({
        where: { kakaoPhone: { not: null } },
        select: { kakaoPhone: true },
      });

      const phoneNumbers = users.map((u) => u.kakaoPhone).filter((p): p is string => p !== null);

      if (phoneNumbers.length === 0) {
        return;
      }

      const streamUrl = `https://www.doremi-live.com/live/${stream.streamKey}`;

      await this.alimtalkService.sendLiveStartAlimtalk(
        phoneNumbers,
        stream.title,
        streamUrl,
        stream.description ?? undefined,
      );
    } catch (error) {
      this.logger.error('Failed to send live start alimtalk', (error as Error).message);
    }
  }
}
