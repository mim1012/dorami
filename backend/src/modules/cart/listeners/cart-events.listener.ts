import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '../../../common/logger/logger.service';
import { WebsocketGateway } from '../../websocket/websocket.gateway';

@Injectable()
export class CartEventsListener {
  private readonly logger: LoggerService;

  constructor(private readonly websocketGateway: WebsocketGateway) {
    this.logger = new LoggerService();
    this.logger.setContext('CartEventsListener');
  }

  /**
   * Epic 6: Handle cart:added event
   * Broadcast cart activity to stream viewers
   */
  @OnEvent('cart:added')
  handleCartAdded(payload: {
    userId: string;
    cartItemId: string;
    productId: string;
    productName: string;
    quantity: number;
    streamKey: string;
  }) {
    this.logger.log(
      `Cart added: User ${payload.userId}, Product ${payload.productName} x${payload.quantity}`,
    );

    // Broadcast to all viewers in the stream (for real-time cart activity feed)
    this.websocketGateway.broadcastToStream(payload.streamKey, 'live:cart:activity', {
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
   * Epic 6: Handle cart:expired event
   * Log expired carts for monitoring
   */
  @OnEvent('cart:expired')
  handleCartExpired(payload: { count: number; timestamp: Date }) {
    this.logger.log(`Expired ${payload.count} cart items at ${payload.timestamp}`);
  }
}
