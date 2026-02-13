import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server } from 'socket.io';
import { LoggerService } from '../../../common/logger/logger.service';

/**
 * Handles admin notifications via events
 * Removes circular dependency between AdminModule and WebsocketModule
 */
@Injectable()
export class AdminNotificationHandler {
  private readonly logger: LoggerService;

  constructor(@Inject('SOCKET_IO_SERVER') private readonly io: Server) {
    this.logger = new LoggerService();
    this.logger.setContext('AdminNotificationHandler');
  }

  /**
   * Handle notice update events from AdminService
   */
  @OnEvent('admin:notice:updated')
  handleNoticeUpdated(payload: {
    text: string | null;
    fontSize: number;
    fontFamily: string;
  }) {
    this.logger.log('Notice updated, broadcasting to all clients');

    this.io.emit('notice:updated', payload);
  }

  /**
   * Handle order payment confirmation events
   */
  @OnEvent('order:payment:confirmed')
  handlePaymentConfirmed(payload: {
    orderId: string;
    userId: string;
    userEmail: string;
    total: number;
  }) {
    this.logger.log(`Payment confirmed for order ${payload.orderId}`);

    // Broadcast to admin dashboard
    this.io.emit('admin:order:payment-confirmed', {
      type: 'admin:order:payment-confirmed',
      data: payload,
    });
  }
}
