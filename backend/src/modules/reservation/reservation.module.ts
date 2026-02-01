import { Module } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { ReservationController } from './reservation.controller';
import { ReservationEventsListener } from './listeners/reservation-events.listener';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ReservationController],
  providers: [ReservationService, ReservationEventsListener],
  exports: [ReservationService],
})
export class ReservationModule {}
