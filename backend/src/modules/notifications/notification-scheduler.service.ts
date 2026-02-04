import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PushNotificationService } from './push-notification.service';

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(private pushNotificationService: PushNotificationService) {}

  /**
   * Check for upcoming live streams every 5 minutes
   * Sends notifications for streams starting in 5-10 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkUpcomingStreams() {
    this.logger.log('Checking for upcoming live streams...');

    try {
      await this.pushNotificationService.checkAndNotifyUpcomingStreams();
    } catch (error: any) {
      this.logger.error(`Failed to check upcoming streams: ${error.message}`);
    }
  }
}
