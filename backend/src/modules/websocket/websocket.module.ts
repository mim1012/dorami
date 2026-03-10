import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Server as SocketIOServer } from 'socket.io';
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
        // Lazy proxy: globalIoServer is set during bootstrap after app creation
        // Return a proxy that resolves to globalIoServer when methods are called
        return new Proxy({} as SocketIOServer, {
          get(_target, prop) {
            if (!globalIoServer) {
              // During module init before bootstrap completes, silently return no-op
              return () => undefined;
            }
            const value = (globalIoServer as any)[prop];
            return typeof value === 'function' ? value.bind(globalIoServer) : value;
          },
        });
      },
    },
    ProductAlertHandler,
    OrderAlertHandler,
    AdminNotificationHandler,
  ],
  exports: ['SOCKET_IO_SERVER'],
})
export class WebsocketModule {}
