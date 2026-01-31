import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WebsocketGateway } from '../websocket.gateway';
import { LoggerService } from '../../../common/logger/logger.service';

@Injectable()
export class ProductAlertHandler {
  private logger: LoggerService;

  constructor(private websocketGateway: WebsocketGateway) {
    this.logger = new LoggerService();
    this.logger.setContext('ProductAlertHandler');
  }

  @OnEvent('product:stock:updated')
  handleStockUpdated(payload: {
    productId: string;
    oldStock: number;
    newStock: number;
  }) {
    this.logger.log(`Broadcasting stock update for product ${payload.productId}`);

    // Broadcast to all active streams
    // In real implementation, you'd need to know which stream the product belongs to
    this.websocketGateway.server.emit('product:stock:changed', {
      productId: payload.productId,
      oldStock: payload.oldStock,
      newStock: payload.newStock,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('product:created')
  handleProductCreated(payload: { productId: string }) {
    this.logger.log(`Broadcasting new product: ${payload.productId}`);

    this.websocketGateway.server.emit('product:new', {
      productId: payload.productId,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('product:updated')
  handleProductUpdated(payload: { productId: string }) {
    this.logger.log(`Broadcasting product update: ${payload.productId}`);

    this.websocketGateway.server.emit('product:updated', {
      productId: payload.productId,
      timestamp: new Date().toISOString(),
    });
  }
}
