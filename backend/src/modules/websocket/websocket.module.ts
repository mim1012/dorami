import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { globalIoServer } from '../../main';
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
    {
      provide: 'SOCKET_IO_SERVER',
      useFactory: () => {
        if (!globalIoServer) {
          throw new Error('Socket.IO server not initialized. Call setGlobalIoServer() in main.ts bootstrap.');
        }
        return globalIoServer;
      },
    },
    ProductAlertHandler,
    OrderAlertHandler,
    AdminNotificationHandler,
  ],
  exports: ['SOCKET_IO_SERVER'],
})
export class WebsocketModule {}
