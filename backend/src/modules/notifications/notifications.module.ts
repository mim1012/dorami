import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PushNotificationService } from './push-notification.service';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { NotificationsController } from './notifications.controller';
import { KakaoTalkClient } from './clients/kakao-talk.client';
import { NotificationEventsListener } from './listeners/notification-events.listener';
import { AlimtalkModule } from '../admin/alimtalk.module';

@Module({
  imports: [AlimtalkModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PushNotificationService,
    NotificationSchedulerService,
    KakaoTalkClient,
    NotificationEventsListener,
  ],
  exports: [NotificationsService, PushNotificationService],
})
export class NotificationsModule {}
