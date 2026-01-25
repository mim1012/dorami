import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { InventoryService } from './inventory.service';
import { CreateOrderDto, OrderResponseDto } from './dto/order.dto';
import {
  OrderNotFoundException,
  BusinessException,
} from '../../common/exceptions/business.exception';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private inventoryService: InventoryService,
    private eventEmitter: EventEmitter2,
  ) {}

  async createOrder(
    userId: string,
    createOrderDto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
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

    // Calculate subtotal and shipping
    let subtotal = 0;
    let totalShippingFee = 0;
    const orderItemsData = createOrderDto.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        throw new BusinessException('PRODUCT_NOT_FOUND', { productId: item.productId });
      }

      const itemSubtotal = Number(product.price) * item.quantity;
      subtotal += itemSubtotal;
      totalShippingFee += Number(product.shippingFee);

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

    // Decrease stock (with pessimistic locking)
    await this.inventoryService.batchDecreaseStock(
      createOrderDto.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    );

    const total = subtotal + totalShippingFee;

    const order = await this.prisma.order.create({
      data: {
        id: this.generateOrderId(), // Generate ORD-YYYYMMDD-XXXXX format
        userId,
        userEmail: user.email,
        depositorName: user.depositorName || user.name,
        instagramId: user.instagramId || '',
        shippingAddress: user.shippingAddress || {},
        status: 'PENDING_PAYMENT',
        subtotal: new Decimal(subtotal),
        shippingFee: new Decimal(totalShippingFee),
        total: new Decimal(total),
        orderItems: {
          create: orderItemsData,
        },
      },
      include: {
        orderItems: true,
      },
    });

    // Set expiration timer in Redis
    await this.redisService.set(
      `order:timer:${order.id}`,
      'PENDING_PAYMENT',
      10 * 60, // 10 minutes
    );

    // Schedule automatic cancellation (you'd use a job queue in production)
    setTimeout(() => {
      this.handleOrderExpiration(order.id);
    }, 10 * 60 * 1000);

    // Emit event
    this.eventEmitter.emit('order:created', {
      orderId: order.id,
      userId,
      streamId: createOrderDto.streamId,
    });

    return this.mapToResponseDto(order);
  }

  private generateOrderId(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `ORD-${dateStr}-${random}`;
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

    this.eventEmitter.emit('order:confirmed', { orderId });

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

  async findById(orderId: string): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true },
    });

    if (!order) {
      throw new OrderNotFoundException(orderId);
    }

    return this.mapToResponseDto(order);
  }

  async findByUserId(userId: string): Promise<OrderResponseDto[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: { orderItems: true },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((o) => this.mapToResponseDto(o));
  }

  private async handleOrderExpiration(orderId: string) {
    const timerExists = await this.redisService.exists(`order:timer:${orderId}`);

    if (!timerExists) {
      return; // Already confirmed or cancelled
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true },
    });

    if (!order || order.status !== 'PENDING_PAYMENT') {
      return;
    }

    // Auto-cancel expired order
    for (const item of order.orderItems) {
      await this.inventoryService.restoreStock(item.productId, item.quantity);
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    });

    this.eventEmitter.emit('cart:expired', { orderId });
    this.eventEmitter.emit('order:cancelled', { orderId });
  }

  private mapToResponseDto(order: any): OrderResponseDto {
    return {
      id: order.id,
      userId: order.userId,
      userEmail: order.userEmail,
      depositorName: order.depositorName,
      instagramId: order.instagramId,
      status: order.status,
      subtotal: Number(order.subtotal),
      shippingFee: Number(order.shippingFee),
      total: Number(order.total),
      paymentStatus: order.paymentStatus,
      shippingStatus: order.shippingStatus,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.orderItems.map((item: any) => ({
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
