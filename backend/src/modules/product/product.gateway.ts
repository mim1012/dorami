import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ProductResponseDto } from './dto/product.dto';

/**
 * WebSocket Gateway for real-time product updates
 * Broadcasts product events to all viewers watching a stream
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3001'],
    credentials: true,
  },
  namespace: '/',
})
export class ProductGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ProductGateway.name);

  /**
   * Broadcast when a new product is added to a stream
   * Event: live:product:added
   */
  async broadcastProductAdded(streamKey: string, product: ProductResponseDto): Promise<void> {
    const room = `stream:${streamKey}`;

    this.server.to(room).emit('live:product:added', {
      type: 'live:product:added',
      data: product,
    });

    this.logger.log(`Product added broadcast sent to room ${room}: ${product.id}`);
  }

  /**
   * Broadcast when a product is updated
   * Event: live:product:updated
   */
  async broadcastProductUpdated(streamKey: string, product: ProductResponseDto): Promise<void> {
    const room = `stream:${streamKey}`;

    this.server.to(room).emit('live:product:updated', {
      type: 'live:product:updated',
      data: product,
    });

    this.logger.log(`Product updated broadcast sent to room ${room}: ${product.id}`);
  }

  /**
   * Broadcast when a product is marked as sold out
   * Event: live:product:soldout
   */
  async broadcastProductSoldOut(streamKey: string, productId: string): Promise<void> {
    const room = `stream:${streamKey}`;

    this.server.to(room).emit('live:product:soldout', {
      type: 'live:product:soldout',
      data: { productId },
    });

    this.logger.log(`Product sold out broadcast sent to room ${room}: ${productId}`);
  }

  /**
   * Handle client joining a stream room
   */
  @SubscribeMessage('stream:join')
  handleStreamJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamKey: string },
  ): void {
    const room = `stream:${data.streamKey}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
  }

  /**
   * Handle client leaving a stream room
   */
  @SubscribeMessage('stream:leave')
  handleStreamLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamKey: string },
  ): void {
    const room = `stream:${data.streamKey}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room ${room}`);
  }
}
