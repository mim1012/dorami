import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  CreateReservationDto,
  ReservationResponseDto,
  ReservationListDto,
  ReservationStatus,
} from './dto/reservation.dto';

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);
  private readonly promotionTimerMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    // Get timer duration from environment variable
    this.promotionTimerMinutes = this.configService.get<number>(
      'RESERVATION_PROMOTION_TIMER_MINUTES',
      10, // Default: 10 minutes
    );
  }

  /**
   * Epic 7: Create reservation when stock is insufficient
   */
  async createReservation(
    userId: string,
    createDto: CreateReservationDto,
  ): Promise<ReservationResponseDto> {
    const { productId, quantity } = createDto;

    // 1. Fetch product
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    if (product.status !== 'AVAILABLE') {
      throw new BadRequestException('Product is not available');
    }

    // 2. Check if stock is available (should be insufficient for reservation)
    const reservedInCarts = await this.getReservedQuantityInCarts(productId);
    const reservedInPromoted = await this.getReservedQuantityInPromotedReservations(productId);
    const availableStock = product.quantity - reservedInCarts - reservedInPromoted;

    if (availableStock >= quantity) {
      throw new BadRequestException(
        'Stock is available. Please add to cart instead of creating a reservation.',
      );
    }

    // 3. Check if user already has a waiting/promoted reservation for this product
    const existingReservation = await this.prisma.reservation.findFirst({
      where: {
        userId,
        productId,
        status: {
          in: ['WAITING', 'PROMOTED'],
        },
      },
    });

    if (existingReservation) {
      throw new BadRequestException('You already have an active reservation for this product');
    }

    // 4. Create reservation with atomic reservation number assignment
    // Use Redis INCR for atomic sequence generation (prevents race conditions)
    const nextReservationNumber = await this.redisService.incr(`reservation:sequence:${productId}`);

    const reservation = await this.prisma.reservation.create({
      data: {
        userId,
        productId,
        productName: product.name,
        quantity,
        reservationNumber: nextReservationNumber as number,
        status: 'WAITING',
      },
    });

    this.logger.log(
      `Reservation created: ${reservation.id}, number: ${reservation.reservationNumber} for product ${product.name}`,
    );

    // 5. Emit event
    this.eventEmitter.emit('reservation:created', {
      reservationId: reservation.id,
      userId,
      productId,
      productName: product.name,
      reservationNumber: reservation.reservationNumber,
    });

    return this.mapToResponseDto(reservation, productId);
  }

  /**
   * Get user's reservations (optimized to prevent N+1 query)
   */
  async getUserReservations(userId: string): Promise<ReservationListDto> {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        userId,
        status: {
          in: ['WAITING', 'PROMOTED'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Batch calculate queue positions to prevent N+1 query
    const productIds = [...new Set(reservations.map((r) => r.productId))];
    const queuePositionsMap = await this.batchCalculateQueuePositions(productIds);

    const mapped = reservations.map((r) => {
      const queuePosition =
        r.status === 'PROMOTED'
          ? 0
          : queuePositionsMap.get(`${r.productId}:${r.reservationNumber}`) || 0;

      let remainingSeconds: number | undefined;
      if (r.status === 'PROMOTED' && r.expiresAt) {
        const now = new Date();
        const expiresAt = new Date(r.expiresAt);
        remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      }

      return {
        id: r.id,
        userId: r.userId,
        productId: r.productId,
        productName: r.productName,
        quantity: r.quantity,
        reservationNumber: r.reservationNumber,
        status: r.status as ReservationStatus,
        promotedAt: r.promotedAt?.toISOString(),
        expiresAt: r.expiresAt?.toISOString(),
        createdAt: r.createdAt.toISOString(),
        remainingSeconds,
        queuePosition,
      };
    });

    return {
      reservations: mapped,
      totalCount: mapped.length,
      waitingCount: mapped.filter((r) => r.status === 'WAITING').length,
      promotedCount: mapped.filter((r) => r.status === 'PROMOTED').length,
    };
  }

  /**
   * Cancel reservation (triggers auto-promotion)
   */
  async cancelReservation(userId: string, reservationId: string): Promise<void> {
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        id: reservationId,
        userId,
        status: {
          in: ['WAITING', 'PROMOTED'],
        },
      },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    await this.prisma.reservation.update({
      where: { id: reservationId },
      data: { status: 'CANCELLED' },
    });

    this.logger.log(`Reservation cancelled: ${reservationId}`);

    // If this was a promoted reservation, promote next in queue
    if (reservation.status === 'PROMOTED') {
      await this.promoteNextInQueue(reservation.productId);
    }
  }

  /**
   * Promote next person in queue
   * Called when:
   * - Order is cancelled
   * - Cart timer expires
   * - Promoted reservation expires
   */
  async promoteNextInQueue(productId: string): Promise<void> {
    // Find next waiting reservation
    const nextReservation = await this.prisma.reservation.findFirst({
      where: {
        productId,
        status: 'WAITING',
      },
      orderBy: {
        reservationNumber: 'asc',
      },
    });

    if (!nextReservation) {
      this.logger.log(`No waiting reservations for product ${productId}`);
      return;
    }

    // Promote to active status with timer
    const expiresAt = new Date(Date.now() + this.promotionTimerMinutes * 60 * 1000);

    await this.prisma.reservation.update({
      where: { id: nextReservation.id },
      data: {
        status: 'PROMOTED',
        promotedAt: new Date(),
        expiresAt,
      },
    });

    this.logger.log(
      `Reservation promoted: ${nextReservation.id} (#${nextReservation.reservationNumber}), expires at: ${expiresAt}`,
    );

    // Emit event for KakaoTalk notification and auto-cart add
    this.eventEmitter.emit('reservation:promoted', {
      reservationId: nextReservation.id,
      userId: nextReservation.userId,
      productId: nextReservation.productId,
      productName: nextReservation.productName,
      reservationNumber: nextReservation.reservationNumber,
      quantity: nextReservation.quantity,
      expiresAt,
    });
  }

  /**
   * Cron job: Expire promoted reservations that have passed their timer
   * Runs every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async expirePromotedReservations() {
    try {
      const now = new Date();

      const expiredReservations = await this.prisma.reservation.findMany({
        where: {
          status: 'PROMOTED',
          expiresAt: {
            lte: now,
          },
        },
      });

      if (expiredReservations.length === 0) {
        return;
      }

      this.logger.log(`Expiring ${expiredReservations.length} promoted reservations`);

      for (const reservation of expiredReservations) {
        // Mark as expired
        await this.prisma.reservation.update({
          where: { id: reservation.id },
          data: { status: 'EXPIRED' },
        });

        this.logger.log(`Reservation expired: ${reservation.id}`);

        // Synchronize: Expire any linked ACTIVE cart items (timer sync)
        await this.prisma.cart.updateMany({
          where: {
            userId: reservation.userId,
            productId: reservation.productId,
            status: 'ACTIVE',
          },
          data: { status: 'EXPIRED' },
        });

        // Emit cart product released event to trigger next promotion
        this.eventEmitter.emit('cart:product:released', {
          productId: reservation.productId,
          timestamp: new Date(),
        });

        // Promote next in queue
        await this.promoteNextInQueue(reservation.productId);
      }
    } catch (error) {
      this.logger.error('Failed to expire promoted reservations', error.stack);
    }
  }

  /**
   * Get reserved quantity in active carts
   */
  private async getReservedQuantityInCarts(productId: string): Promise<number> {
    const result = await this.prisma.cart.aggregate({
      where: {
        productId,
        status: 'ACTIVE',
      },
      _sum: {
        quantity: true,
      },
    });

    return result._sum.quantity || 0;
  }

  /**
   * Get reserved quantity in promoted reservations
   */
  private async getReservedQuantityInPromotedReservations(productId: string): Promise<number> {
    const result = await this.prisma.reservation.aggregate({
      where: {
        productId,
        status: 'PROMOTED',
      },
      _sum: {
        quantity: true,
      },
    });

    return result._sum.quantity || 0;
  }

  /**
   * Batch calculate queue positions for multiple products (prevents N+1 query)
   */
  private async batchCalculateQueuePositions(productIds: string[]): Promise<Map<string, number>> {
    if (productIds.length === 0) {
      return new Map();
    }

    // Get all waiting reservations for these products
    const waitingReservations = await this.prisma.reservation.findMany({
      where: {
        productId: { in: productIds },
        status: 'WAITING',
      },
      orderBy: [{ productId: 'asc' }, { reservationNumber: 'asc' }],
      select: {
        productId: true,
        reservationNumber: true,
      },
    });

    // Calculate positions
    const positionsMap = new Map<string, number>();
    const productCounters = new Map<string, number>();

    for (const reservation of waitingReservations) {
      const currentPosition = (productCounters.get(reservation.productId) || 0) + 1;
      productCounters.set(reservation.productId, currentPosition);
      positionsMap.set(
        `${reservation.productId}:${reservation.reservationNumber}`,
        currentPosition,
      );
    }

    return positionsMap;
  }

  /**
   * Calculate queue position for waiting reservation (single)
   */
  private async getQueuePosition(productId: string, reservationNumber: number): Promise<number> {
    const waitingAhead = await this.prisma.reservation.count({
      where: {
        productId,
        status: 'WAITING',
        reservationNumber: {
          lt: reservationNumber,
        },
      },
    });

    return waitingAhead + 1; // Position starts at 1
  }

  /**
   * Map Prisma model to Response DTO
   */
  private async mapToResponseDto(
    reservation: any,
    productId: string,
  ): Promise<ReservationResponseDto> {
    let remainingSeconds: number | undefined;
    let queuePosition: number | undefined;

    if (reservation.status === 'PROMOTED' && reservation.expiresAt) {
      const now = new Date();
      const expiresAt = new Date(reservation.expiresAt);
      remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      queuePosition = 0; // Promoted = position 0
    } else if (reservation.status === 'WAITING') {
      queuePosition = await this.getQueuePosition(productId, reservation.reservationNumber);
    }

    return {
      id: reservation.id,
      userId: reservation.userId,
      productId: reservation.productId,
      productName: reservation.productName,
      quantity: reservation.quantity,
      reservationNumber: reservation.reservationNumber,
      status: reservation.status as ReservationStatus,
      promotedAt: reservation.promotedAt?.toISOString(),
      expiresAt: reservation.expiresAt?.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
      remainingSeconds,
      queuePosition,
    };
  }
}
