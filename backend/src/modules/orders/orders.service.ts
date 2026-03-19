import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { isCaliforniaAddress } from '../../common/utils/address.util';
import { RedisService } from '../../common/redis/redis.service';
import { InventoryService } from './inventory.service';
import {
  CreateOrderDto,
  OrderResponseDto,
  OrderStatus,
  PaymentStatus,
  ShippingStatus,
} from './dto/order.dto';
import {
  OrderNotFoundException,
  BusinessException,
} from '../../common/exceptions/business.exception';
import { Decimal } from '@prisma/client/runtime/library';
import { OrderCreatedEvent, OrderPaidEvent } from '../../common/events/order.events';
import { PointsService } from '../points/points.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PointTransactionType, Order, OrderItem, Prisma } from '@prisma/client';
import { CartStatus } from '@live-commerce/shared-types';

// Type for Order with items
interface OrderWithItems extends Order {
  orderItems: OrderItem[];
}

// Type for order totals calculation
interface OrderTotalsInput {
  price: Decimal | number;
  quantity: number;
}

interface OrderTotals {
  subtotal: number;
  totalShippingFee: number;
  total: number;
}

// Type for bank transfer info
export interface BankTransferInfo {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  amount: number;
  depositorName: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly orderExpirationMinutes: number;

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private inventoryService: InventoryService,
    private pointsService: PointsService,
    private notificationsService: NotificationsService,
    private eventEmitter: EventEmitter2,
    private configService: ConfigService,
  ) {
    this.orderExpirationMinutes = this.configService.get<number>('ORDER_EXPIRATION_MINUTES', 10);
  }

  /**
   * Epic 8 Story 8.1: Create order from active cart items
   * Epic 13 Story 13.3: Support pointsToUse for point redemption
   */
  async createOrderFromCart(userId: string, pointsToUse?: number): Promise<OrderResponseDto> {
    const order = await this.prisma.$transaction(
      async (tx) => {
        // Fetch user data
        const user = await tx.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          throw new BusinessException('USER_NOT_FOUND', { userId });
        }

        // Get active cart items
        const cartItems = await tx.cart.findMany({
          where: {
            userId,
            status: CartStatus.ACTIVE,
          },
          include: {
            product: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        });

        if (cartItems.length === 0) {
          throw new BusinessException('CART_EMPTY', { userId });
        }

        // Validate cart items not expired
        const now = new Date();
        const expiredItems = cartItems.filter(
          (item) => item.timerEnabled && item.expiresAt && item.expiresAt < now,
        );

        if (expiredItems.length > 0) {
          throw new BusinessException('CART_ITEMS_EXPIRED', {
            expiredCount: expiredItems.length,
          });
        }

        // Deduct stock atomically for cart items
        await this.inventoryService.batchDecreaseStockTx(
          tx,
          cartItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        );

        // Calculate totals using shared helper (DRY) - now with global shipping
        const cartProductIds = cartItems.map((item) => item.productId);
        const totals = await this.calculateOrderTotals(
          cartItems.map((item) => ({
            price: item.price,
            quantity: item.quantity,
          })),
          userId,
          cartProductIds,
        );

        // Apply point discount with validation
        let effectivePointsUsed = 0;
        if (pointsToUse && pointsToUse > 0) {
          // Validate points redemption against order total and user balance
          await this.pointsService.validateRedemption(userId, pointsToUse, totals.total);
          effectivePointsUsed = pointsToUse;
        }

        // Ensure final total is never negative
        const finalTotal = Math.max(0, totals.total - effectivePointsUsed);
        if (finalTotal === 0 && totals.total > 0) {
          throw new BusinessException(
            'INVALID_ORDER_TOTAL',
            { total: finalTotal, pointsUsed: effectivePointsUsed },
            'Order total cannot be zero after points redemption',
          );
        }

        // Defensive: warn if cart items appear to have unexpected duplication
        // e.g. same productId + same color + same size appearing more than once (should be merged at addToCart time)
        const cartItemKeys = cartItems.map(
          (item) => `${item.productId}:${item.color ?? ''}:${item.size ?? ''}`,
        );
        const uniqueCartItemKeys = new Set(cartItemKeys);
        if (uniqueCartItemKeys.size !== cartItems.length) {
          this.logger.warn(
            `createOrderFromCart: duplicate cart item keys detected for userId=${userId}. ` +
              `cartItems.length=${cartItems.length}, uniqueKeys=${uniqueCartItemKeys.size}. ` +
              `Keys: ${cartItemKeys.join(', ')}`,
          );
        }

        // Prepare order items (Product connect으로 relation 설정, productId 직접 지정 불가)
        const orderItemsData = cartItems.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
          shippingFee: new Decimal(0),
          color: item.color,
          size: item.size,
          Product: {
            connect: { id: item.productId },
          },
        }));

        // Generate unique order ID
        const orderId = await this.generateOrderId();

        // Create order
        const createdOrder = await tx.order.create({
          data: {
            id: orderId,
            userId,
            userEmail: user.email ?? '',
            depositorName: user.depositorName ?? user.name,
            instagramId: user.instagramId ?? '',
            shippingAddress: user.shippingAddress ?? {},
            status: OrderStatus.PENDING_PAYMENT,
            paymentMethod: 'BANK_TRANSFER',
            paymentStatus: 'PENDING',
            shippingStatus: 'PENDING',
            subtotal: new Decimal(totals.subtotal),
            shippingFee: new Decimal(totals.totalShippingFee),
            total: new Decimal(finalTotal),
            pointsUsed: effectivePointsUsed,
            orderItems: {
              create: orderItemsData,
            },
          },
          include: {
            orderItems: true,
          },
        });

        // Defensive: ensure every cart item produced a corresponding order item
        if (createdOrder.orderItems.length !== cartItems.length) {
          this.logger.warn(
            `createOrderFromCart: order item count mismatch for orderId=${createdOrder.id}. ` +
              `cartItems.length=${cartItems.length}, orderItems.length=${createdOrder.orderItems.length}`,
          );
        }

        // Mark cart items as COMPLETED
        await tx.cart.updateMany({
          where: {
            userId,
            status: CartStatus.ACTIVE,
          },
          data: {
            status: CartStatus.COMPLETED,
          },
        });

        // Deduct points inside the same transaction for atomicity
        if (pointsToUse && pointsToUse > 0) {
          await this.pointsService.deductPointsTx(
            tx,
            userId,
            pointsToUse,
            PointTransactionType.USED_ORDER,
            createdOrder.id,
          );
        }

        return createdOrder;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 8000,
      },
    );

    const productStreamKeys = await this.prisma.product.findMany({
      where: { id: { in: order.orderItems.map((item) => item.productId!) } },
      select: { id: true, streamKey: true },
    });
    const streamKeyByProductId = new Map(
      productStreamKeys.map((product) => [product.id, product.streamKey ?? undefined]),
    );
    const createdOrderItems = order.orderItems.map((item) => {
      const streamKey = streamKeyByProductId.get(item.productId ?? '');
      return {
        productId: item.productId!,
        quantity: item.quantity,
        priceAtPurchase: Number(item.price),
        streamKey: streamKey ?? undefined,
      };
    });
    const streamKeys = [
      ...new Set(
        createdOrderItems
          .map((item) => item.streamKey)
          .filter((streamKey): streamKey is string => Boolean(streamKey)),
      ),
    ];

    // Emit domain event
    const event = new OrderCreatedEvent(
      order.id,
      order.userId,
      Number(order.total),
      createdOrderItems,
      streamKeys,
    );

    this.eventEmitter.emit('order:created', event);

    return this.mapToResponseDto(order);
  }

  async createOrder(userId: string, createOrderDto: CreateOrderDto): Promise<OrderResponseDto> {
    // Fetch user data for required fields
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BusinessException('USER_NOT_FOUND', { userId });
    }

    // Fetch product prices
    const productIds = createOrderDto.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    // Build product map for efficient lookup
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Validate all products exist and prepare order items
    const orderItemsData = createOrderDto.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new BusinessException('PRODUCT_NOT_FOUND', { productId: item.productId });
      }

      return {
        productName: product.name,
        quantity: item.quantity,
        price: product.price,
        shippingFee: new Decimal(0),
        Product: {
          connect: { id: product.id },
        },
      };
    });

    // Calculate totals using shared helper (DRY) - now with global shipping
    const totals = await this.calculateOrderTotals(
      orderItemsData.map((item) => ({
        price: item.price,
        quantity: item.quantity,
      })),
      userId,
      productIds,
    );

    // Apply point discount with validation
    const pointsToUse = createOrderDto.pointsToUse;
    let effectivePointsUsed = 0;
    if (pointsToUse && pointsToUse > 0) {
      await this.pointsService.validateRedemption(userId, pointsToUse, totals.total);
      effectivePointsUsed = pointsToUse;
    }

    // Ensure final total is never negative
    const finalTotal = Math.max(0, totals.total - effectivePointsUsed);
    if (finalTotal === 0 && totals.total > 0) {
      throw new BusinessException(
        'INVALID_ORDER_TOTAL',
        { total: finalTotal, pointsUsed: effectivePointsUsed },
        'Order total cannot be zero after points redemption',
      );
    }

    // Generate unique order ID outside transaction (uses Redis, not transactional)
    const orderId = await this.generateOrderId();

    // Atomically decrease stock + create order to prevent partial failure
    // (stock decremented but order not created, or vice versa)
    const order = await this.prisma.$transaction(
      async (tx) => {
        await this.inventoryService.batchDecreaseStockTx(
          tx,
          createOrderDto.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        );

        const createdOrder = await tx.order.create({
          data: {
            id: orderId,
            userId,
            userEmail: user.email ?? '',
            depositorName: user.depositorName ?? user.name,
            instagramId: user.instagramId ?? '',
            shippingAddress: user.shippingAddress ?? {},
            status: OrderStatus.PENDING_PAYMENT,
            subtotal: new Decimal(totals.subtotal),
            shippingFee: new Decimal(totals.totalShippingFee),
            total: new Decimal(finalTotal),
            pointsUsed: effectivePointsUsed,
            orderItems: {
              create: orderItemsData,
            },
          },
          include: {
            orderItems: true,
          },
        });

        if (pointsToUse && pointsToUse > 0) {
          await this.pointsService.deductPointsTx(
            tx,
            userId,
            pointsToUse,
            PointTransactionType.USED_ORDER,
            createdOrder.id,
          );
        }

        return createdOrder;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 8000,
      },
    );

    // Set expiration timer in Redis (handled by cron job)
    const expirationSeconds = this.orderExpirationMinutes * 60;
    await this.redisService.set(
      `order:timer:${order.id}`,
      order.createdAt.toISOString(),
      expirationSeconds,
    );

    // Emit domain event
    const event = new OrderCreatedEvent(
      order.id,
      order.userId,
      Number(order.total),
      order.orderItems.map((item) => {
        const streamKey = productMap.get(item.productId!)?.streamKey ?? undefined;
        return {
          productId: item.productId!,
          quantity: item.quantity,
          priceAtPurchase: Number(item.price),
          streamKey: streamKey === null ? undefined : streamKey,
        };
      }),
      createOrderDto.items
        .map((item) => productMap.get(item.productId)?.streamKey)
        .filter((streamKey): streamKey is string => Boolean(streamKey)),
    );

    this.eventEmitter.emit('order:created', event);

    return this.mapToResponseDto(order);
  }

  private async generateOrderId(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    // Use Redis INCR for collision-free sequential numbering per day
    const key = `order:sequence:${dateStr}`;
    const sequence = await this.redisService.incr(key);

    // Set expiration to 2 days (cleanup old counters)
    if (sequence === 1) {
      await this.redisService.expire(key, 60 * 60 * 24 * 2);
    }

    const sequenceStr = sequence.toString().padStart(5, '0');
    return `ORD-${dateStr}-${sequenceStr}`;
  }

  /**
   * Calculate order totals from items (DRY - used by createOrderFromCart and createOrder)
   * Shipping is now per-order based on global SystemConfig settings:
   * - If broadcast freeShippingEnabled AND subtotal >= freeShippingThreshold: $0
   * - Else if shipping state === 'CA': caShippingFee
   * - Else: defaultShippingFee
   */
  private async calculateOrderTotals(
    items: OrderTotalsInput[],
    userId?: string,
    productIds?: string[],
  ): Promise<OrderTotals> {
    let subtotalCents = 0;

    items.forEach((item) => {
      const price = typeof item.price === 'number' ? item.price : Number(item.price);
      subtotalCents += Math.round(price * 100) * item.quantity;
    });

    const subtotal = subtotalCents / 100;

    // Calculate global shipping fee
    let totalShippingFee = 0;

    if (items.length > 0) {
      const config = await this.prisma.systemConfig.findFirst();
      const defaultShippingFee = config ? parseFloat(config.defaultShippingFee.toString()) : 10;
      const caShippingFee = config ? parseFloat(config.caShippingFee.toString()) : 8;
      const freeShippingThreshold = config
        ? parseFloat(config.freeShippingThreshold.toString())
        : 150;

      // Check if any product's live stream has freeShippingEnabled
      let freeShippingEnabled = false;
      if (productIds && productIds.length > 0) {
        const products = await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { streamKey: true },
        });
        const streamKeys = [
          ...new Set(products.map((p) => p.streamKey).filter(Boolean)),
        ] as string[];
        if (streamKeys.length > 0) {
          const streams = await this.prisma.liveStream.findMany({
            where: { streamKey: { in: streamKeys } },
            select: { freeShippingEnabled: true },
          });
          freeShippingEnabled = streams.some((s) => s.freeShippingEnabled);
        }
      }

      if (freeShippingEnabled && subtotal >= freeShippingThreshold) {
        totalShippingFee = 0;
      } else {
        // Determine by user's shipping state
        let isCA = false;
        if (userId) {
          const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { shippingAddress: true },
          });
          if (user?.shippingAddress) {
            isCA = isCaliforniaAddress(user.shippingAddress);
          }
        }
        totalShippingFee = isCA ? caShippingFee : defaultShippingFee;
      }
    }

    return {
      subtotal,
      totalShippingFee,
      total: subtotal + totalShippingFee,
    };
  }

  async confirmOrder(orderId: string, userId: string): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { orderItems: true },
    });

    if (!order) {
      throw new OrderNotFoundException(orderId);
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BusinessException('ORDER_NOT_PENDING', { orderId });
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PAYMENT_CONFIRMED,
        paidAt: new Date(),
      },
      include: { orderItems: true },
    });

    // Remove timer from Redis
    await this.redisService.del(`order:timer:${orderId}`);

    // Emit domain event
    const paidEvent = new OrderPaidEvent(orderId, userId, updatedOrder.paidAt!);
    this.eventEmitter.emit('order:paid', paidEvent);

    return this.mapToResponseDto(updatedOrder);
  }

  /**
   * Epic 8 Story 8.2: Get order with bank transfer info
   * Note: userId is required to prevent unauthorized access. Use findByIdAdmin for admin-only access.
   */
  async findById(
    orderId: string,
    userId: string,
  ): Promise<OrderResponseDto & { bankTransferInfo?: BankTransferInfo }> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        orderItems: {
          include: {
            Product: { select: { imageUrl: true } },
          },
        },
      },
    });

    if (!order) {
      throw new OrderNotFoundException(orderId);
    }

    const responseDto = this.mapToResponseDto(order);

    // Include bank transfer info if payment is pending
    if (order.paymentStatus === 'PENDING') {
      return {
        ...responseDto,
        bankTransferInfo: {
          bankName: this.configService.get<string>('BANK_NAME') ?? '',
          accountNumber: this.configService.get<string>('BANK_ACCOUNT_NUMBER') ?? '',
          accountHolder: this.configService.get<string>('BANK_ACCOUNT_HOLDER') ?? '',
          amount: Number(responseDto.total),
          depositorName: order.depositorName,
        },
      };
    }

    return responseDto;
  }

  /**
   * Admin-only method to get order without userId restriction
   */
  async findByIdAdmin(
    orderId: string,
  ): Promise<OrderResponseDto & { bankTransferInfo?: BankTransferInfo }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true },
    });

    if (!order) {
      throw new OrderNotFoundException(orderId);
    }

    const responseDto = this.mapToResponseDto(order);

    // Include bank transfer info if payment is pending
    if (order.paymentStatus === 'PENDING') {
      return {
        ...responseDto,
        bankTransferInfo: {
          bankName: this.configService.get<string>('BANK_NAME') ?? '',
          accountNumber: this.configService.get<string>('BANK_ACCOUNT_NUMBER') ?? '',
          accountHolder: this.configService.get<string>('BANK_ACCOUNT_HOLDER') ?? '',
          amount: Number(responseDto.total),
          depositorName: order.depositorName,
        },
      };
    }

    return responseDto;
  }

  async findByUserId(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      status?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<{
    items: OrderResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = options?.page ?? 1;
    const limit = Math.min(options?.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = { userId };
    if (options?.status) {
      where.status = options.status as OrderStatus;
    }
    if (options?.startDate) {
      where.createdAt = { ...(where.createdAt as any), gte: new Date(options.startDate) };
    }
    if (options?.endDate) {
      const end = new Date(options.endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { ...(where.createdAt as any), lte: end };
    }

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          orderItems: {
            include: {
              Product: { select: { imageUrl: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: orders.map((o) => this.mapToResponseDto(o)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Cron job: Check for expired orders and auto-cancel them
   * DISABLED: Orders should not auto-cancel based on ORDER_EXPIRATION_MINUTES
   * Users need time to make bank transfers (no strict time limit)
   * Manual cancellation via admin or user is preferred
   *
   * TODO: Consider implementing order expiration only after:
   * - Much longer timeout (24+ hours)
   * - Or after explicit user timeout (user doesn't make payment for X days)
   * - Not based on 10-minute cart timer which is inappropriate for orders
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async cancelExpiredOrders() {
    // INTENTIONALLY DISABLED - See comment above
    return;

    /* ORIGINAL CODE (DISABLED):
    try {
      const now = new Date();
      const expirationTime = new Date(now.getTime() - this.orderExpirationMinutes * 60 * 1000);
      const batchSize = 200;

      // Find orders that should be expired
      const expiredOrders = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.PENDING_PAYMENT,
          createdAt: {
            lte: expirationTime,
          },
        },
        select: {
          id: true,
          orderItems: {
            select: {
              productId: true,
              quantity: true,
            },
          },
        },
      });

      if (expiredOrders.length === 0) {
        return;
      }

      this.logger.log(`Found ${expiredOrders.length} expired orders to cancel`);

      for (let offset = 0; offset < expiredOrders.length; offset += batchSize) {
        const batch = expiredOrders.slice(offset, offset + batchSize);

        for (const order of batch) {
          // Double-check Redis timer doesn't exist (payment confirmed)
          const timerExists = await this.redisService.exists(`order:timer:${order.id}`);
          if (timerExists) {
            continue; // Still active
          }

          await this.prisma.$transaction(async (tx) => {
            await this.inventoryService.batchRestoreStockTx(
              tx,
              order.orderItems as { productId: string; quantity: number }[],
            );
            await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.CANCELLED } });
          });

          this.logger.log(`Auto-cancelled expired order: ${order.id}`);
          this.eventEmitter.emit('order:cancelled', { orderId: order.id });
        }
      }
    } catch (error) {
      this.logger.error('Failed to cancel expired orders', (error as Error).stack);
    }
    */
  }

  /**
   * Cron job: Send payment reminders for unpaid orders older than 6 hours
   * Runs every 6 hours
   */
  @Cron('0 */6 * * *')
  async sendPaymentReminders() {
    try {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

      // Find pending payment orders created more than 6 hours ago
      const unpaidOrders = await this.prisma.order.findMany({
        where: {
          paymentStatus: 'PENDING',
          status: OrderStatus.PENDING_PAYMENT,
          createdAt: { lte: sixHoursAgo },
        },
        select: {
          id: true,
          userId: true,
          total: true,
          depositorName: true,
        },
      });

      if (unpaidOrders.length === 0) {
        return;
      }

      this.logger.log(`Sending payment reminders for ${unpaidOrders.length} unpaid orders`);

      for (const order of unpaidOrders) {
        try {
          // Check if we already sent a reminder (use Redis to avoid duplicates)
          const reminderKey = `order:reminder:${order.id}`;
          const alreadySent = await this.redisService.exists(reminderKey);
          if (alreadySent) {
            continue;
          }

          await this.notificationsService.sendPaymentReminderNotification(
            order.userId,
            order.id,
            Number(order.total),
            order.depositorName,
          );

          // Mark as sent, expire after 7 days
          await this.redisService.set(reminderKey, '1', 60 * 60 * 24 * 7);

          this.logger.log(`Payment reminder sent for order ${order.id}`);
        } catch (error) {
          this.logger.error(
            `Failed to send payment reminder for order ${order.id}`,
            (error as Error).stack,
          );
        }
      }
    } catch (error) {
      this.logger.error('Failed to process payment reminders', (error as Error).stack);
    }
  }

  private mapToResponseDto(order: OrderWithItems): OrderResponseDto {
    return {
      id: order.id,
      userId: order.userId,
      userEmail: order.userEmail,
      depositorName: order.depositorName,
      instagramId: order.instagramId,
      status: order.status as unknown as OrderStatus,
      subtotal: String(order.subtotal),
      shippingFee: String(order.shippingFee),
      total: String(order.total),
      pointsEarned: order.pointsEarned,
      pointsUsed: order.pointsUsed,
      paymentStatus: order.paymentStatus as unknown as PaymentStatus,
      shippingStatus: order.shippingStatus as unknown as ShippingStatus,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: order.orderItems.map((item) => ({
        id: item.id,
        productId: item.productId!,
        productName: item.productName,
        quantity: item.quantity,
        price: String(item.price),
        shippingFee: String(item.shippingFee),
        color: item.color || undefined,
        size: item.size || undefined,
        imageUrl: (item as any).Product?.imageUrl ?? undefined,
      })),
    };
  }
}
