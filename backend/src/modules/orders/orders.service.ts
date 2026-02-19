import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
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

// Type for Order with items
interface OrderWithItems extends Order {
  orderItems: OrderItem[];
}

// Type for order totals calculation
interface OrderTotalsInput {
  price: Decimal | number;
  shippingFee: Decimal | number;
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
    // Validate point redemption before transaction if needed
    if (pointsToUse && pointsToUse > 0) {
      // Pre-validate: we need to calculate totals first, so do a preliminary check
      const cartItems = await this.prisma.cart.findMany({
        where: { userId, status: 'ACTIVE' },
      });
      const totals = this.calculateOrderTotals(
        cartItems.map((item) => ({
          price: item.price,
          shippingFee: item.shippingFee,
          quantity: item.quantity,
        })),
      );
      await this.pointsService.validateRedemption(userId, pointsToUse, totals.total);
    }

    const order = await this.prisma.$transaction(async (tx) => {
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
          status: 'ACTIVE',
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

      // Calculate totals using shared helper (DRY)
      const totals = this.calculateOrderTotals(
        cartItems.map((item) => ({
          price: item.price,
          shippingFee: item.shippingFee,
          quantity: item.quantity,
        })),
      );

      // Apply point discount
      const effectivePointsUsed = pointsToUse && pointsToUse > 0 ? pointsToUse : 0;
      const finalTotal = totals.total - effectivePointsUsed;

      // Prepare order items (Product connect으로 relation 설정, productId 직접 지정 불가)
      const orderItemsData = cartItems.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        shippingFee: item.shippingFee,
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
          userEmail: user.email,
          depositorName: user.depositorName || user.name,
          instagramId: user.instagramId || '',
          shippingAddress: user.shippingAddress || {},
          status: 'PENDING_PAYMENT',
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

      // Mark cart items as COMPLETED
      await tx.cart.updateMany({
        where: {
          userId,
          status: 'ACTIVE',
        },
        data: {
          status: 'COMPLETED',
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
    });

    // Emit domain event
    const event = new OrderCreatedEvent(
      order.id,
      order.userId,
      Number(order.total),
      order.orderItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        priceAtPurchase: Number(item.price),
      })),
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
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        price: product.price,
        shippingFee: product.shippingFee,
        Product: {
          connect: { id: product.id },
        },
      };
    });

    // Calculate totals using shared helper (DRY)
    const totals = this.calculateOrderTotals(
      orderItemsData.map((item) => ({
        price: item.price,
        shippingFee: item.shippingFee,
        quantity: item.quantity,
      })),
    );

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

        return tx.order.create({
          data: {
            id: orderId,
            userId,
            userEmail: user.email,
            depositorName: user.depositorName || user.name,
            instagramId: user.instagramId || '',
            shippingAddress: user.shippingAddress || {},
            status: 'PENDING_PAYMENT',
            subtotal: new Decimal(totals.subtotal),
            shippingFee: new Decimal(totals.totalShippingFee),
            total: new Decimal(totals.total),
            orderItems: {
              create: orderItemsData,
            },
          },
          include: {
            orderItems: true,
          },
        });
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
      order.orderItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        priceAtPurchase: Number(item.price),
      })),
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
   */
  private calculateOrderTotals(items: OrderTotalsInput[]): OrderTotals {
    let subtotal = 0;
    let totalShippingFee = 0;

    items.forEach((item) => {
      const price = typeof item.price === 'number' ? item.price : Number(item.price);
      const shippingFee =
        typeof item.shippingFee === 'number' ? item.shippingFee : Number(item.shippingFee);
      subtotal += price * item.quantity;
      totalShippingFee += shippingFee;
    });

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

    if (order.status !== 'PENDING_PAYMENT') {
      throw new BusinessException('ORDER_NOT_PENDING', { orderId });
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PAYMENT_CONFIRMED',
        paidAt: new Date(),
      },
      include: { orderItems: true },
    });

    // Remove timer from Redis
    await this.redisService.del(`order:timer:${orderId}`);

    // Emit domain event
    const paidEvent = new OrderPaidEvent(orderId, userId, updatedOrder.paidAt);
    this.eventEmitter.emit('order:paid', paidEvent);

    return this.mapToResponseDto(updatedOrder);
  }

  async cancelOrder(orderId: string, userId: string): Promise<void> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { orderItems: true },
    });

    if (!order) {
      throw new OrderNotFoundException(orderId);
    }

    // Restore stock
    for (const item of order.orderItems) {
      await this.inventoryService.restoreStock(item.productId, item.quantity);
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    });

    // Remove timer
    await this.redisService.del(`order:timer:${orderId}`);

    this.eventEmitter.emit('order:cancelled', { orderId });
  }

  /**
   * Epic 8 Story 8.2: Get order with bank transfer info
   */
  async findById(
    orderId: string,
    userId?: string,
  ): Promise<OrderResponseDto & { bankTransferInfo?: BankTransferInfo }> {
    const whereClause: any = { id: orderId };
    if (userId) {
      whereClause.userId = userId;
    }

    const order = await this.prisma.order.findFirst({
      where: whereClause,
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
          bankName: this.configService.get<string>('BANK_NAME') || '',
          accountNumber: this.configService.get<string>('BANK_ACCOUNT_NUMBER') || '',
          accountHolder: this.configService.get<string>('BANK_ACCOUNT_HOLDER') || '',
          amount: responseDto.total,
          depositorName: order.depositorName,
        },
      };
    }

    return responseDto;
  }

  async findByUserId(userId: string): Promise<OrderResponseDto[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: { orderItems: true },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((o) => this.mapToResponseDto(o));
  }

  /**
   * Cron job: Check for expired orders and auto-cancel them
   * Runs every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async cancelExpiredOrders() {
    try {
      const now = new Date();
      const expirationTime = new Date(now.getTime() - this.orderExpirationMinutes * 60 * 1000);

      // Find orders that should be expired
      const expiredOrders = await this.prisma.order.findMany({
        where: {
          status: 'PENDING_PAYMENT',
          createdAt: {
            lte: expirationTime,
          },
        },
        include: {
          orderItems: true,
        },
      });

      if (expiredOrders.length === 0) {
        return;
      }

      this.logger.log(`Found ${expiredOrders.length} expired orders to cancel`);

      for (const order of expiredOrders) {
        // Double-check Redis timer doesn't exist (payment confirmed)
        const timerExists = await this.redisService.exists(`order:timer:${order.id}`);
        if (timerExists) {
          continue; // Still active
        }

        // Restore stock
        for (const item of order.orderItems) {
          await this.inventoryService.restoreStock(item.productId, item.quantity);
        }

        // Cancel order
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED' },
        });

        this.logger.log(`Auto-cancelled expired order: ${order.id}`);
        this.eventEmitter.emit('order:cancelled', { orderId: order.id });
      }
    } catch (error) {
      this.logger.error('Failed to cancel expired orders', error.stack);
    }
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
          status: 'PENDING_PAYMENT',
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

          // Mark as sent, expire after 24 hours
          await this.redisService.set(reminderKey, '1', 60 * 60 * 24);

          this.logger.log(`Payment reminder sent for order ${order.id}`);
        } catch (error) {
          this.logger.error(`Failed to send payment reminder for order ${order.id}`, error.stack);
        }
      }
    } catch (error) {
      this.logger.error('Failed to process payment reminders', error.stack);
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
      subtotal: Number(order.subtotal),
      shippingFee: Number(order.shippingFee),
      total: Number(order.total),
      pointsEarned: order.pointsEarned,
      pointsUsed: order.pointsUsed,
      paymentStatus: order.paymentStatus as unknown as PaymentStatus,
      shippingStatus: order.shippingStatus as unknown as ShippingStatus,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.orderItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: Number(item.price),
        shippingFee: Number(item.shippingFee),
      })),
    };
  }
}
