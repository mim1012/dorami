import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductEventsListener } from './listeners/product-events.listener';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ProductEventsListener],
  exports: [ProductsService],
})
export class ProductsModule {}
