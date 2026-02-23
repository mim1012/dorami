import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '../../../common/logger/logger.service';
import { SocketIoProvider } from '../../websocket/socket-io.provider';

@Injectable()
export class CartEventsListener {
  private readonly logger: LoggerService;

  constructor(private readonly socketIo: SocketIoProvider) {
    this.logger = new LoggerService();
    this.logger.setContext('CartEventsListener');
  }

  /**
   * Handle cart:added event
   * Broadcast cart activity to stream viewers with user info
   */
  @OnEvent('cart:added')
  handleCartAdded(payload: {
    userId: string;
    userName: string;
    userColor: string;
    cartItemId: string;
    productId: string;
    productName: string;
    quantity: number;
    streamKey: string | null;
  }) {
    this.logger.log(
      `Cart added: User ${payload.userName} (${payload.userId}), Product ${payload.productName} x${payload.quantity}`,
    );

    if (!payload.streamKey) {
      this.logger.warn(
        `Cart added event for product ${payload.productId} has no streamKey — skipping broadcast`,
      );
      return;
    }

    const roomName = `stream:${payload.streamKey}`;

    // Broadcast to all viewers in the stream (for real-time cart activity feed)
    this.socketIo.server.to(roomName).emit('cart:item-added', {
      type: 'cart:item-added',
      data: {
        userId: payload.userId,
        userName: payload.userName,
        userColor: payload.userColor,
        productName: payload.productName,
        quantity: payload.quantity,
        timestamp: new Date().toISOString(),
      },
    });

    // Also emit the legacy event for backward compatibility
    this.socketIo.server.to(roomName).emit('live:cart:activity', {
      type: 'live:cart:activity',
      data: {
        productName: payload.productName,
        quantity: payload.quantity,
        timestamp: new Date().toISOString(),
      },
    });

    this.logger.log(`Cart activity broadcast sent to stream ${payload.streamKey}`);
  }

  /**
   * Handle cart:expired event
   * Log expired carts for monitoring
   */
  @OnEvent('cart:expired')
  handleCartExpired(payload: { count: number; timestamp: Date }) {
    this.logger.log(`Expired ${payload.count} cart items at ${payload.timestamp}`);
  }
}
