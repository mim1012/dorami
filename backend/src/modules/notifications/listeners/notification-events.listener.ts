import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { LoggerService } from '../../../common/logger/logger.service';

@Injectable()
export class NotificationEventsListener {
  private logger: LoggerService;

  constructor(private notificationsService: NotificationsService) {
    this.logger = new LoggerService();
    this.logger.setContext('NotificationEventsListener');
  }

  @OnEvent('order:created')
  async handleOrderCreated(payload: { orderId: string; userId: string }) {
    this.logger.log(`Sending order created notification to user ${payload.userId}`);

    try {
      await this.notificationsService.sendOrderCreatedNotification(
        payload.userId,
        payload.orderId,
      );
    } catch (error) {
      this.logger.error('Failed to send order created notification', error.message);
    }
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
    if (!payload.userId) return;

    this.logger.log(`Sending cart expired notification to user ${payload.userId}`);

    try {
      await this.notificationsService.sendCartExpiredNotification(payload.userId);
    } catch (error) {
      this.logger.error('Failed to send cart expired notification', error.message);
    }
  }
}
