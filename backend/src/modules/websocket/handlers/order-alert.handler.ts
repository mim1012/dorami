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
  handleOrderCreated(payload: {
    orderId: string;
    userId: string;
    streamKey?: string;
    streamKeys?: string[];
  }) {
    const streamKeys = [
      ...new Set([
        ...(payload.streamKeys ?? []),
        ...(payload.streamKey ? [payload.streamKey] : []),
      ]),
    ];
    const eventPayload = {
      orderId: payload.orderId,
      userId: payload.userId,
      streamKeys,
      timestamp: new Date().toISOString(),
    };

    this.logger.log(`Broadcasting new order: ${payload.orderId}`);

    if (streamKeys.length === 0) {
      this.logger.warn(`No streamKey available for order:created event ${payload.orderId}`);
      return;
    }

    for (const streamKey of streamKeys) {
      // Keep existing stream-specific behavior (for currently open live pages)
      this.socketIo.server.to(`stream:${streamKey}`).emit('order:new', eventPayload);
    }
  }

  @OnEvent('order:cancelled')
  handleOrderCancelled(payload: { orderId: string; streamKey?: string }) {
    this.logger.log(`Broadcasting order cancellation: ${payload.orderId}`);

    const eventPayload = {
      orderId: payload.orderId,
      timestamp: new Date().toISOString(),
      streamKey: payload.streamKey,
    };

    if (payload.streamKey) {
      this.socketIo.server.to(`stream:${payload.streamKey}`).emit('order:cancelled', eventPayload);
    }

    this.socketIo.server.emit('order:cancelled', eventPayload);
  }

  @OnEvent('reservation:promoted')
  handleReservationPromoted(payload: { userId: string; productId: string; streamId?: string }) {
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
