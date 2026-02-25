import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ReservationService } from '../../reservation/reservation.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { LoggerService } from '../../../common/logger/logger.service';

@Injectable()
export class OrderEventsListener {
  private logger: LoggerService;

  constructor(
    private reservationService: ReservationService,
    private prisma: PrismaService,
  ) {
    this.logger = new LoggerService();
    this.logger.setContext('OrderEventsListener');
  }

  @OnEvent('cart:expired')
  async handleCartExpired(payload: { orderId: string }) {
    this.logger.log(`Cart expired: ${payload.orderId}`);
    // Future: Trigger promotion logic for waiting list
  }

  @OnEvent('order:cancelled')
  async handleOrderCancelled(payload: { orderId: string; productId?: string }) {
    this.logger.log(`Order cancelled: ${payload.orderId}`);

    // Look up all productIds from the cancelled order's items
    const order = await this.prisma.order.findUnique({
      where: { id: payload.orderId },
      select: {
        orderItems: {
          select: { productId: true },
        },
      },
    });

    if (!order) {
      this.logger.warn(`Order not found for promotion: ${payload.orderId}`);
      return;
    }

    // Promote next in queue for every product in the cancelled order
    const productIds = [...new Set(order.orderItems.map((item) => item.productId))];
    for (const productId of productIds) {
      await this.reservationService.promoteNextInQueue(productId);
    }
  }

  @OnEvent('reservation:promoted')
  handleReservationPromoted(payload: { userId: string; productId: string; reservationId: string }) {
    this.logger.log(
      `Reservation promoted for user ${payload.userId}, product ${payload.productId}`,
    );
    // Notification will be sent by NotificationModule
  }
}
