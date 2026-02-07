import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { LoggerService } from '../../../common/logger/logger.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class NotificationEventsListener {
  private logger: LoggerService;

  constructor(
    private notificationsService: NotificationsService,
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
        this.logger.log(
          `Order ${payload.orderId} used ${order.pointsUsed} points`,
        );
      }

      await this.notificationsService.sendOrderCreatedNotification(
        payload.userId,
        payload.orderId,
      );
    } catch (error) {
      this.logger.error('Failed to send order created notification', error.message);
    }
  }

  @OnEvent('order:paid')
  async handleOrderPaid(payload: { orderId: string; userId: string }) {
    this.logger.log(`Sending payment confirmed notification to user ${payload.userId}`);

    try {
      await this.notificationsService.sendPaymentConfirmedNotification(
        payload.userId,
        payload.orderId,
      );
    } catch (error) {
      this.logger.error('Failed to send payment confirmed notification', error.message);
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
      this.logger.error('Failed to send reservation promoted notification', error.message);
    }
  }

  @OnEvent('cart:expired')
  async handleCartExpired(payload: { userId?: string }) {
    if (!payload.userId) {return;}

    this.logger.log(`Sending cart expired notification to user ${payload.userId}`);

    try {
      await this.notificationsService.sendCartExpiredNotification(payload.userId);
    } catch (error) {
      this.logger.error('Failed to send cart expired notification', error.message);
    }
  }
}
