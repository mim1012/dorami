import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { LoggerService } from '../../common/logger/logger.service';
import { BusinessException } from '../../common/exceptions/business.exception';

@Injectable()
export class ReservationService {
  private logger: LoggerService;

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private eventEmitter: EventEmitter2,
  ) {
    this.logger = new LoggerService();
    this.logger.setContext('ReservationService');
  }

  /**
   * Add user to reservation queue (waiting list)
   */
  async addToQueue(userId: string, productId: string, quantity: number = 1): Promise<{ position: number }> {
    // Fetch product data
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new BusinessException('PRODUCT_NOT_FOUND', { productId });
    }

    // Use Redis Sorted Set for queue (score = timestamp)
    const score = Date.now();
    await this.redisService.zadd(`reservation:queue:${productId}`, score, userId);

    // Get position in queue
    const position = await this.redisService.zrank(`reservation:queue:${productId}`, userId);

    // Get next reservation number for this product
    const lastReservation = await this.prisma.reservation.findFirst({
      where: { productId },
      orderBy: { reservationNumber: 'desc' },
    });
    const reservationNumber = (lastReservation?.reservationNumber || 0) + 1;

    // Save in database
    await this.prisma.reservation.create({
      data: {
        userId,
        productId,
        productName: product.name,
        quantity,
        reservationNumber,
        status: 'WAITING',
      },
    });

    this.logger.log(`User ${userId} added to queue for product ${productId} at position ${position}`);

    return { position: position !== null ? position + 1 : reservationNumber };
  }

  /**
   * Promote next user from waiting list (atomic operation using Lua script)
   */
  async promoteNext(productId: string): Promise<{ userId: string } | null> {
    // Pop the user with lowest score (earliest timestamp)
    const result = await this.redisService.zpopmin(`reservation:queue:${productId}`, 1);

    if (!result || result.length === 0) {
      this.logger.log(`No users in queue for product ${productId}`);
      return null;
    }

    const userId = result[0];

    // Update database
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        userId,
        productId,
        status: 'WAITING',
      },
    });

    if (reservation) {
      await this.prisma.reservation.update({
        where: { id: reservation.id },
        data: {
          status: 'PROMOTED',
          promotedAt: new Date(),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min to complete order
        },
      });

      this.eventEmitter.emit('reservation:promoted', {
        userId,
        productId,
        reservationId: reservation.id,
      });

      this.logger.log(`User ${userId} promoted from queue for product ${productId}`);

      return { userId };
    }

    return null;
  }

  /**
   * Get user's position in queue
   */
  async getPosition(userId: string, productId: string): Promise<{ position: number | null }> {
    const position = await this.redisService.zrank(`reservation:queue:${productId}`, userId);

    return { position: position !== null ? position + 1 : null };
  }

  /**
   * Cancel reservation
   */
  async cancelReservation(userId: string, productId: string): Promise<void> {
    await this.redisService.getClient().zrem(`reservation:queue:${productId}`, userId);

    await this.prisma.reservation.updateMany({
      where: {
        userId,
        productId,
        status: 'WAITING',
      },
      data: {
        status: 'CANCELLED',
      },
    });

    this.logger.log(`User ${userId} cancelled reservation for product ${productId}`);
  }
}
