import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductEventsListener } from './listeners/product-events.listener';
import { WebsocketModule } from '../websocket/websocket.module';
import { ProductSchedulerService } from './product-scheduler.service';

@Module({
  imports: [WebsocketModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductEventsListener, ProductSchedulerService],
  exports: [ProductsService],
})
export class ProductsModule {}
