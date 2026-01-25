import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { InventoryService } from './inventory.service';
import { ReservationService } from './reservation.service';
import { OrderEventsListener } from './listeners/order-events.listener';

@Module({
  controllers: [OrdersController],
  providers: [
    OrdersService,
    InventoryService,
    ReservationService,
    OrderEventsListener,
  ],
  exports: [OrdersService, InventoryService, ReservationService],
})
export class OrdersModule {}
