import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '../../../common/logger/logger.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { OrderCreatedEvent } from '../../../common/events/order.events';
import { ProductStockUpdatedEvent, ProductCreatedEvent } from '../../../common/events/product.events';

@Injectable()
export class ProductEventsListener {
  private readonly logger: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger = new LoggerService('ProductEventsListener');
  }

  @OnEvent('order.created')
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

      await this.prisma.product.update({
        where: { id: item.productId },
        data: { quantity: newQuantity },
      });

      // Emit product stock updated event
      this.eventEmitter.emit(
        'product.stock.updated',
        new ProductStockUpdatedEvent(
          item.productId,
          product.quantity,
          newQuantity,
          'purchase',
        ),
      );

      this.logger.log(`Product ${item.productId} stock: ${product.quantity} → ${newQuantity}`);
    }
  }

  @OnEvent('product.created')
  handleProductCreated(event: ProductCreatedEvent) {
    this.logger.log(`Product created: ${event.productId}`);
    // Future: Trigger cache invalidation, analytics, etc.
  }

  @OnEvent('product.updated')
  handleProductUpdated(payload: { productId: string }) {
    this.logger.log(`Product updated: ${payload.productId}`);
    // Future: Trigger cache invalidation
  }

  @OnEvent('product.stock.updated')
  async handleStockUpdated(event: ProductStockUpdatedEvent) {
    this.logger.log(
      `Stock updated: Product ${event.productId} from ${event.oldStock} to ${event.newStock} (${event.reason})`,
    );
    // TODO: Broadcast to WebSocket clients watching this product
    // TODO: Send notification if stock is low (< 10)
  }

  @OnEvent('product.deleted')
  handleProductDeleted(payload: { productId: string }) {
    this.logger.log(`Product deleted: ${payload.productId}`);
  }
}
