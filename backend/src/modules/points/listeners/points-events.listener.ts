import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PointsService } from '../points.service';
import { PointsConfigService } from '../points-config.service';
import { PointTransactionType } from '@prisma/client';
import { PointsEarnedEvent, PointsRefundedEvent } from '../../../common/events/points.events';

@Injectable()
export class PointsEventsListener {
  private readonly logger = new Logger(PointsEventsListener.name);

  constructor(
    private pointsService: PointsService,
    private pointsConfigService: PointsConfigService,
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Auto-earn points when order payment is confirmed
   */
  @OnEvent('order:paid')
  async handleOrderPaid(payload: { orderId: string; userId: string }) {
    try {
      const config = await this.pointsConfigService.getPointsConfig();

      if (!config.pointsEnabled) {
        return;
      }

      // Get order details
      const order = await this.prisma.order.findUnique({
        where: { id: payload.orderId },
      });

      if (!order) {
        this.logger.warn(`Order ${payload.orderId} not found for points earning`);
        return;
      }

      // Prevent duplicate earnings
      const existingEarning = await this.prisma.pointTransaction.findFirst({
        where: {
          orderId: payload.orderId,
          transactionType: PointTransactionType.EARNED_ORDER,
        },
      });

      if (existingEarning) {
        this.logger.warn(`Points already earned for order ${payload.orderId}`);
        return;
      }

      // Calculate points: floor(orderTotal * rate / 100)
      const orderTotal = Number(order.total);
      const earnedPoints = Math.floor((orderTotal * config.pointEarningRate) / 100);

      if (earnedPoints <= 0) {
        return;
      }

      // Calculate expiration date if enabled
      let expiresAt: Date | undefined;
      if (config.pointExpirationEnabled) {
        expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + config.pointExpirationMonths);
      }

      // Add points
      const { newBalance } = await this.pointsService.addPoints(
        payload.userId,
        earnedPoints,
        PointTransactionType.EARNED_ORDER,
        payload.orderId,
        undefined,
        expiresAt,
      );

      // Update order's pointsEarned
      await this.prisma.order.update({
        where: { id: payload.orderId },
        data: { pointsEarned: earnedPoints },
      });

      this.logger.log(
        `Earned ${earnedPoints} points for order ${payload.orderId}, user ${payload.userId}`,
      );

      this.eventEmitter.emit(
        'points:earned',
        new PointsEarnedEvent(payload.userId, payload.orderId, earnedPoints, newBalance),
      );
    } catch (error) {
      this.logger.error(
        `Failed to process points earning for order ${payload.orderId}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Refund points when order is cancelled (if points were used)
   */
  @OnEvent('order:cancelled')
  async handleOrderCancelled(payload: { orderId: string }) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: payload.orderId },
      });

      if (!order || order.pointsUsed <= 0) {
        return;
      }

      const { newBalance } = await this.pointsService.addPoints(
        order.userId,
        order.pointsUsed,
        PointTransactionType.REFUND_CANCELLED,
        payload.orderId,
        `Refund for cancelled order ${payload.orderId}`,
      );

      this.logger.log(`Refunded ${order.pointsUsed} points for cancelled order ${payload.orderId}`);

      this.eventEmitter.emit(
        'points:refunded',
        new PointsRefundedEvent(order.userId, payload.orderId, order.pointsUsed, newBalance),
      );
    } catch (error) {
      this.logger.error(
        `Failed to refund points for cancelled order ${payload.orderId}`,
        (error as Error).stack,
      );
    }
  }
}
