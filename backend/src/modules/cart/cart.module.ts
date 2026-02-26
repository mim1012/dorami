import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { CartEventsListener } from './listeners/cart-events.listener';
import { WebsocketModule } from '../websocket/websocket.module';
import { EncryptionService } from '../../common/services/encryption.service';

@Module({
  imports: [WebsocketModule],
  controllers: [CartController],
  providers: [CartService, CartEventsListener, EncryptionService],
  exports: [CartService],
})
export class CartModule {}
