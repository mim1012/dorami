import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server } from 'socket.io';
import { LoggerService } from '../../../common/logger/logger.service';

@Injectable()
export class ProductAlertHandler {
  private logger: LoggerService;

  constructor(@Inject('SOCKET_IO_SERVER') private io: Server) {
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

    // Broadcast to all connected clients
    this.io.emit('product:stock:changed', {
      productId: payload.productId,
      oldStock: payload.oldStock,
      newStock: payload.newStock,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('product:created')
  handleProductCreated(payload: { productId: string }) {
    this.logger.log(`Broadcasting new product: ${payload.productId}`);

    this.io.emit('product:new', {
      productId: payload.productId,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('product:updated')
  handleProductUpdated(payload: { productId: string }) {
    this.logger.log(`Broadcasting product update: ${payload.productId}`);

    this.io.emit('product:updated', {
      productId: payload.productId,
      timestamp: new Date().toISOString(),
    });
  }
}
