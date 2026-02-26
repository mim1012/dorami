import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '../../../common/logger/logger.service';
import { ReservationService } from '../reservation.service';
import { CartService } from '../../cart/cart.service';

@Injectable()
export class ReservationEventsListener {
  private readonly logger: LoggerService;

  constructor(
    private readonly reservationService: ReservationService,
    private readonly cartService: CartService,
  ) {
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
   * KakaoTalk/Web Push notification is handled by NotificationEventsListener
   * (notifications/listeners/notification-events.listener.ts)
   *
   * Also attempts to automatically add the item to the cart.
   * If auto-add fails, the PROMOTED status is retained so user can manually add it.
   */
  @OnEvent('reservation:promoted')
  async handleReservationPromoted(payload: {
    reservationId: string;
    userId: string;
    productId: string;
    productName: string;
    reservationNumber: number;
    quantity: number;
    expiresAt: Date;
  }) {
    this.logger.log(
      `Reservation promoted: ${payload.reservationId} (#${payload.reservationNumber}) for ${payload.productName}, expires at: ${payload.expiresAt}`,
    );

    // Attempt to automatically add to cart
    try {
      await this.cartService.addToCart(payload.userId, {
        productId: payload.productId,
        quantity: payload.quantity,
        color: undefined,
        size: undefined,
      });
      this.logger.log(`Auto cart added for user ${payload.userId}, product ${payload.productId}`);
    } catch (err) {
      // Fail silently - PROMOTED status remains so user can manually add it
      this.logger.warn(
        `Auto cart add failed for reservation ${payload.reservationId}: ${err.message}`,
      );
    }
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
