import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { CartEventsListener } from './listeners/cart-events.listener';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [WebsocketModule],
  controllers: [CartController],
  providers: [CartService, CartEventsListener],
  exports: [CartService],
})
export class CartModule {}
