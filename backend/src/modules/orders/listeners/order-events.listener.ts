import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ReservationService } from '../reservation.service';
import { LoggerService } from '../../../common/logger/logger.service';

@Injectable()
export class OrderEventsListener {
  private logger: LoggerService;

  constructor(private reservationService: ReservationService) {
    this.logger = new LoggerService('OrderEventsListener');
  }

  @OnEvent('cart:expired')
  async handleCartExpired(payload: { orderId: string }) {
    this.logger.log(`Cart expired: ${payload.orderId}`);
    // Future: Trigger promotion logic for waiting list
  }

  @OnEvent('order:cancelled')
  async handleOrderCancelled(payload: { orderId: string; productId?: string }) {
    this.logger.log(`Order cancelled: ${payload.orderId}`);

    // If productId is provided, promote next user from waiting list
    if (payload.productId) {
      await this.reservationService.promoteNext(payload.productId);
    }
  }

  @OnEvent('reservation:promoted')
  handleReservationPromoted(payload: {
    userId: string;
    productId: string;
    reservationId: string;
  }) {
    this.logger.log(
      `Reservation promoted for user ${payload.userId}, product ${payload.productId}`,
    );
    // Notification will be sent by NotificationModule
  }
}
