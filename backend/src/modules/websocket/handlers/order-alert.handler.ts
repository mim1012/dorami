import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '../../../common/logger/logger.service';
import { SocketIoProvider } from '../socket-io.provider';

@Injectable()
export class OrderAlertHandler {
  private logger: LoggerService;

  constructor(private readonly socketIo: SocketIoProvider) {
    this.logger = new LoggerService();
    this.logger.setContext('OrderAlertHandler');
  }

  @OnEvent('order:created')
  handleOrderCreated(payload: { orderId: string; userId: string; streamId?: string }) {
    this.logger.log(`Broadcasting new order: ${payload.orderId}`);

    if (payload.streamId) {
      // Broadcast to specific stream room
      this.socketIo.server.to(`stream:${payload.streamId}`).emit('order:new', {
        orderId: payload.orderId,
        userId: payload.userId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @OnEvent('order:cancelled')
  handleOrderCancelled(payload: { orderId: string; streamId?: string }) {
    this.logger.log(`Broadcasting order cancellation: ${payload.orderId}`);

    if (payload.streamId) {
      this.socketIo.server.to(`stream:${payload.streamId}`).emit('order:cancelled', {
        orderId: payload.orderId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @OnEvent('reservation:promoted')
  handleReservationPromoted(payload: {
    userId: string;
    productId: string;
    streamId?: string;
  }) {
    this.logger.log(`Broadcasting reservation promotion for user ${payload.userId}`);

    if (payload.streamId) {
      this.socketIo.server.to(`stream:${payload.streamId}`).emit('reservation:promoted', {
        userId: payload.userId,
        productId: payload.productId,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
