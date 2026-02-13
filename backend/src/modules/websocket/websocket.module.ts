import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SocketIoProvider } from './socket-io.provider';
import { ProductAlertHandler } from './handlers/product-alert.handler';
import { OrderAlertHandler } from './handlers/order-alert.handler';
import { AdminNotificationHandler } from './handlers/admin-notification.handler';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    SocketIoProvider,
    ProductAlertHandler,
    OrderAlertHandler,
    AdminNotificationHandler,
  ],
  exports: [SocketIoProvider],
})
export class WebsocketModule {}
