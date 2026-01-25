import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WebsocketGateway } from './websocket.gateway';
import { ProductAlertHandler } from './handlers/product-alert.handler';
import { OrderAlertHandler } from './handlers/order-alert.handler';

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
  providers: [WebsocketGateway, ProductAlertHandler, OrderAlertHandler],
  exports: [WebsocketGateway],
})
export class WebsocketModule {}
