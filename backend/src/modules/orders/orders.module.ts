import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EncryptionService } from '../../common/services/encryption.service';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { InventoryService } from './inventory.service';
import { ReservationService } from './reservation.service';
import { OrderEventsListener } from './listeners/order-events.listener';
import { PointsModule } from '../points/points.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReservationModule } from '../reservation/reservation.module';
@Module({
  imports: [ConfigModule, PointsModule, NotificationsModule, ReservationModule],
  controllers: [OrdersController],
  providers: [OrdersService, InventoryService, ReservationService, OrderEventsListener, EncryptionService],
  exports: [OrdersService, InventoryService, ReservationService],
})
export class OrdersModule {}
