import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '../../../common/logger/logger.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { OrderCreatedEvent } from '../../../common/events/order.events';
import { ProductStockUpdatedEvent } from '../../../common/events/product.events';
import { SocketIoProvider } from '../../websocket/socket-io.provider';

@Injectable()
export class ProductEventsListener {
  private readonly logger: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly socketIo: SocketIoProvider,
  ) {
    this.logger = new LoggerService();
    this.logger.setContext('ProductEventsListener');
  }

  /**
   * Handle order:created event
   * Decrease stock for all products in order
   */
  @OnEvent('order:created')
  async handleOrderCreated(event: OrderCreatedEvent) {
    this.logger.log(`Order created: ${event.orderId}, processing stock updates...`);

    // Decrease stock for all products in order
    for (const item of event.items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        this.logger.error(`Product ${item.productId} not found`);
        continue;
      }

      const newQuantity = product.quantity - item.quantity;

      const updatedProduct = await this.prisma.product.update({
        where: { id: item.productId },
        data: {
          quantity: newQuantity,
          status: newQuantity <= 0 ? 'SOLD_OUT' : product.status,
        },
      });

      // Emit product stock updated event
      this.eventEmitter.emit(
        'product:stock:updated',
        new ProductStockUpdatedEvent(
          item.productId,
          product.quantity,
          newQuantity,
          'purchase',
          item.streamKey ?? product.streamKey ?? undefined,
          this.toProductEventPayload(updatedProduct),
        ),
      );

      this.logger.log(`Product ${item.productId} stock: ${product.quantity} → ${newQuantity}`);
    }
  }

  /**
   * Epic 5 Story 5.2: Handle product.created event
   * Broadcast new product to all viewers watching the stream
   */
  @OnEvent('product:created')
  handleProductCreated(payload: { productId: string; streamKey: string; product: any }) {
    this.logger.log(`Product created: ${payload.productId} for stream ${payload.streamKey}`);

    // Broadcast to all clients in the stream room
    this.socketIo.server.to(`stream:${payload.streamKey}`).emit('live:product:added', {
      type: 'live:product:added',
      data: payload.product,
    });

    this.logger.log(`Product added broadcast sent to stream ${payload.streamKey}`);
  }

  /**
   * Epic 5 Story 5.2: Handle product.updated event
   * Broadcast product update to all viewers
   */
  @OnEvent('product:updated')
  handleProductUpdated(payload: { productId: string; streamKey: string; product: any }) {
    this.logger.log(`Product updated: ${payload.productId}`);

    // Broadcast to all clients in the stream room
    this.socketIo.server.to(`stream:${payload.streamKey}`).emit('live:product:updated', {
      type: 'live:product:updated',
      data: payload.product,
    });

    this.logger.log(`Product updated broadcast sent to stream ${payload.streamKey}`);
  }

  /**
   * Epic 5 Story 5.2: Handle product.soldout event
   * Broadcast sold out status to all viewers
   */
  @OnEvent('product:soldout')
  handleProductSoldOut(payload: { productId: string; streamKey: string }) {
    this.logger.log(`Product sold out: ${payload.productId}`);

    // Broadcast to all clients in the stream room
    this.socketIo.server.to(`stream:${payload.streamKey}`).emit('live:product:soldout', {
      type: 'live:product:soldout',
      data: { productId: payload.productId },
    });

    this.logger.log(`Product sold out broadcast sent to stream ${payload.streamKey}`);
  }

  /**
   * Handle product.stock.updated event
   * Broadcast stock changes and send low stock warnings
   */
  @OnEvent('product:stock:updated')
  async handleStockUpdated(payload: {
    productId: string;
    streamKey?: string;
    oldStock: number;
    newStock: number;
    product?: any;
  }) {
    const streamKey = payload.streamKey;
    const fallbackProduct = payload.product
      ? null
      : await this.prisma.product.findUnique({
          where: { id: payload.productId },
          select: { streamKey: true },
        });

    this.logger.log(
      `Stock updated: Product ${payload.productId} from ${payload.oldStock} to ${payload.newStock}`,
    );
    const targetStreamKey = streamKey ?? fallbackProduct?.streamKey;
    if (!targetStreamKey) {
      this.logger.warn(`Cannot determine stream key for product ${payload.productId}`);
      return;
    }

    // Broadcast updated product to stream viewers
    const updatedProduct =
      payload.product ??
      (await this.prisma.product.findUnique({
        where: { id: payload.productId },
      }));

    if (!updatedProduct) {
      this.logger.warn(`Product ${payload.productId} not found for stock update broadcast`);
      return;
    }

    const stockPayload = this.isProductEventPayload(updatedProduct)
      ? updatedProduct
      : this.toProductEventPayload(updatedProduct);

    this.socketIo.server.to(`stream:${targetStreamKey}`).emit('live:product:updated', {
      type: 'live:product:updated',
      data: stockPayload,
    });

    // Send low stock warning if stock is low (< 5)
    if (payload.newStock > 0 && payload.newStock < 5) {
      this.socketIo.server.to(`stream:${targetStreamKey}`).emit('product:low-stock', {
        type: 'product:low-stock',
        data: {
          productId: payload.productId,
          productName: (stockPayload as { name?: string }).name,
          remainingStock: payload.newStock,
        },
      });

      this.logger.warn(
        `Low stock warning: Product ${payload.productId} has only ${payload.newStock} left`,
      );
    }
  }

  /**
   * Handle product.deleted event
   */
  @OnEvent('product:deleted')
  handleProductDeleted(payload: { productId: string; streamKey?: string }) {
    this.logger.log(`Product deleted: ${payload.productId}`);

    if (payload.streamKey) {
      // Broadcast product deletion to stream viewers
      this.socketIo.server.to(`stream:${payload.streamKey}`).emit('live:product:deleted', {
        type: 'live:product:deleted',
        data: { productId: payload.productId },
      });
    }
  }

  private isProductEventPayload(product: unknown): product is { stock: number; name: string } {
    return typeof product === 'object' && product !== null && 'stock' in product;
  }

  private toProductEventPayload(product: any) {
    return {
      id: product.id,
      streamKey: product.streamKey,
      name: product.name,
      price: parseFloat(product.price.toString()),
      stock: product.quantity,
      colorOptions: Array.isArray(product.colorOptions) ? product.colorOptions : [],
      sizeOptions: Array.isArray(product.sizeOptions) ? product.sizeOptions : [],
      shippingFee: parseFloat(product.shippingFee.toString()),
      freeShippingMessage: product.freeShippingMessage ?? undefined,
      timerEnabled: product.timerEnabled,
      timerDuration: product.timerDuration,
      imageUrl: product.imageUrl ?? undefined,
      images: Array.isArray(product.images) ? product.images : [],
      sortOrder: product.sortOrder ?? 0,
      isNew: product.isNew ?? false,
      discountRate: product.discountRate ? parseFloat(product.discountRate.toString()) : undefined,
      originalPrice: product.originalPrice
        ? parseFloat(product.originalPrice.toString())
        : undefined,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      description: undefined,
      metadata: undefined,
    };
  }
}
