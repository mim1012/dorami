import { Global, Module } from '@nestjs/common';
import { SocketIoProvider } from './socket-io.provider';
import { OrderAlertHandler } from './handlers/order-alert.handler';
import { AdminNotificationHandler } from './handlers/admin-notification.handler';

@Global()
@Module({
  providers: [SocketIoProvider, OrderAlertHandler, AdminNotificationHandler],
  exports: [SocketIoProvider],
})
export class WebsocketModule {}
