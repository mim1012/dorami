import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SubscribeNotificationDto } from './dto/notification.dto';
import * as webpush from 'web-push';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(private prisma: PrismaService) {
    // Configure web-push with VAPID keys
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@live-commerce.com';

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      this.logger.log('Web Push configured with VAPID keys');
    } else {
      this.logger.warn('VAPID keys not configured. Push notifications will not work.');
    }
  }

  /**
   * Subscribe user to push notifications
   */
  async subscribe(userId: string, dto: SubscribeNotificationDto) {
    // Verify live stream exists if provided
    if (dto.liveStreamId) {
      const stream = await this.prisma.liveStream.findUnique({
        where: { id: dto.liveStreamId },
      });
      if (!stream) {
        throw new NotFoundException(`Live stream ${dto.liveStreamId} not found`);
      }
    }

    // Create or update subscription
    const subscription = await this.prisma.notificationSubscription.upsert({
      where: {
        userId_endpoint: {
          userId,
          endpoint: dto.endpoint,
        },
      },
      create: {
        userId,
        liveStreamId: dto.liveStreamId,
        endpoint: dto.endpoint,
        p256dh: dto.p256dh,
        auth: dto.auth,
      },
      update: {
        liveStreamId: dto.liveStreamId,
        p256dh: dto.p256dh,
        auth: dto.auth,
      },
    });

    this.logger.log(`User ${userId} subscribed to notifications (stream: ${dto.liveStreamId || 'all'})`);

    return {
      id: subscription.id,
      userId: subscription.userId,
      liveStreamId: subscription.liveStreamId,
      createdAt: subscription.createdAt,
    };
  }

  /**
   * Unsubscribe user from push notifications
   */
  async unsubscribe(userId: string, endpoint: string) {
    const subscription = await this.prisma.notificationSubscription.findUnique({
      where: {
        userId_endpoint: {
          userId,
          endpoint,
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    await this.prisma.notificationSubscription.delete({
      where: { id: subscription.id },
    });

    this.logger.log(`User ${userId} unsubscribed from notifications`);

    return { success: true };
  }

  /**
   * Get all subscriptions for a user
   */
  async getSubscriptions(userId: string) {
    const subscriptions = await this.prisma.notificationSubscription.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        liveStreamId: true,
        createdAt: true,
      },
    });

    return subscriptions;
  }

  /**
   * Send push notification to a specific user
   */
  async sendNotificationToUser(
    userId: string,
    title: string,
    body: string,
    data?: any,
  ) {
    const subscriptions = await this.prisma.notificationSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      this.logger.warn(`No subscriptions found for user ${userId}`);
      return { sent: 0, failed: 0 };
    }

    return this.sendNotifications(subscriptions, title, body, data);
  }

  /**
   * Send push notification for live stream start
   */
  async sendLiveStartNotification(liveStreamId: string) {
    const stream = await this.prisma.liveStream.findUnique({
      where: { id: liveStreamId },
      include: { user: true },
    });

    if (!stream) {
      throw new NotFoundException(`Live stream ${liveStreamId} not found`);
    }

    // Get all subscriptions for this stream (or global subscriptions)
    const subscriptions = await this.prisma.notificationSubscription.findMany({
      where: {
        OR: [
          { liveStreamId },
          { liveStreamId: null }, // Global subscriptions
        ],
      },
    });

    if (subscriptions.length === 0) {
      this.logger.log(`No subscribers for live stream ${liveStreamId}`);
      return { sent: 0, failed: 0 };
    }

    const title = '라이브 방송이 시작되었습니다!';
    const body = `${stream.title} - 지금 시청하세요`;
    const data = {
      url: `/live/${stream.streamKey}`,
      streamKey: stream.streamKey,
      liveStreamId: stream.id,
    };

    return this.sendNotifications(subscriptions, title, body, data);
  }

  /**
   * Send notifications to multiple subscriptions
   */
  private async sendNotifications(
    subscriptions: any[],
    title: string,
    body: string,
    data?: any,
  ) {
    const payload = JSON.stringify({
      title,
      body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: data || {},
    });

    let sent = 0;
    let failed = 0;
    const expiredSubscriptions: string[] = [];

    for (const subscription of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        };

        await webpush.sendNotification(pushSubscription, payload);
        sent++;
        this.logger.debug(`Notification sent to ${subscription.userId}`);
      } catch (error: any) {
        failed++;
        this.logger.error(
          `Failed to send notification to ${subscription.userId}: ${error.message}`,
        );

        // If subscription is expired (410 Gone), mark for deletion
        if (error.statusCode === 410) {
          expiredSubscriptions.push(subscription.id);
        }
      }
    }

    // Clean up expired subscriptions
    if (expiredSubscriptions.length > 0) {
      await this.prisma.notificationSubscription.deleteMany({
        where: { id: { in: expiredSubscriptions } },
      });
      this.logger.log(`Deleted ${expiredSubscriptions.length} expired subscriptions`);
    }

    this.logger.log(`Notifications sent: ${sent}, failed: ${failed}`);

    return { sent, failed };
  }

  /**
   * Check for upcoming live streams and send notifications
   * Called by Cron scheduler
   * Note: Requires scheduledTime field in LiveStream model
   */
  async checkAndNotifyUpcomingStreams() {
    // const now = new Date();
    // const tenMinutesLater = new Date(now.getTime() + 10 * 60 * 1000);
    // const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);

    // Find streams starting in 5-10 minutes
    const upcomingStreams = await this.prisma.liveStream.findMany({
      where: {
        status: 'PENDING',
        // TODO: Add scheduledTime field to LiveStream model
        // scheduledTime: {
        //   gte: fiveMinutesLater,
        //   lte: tenMinutesLater,
        // },
      },
      include: { user: true },
    });

    this.logger.log(`Found ${upcomingStreams.length} upcoming streams`);

    for (const stream of upcomingStreams) {
      try {
        // TODO: Add a flag to track if notification was sent for this stream
        await this.sendLiveStartNotification(stream.id);
      } catch (error: any) {
        this.logger.error(`Failed to notify for stream ${stream.id}: ${error.message}`);
      }
    }
  }
}
