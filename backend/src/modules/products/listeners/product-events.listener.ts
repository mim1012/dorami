import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '../../../common/logger/logger.service';

@Injectable()
export class ProductEventsListener {
  constructor(private logger: LoggerService) {
    this.logger = new LoggerService('ProductEventsListener');
  }

  @OnEvent('product:created')
  handleProductCreated(payload: { productId: string }) {
    this.logger.log(`Product created: ${payload.productId}`);
    // Future: Trigger cache invalidation, analytics, etc.
  }

  @OnEvent('product:updated')
  handleProductUpdated(payload: { productId: string }) {
    this.logger.log(`Product updated: ${payload.productId}`);
    // Future: Trigger cache invalidation
  }

  @OnEvent('product:stock:updated')
  handleStockUpdated(payload: {
    productId: string;
    oldStock: number;
    newStock: number;
  }) {
    this.logger.log(
      `Stock updated for product ${payload.productId}: ${payload.oldStock} -> ${payload.newStock}`,
    );
    // WebSocket broadcast will be handled by WebSocket module
  }

  @OnEvent('product:deleted')
  handleProductDeleted(payload: { productId: string }) {
    this.logger.log(`Product deleted: ${payload.productId}`);
  }
}
