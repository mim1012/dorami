import { Module } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { ReservationController } from './reservation.controller';
import { ReservationEventsListener } from './listeners/reservation-events.listener';
import { NotificationsModule } from '../notifications/notifications.module';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [NotificationsModule, CartModule],
  controllers: [ReservationController],
  providers: [ReservationService, ReservationEventsListener],
  exports: [ReservationService],
})
export class ReservationModule {}
