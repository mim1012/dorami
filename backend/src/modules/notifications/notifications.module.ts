import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { KakaoTalkClient } from './clients/kakao-talk.client';
import { NotificationEventsListener } from './listeners/notification-events.listener';

@Module({
  providers: [NotificationsService, KakaoTalkClient, NotificationEventsListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}
