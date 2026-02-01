import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '../../../common/logger/logger.service';
import { ReservationService } from '../reservation.service';

@Injectable()
export class ReservationEventsListener {
  private readonly logger: LoggerService;

  constructor(private readonly reservationService: ReservationService) {
    this.logger = new LoggerService();
    this.logger.setContext('ReservationEventsListener');
  }

  /**
   * Epic 7: Handle reservation:created event
   */
  @OnEvent('reservation:created')
  handleReservationCreated(payload: {
    reservationId: string;
    userId: string;
    productId: string;
    productName: string;
    reservationNumber: number;
  }) {
    this.logger.log(
      `Reservation created: ${payload.reservationId}, number: ${payload.reservationNumber} for ${payload.productName}`,
    );
    // Future: Send notification to user
  }

  /**
   * Epic 7: Handle reservation:promoted event
   * Send KakaoTalk notification when promoted
   */
  @OnEvent('reservation:promoted')
  async handleReservationPromoted(payload: {
    reservationId: string;
    userId: string;
    productId: string;
    productName: string;
    reservationNumber: number;
    expiresAt: Date;
  }) {
    this.logger.log(
      `Reservation promoted: ${payload.reservationId} (#${payload.reservationNumber}), expires at: ${payload.expiresAt}`,
    );

    // TODO: Send KakaoTalk notification (Epic 7 Story 7-4)
    // For now, just log
    this.logger.log(
      `[KakaoTalk Notification] User ${payload.userId}: Your turn for ${payload.productName}! 10 minutes to complete order.`,
    );
  }

  /**
   * Handle cart product released -> promote next in queue
   */
  @OnEvent('cart:product:released')
  async handleCartProductReleased(payload: { productId: string; timestamp: Date }) {
    this.logger.log(`Cart product released: ${payload.productId}, promoting next in queue`);
    await this.reservationService.promoteNextInQueue(payload.productId);
  }

  /**
   * Handle cart timer expiration
   */
  @OnEvent('cart:expired')
  handleCartExpired(payload: { count: number; timestamp: Date }) {
    this.logger.log(`Cart expired event received: ${payload.count} carts expired`);
    // Auto-promotion is triggered by cart:product:released events
  }
}
