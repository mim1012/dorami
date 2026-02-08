import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KakaoTalkClient } from './clients/kakao-talk.client';
import { PushNotificationService } from './push-notification.service';
import { LoggerService } from '../../common/logger/logger.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private logger: LoggerService;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(
    private kakaoTalkClient: KakaoTalkClient,
    @Inject(forwardRef(() => PushNotificationService))
    private pushNotificationService: PushNotificationService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.logger = new LoggerService();
    this.logger.setContext('NotificationsService');
    this.maxRetries = this.configService.get<number>('NOTIFICATION_MAX_RETRIES', 3);
    this.retryDelayMs = this.configService.get<number>('NOTIFICATION_RETRY_DELAY_MS', 1000);
  }

  async sendOrderCreatedNotification(userId: string, orderId: string): Promise<void> {
    const template = await this.getTemplate('ORDER_CREATED');
    const message = this.replaceVariables(template, { orderId });

    await this.retryableNotification(async () => {
      await this.kakaoTalkClient.sendCustomMessage(userId, '주문 완료', message);
    });
  }

  async sendReservationPromotedNotification(userId: string, productId: string): Promise<void> {
    const template = await this.getTemplate('RESERVATION_PROMOTED');
    const message = this.replaceVariables(template, { productId });

    await this.retryableNotification(async () => {
      await this.kakaoTalkClient.sendCustomMessage(userId, '예비번호 승급', message);
    });
  }

  async sendCartExpiredNotification(userId: string): Promise<void> {
    const template = await this.getTemplate('CART_EXPIRED');
    const message = this.replaceVariables(template, {});

    await this.retryableNotification(async () => {
      await this.kakaoTalkClient.sendCustomMessage(userId, '장바구니 만료', message);
    });
  }

  async sendPaymentConfirmedNotification(userId: string, orderId: string): Promise<void> {
    const template = await this.getTemplate('PAYMENT_CONFIRMED');
    const message = this.replaceVariables(template, { orderId });

    await this.retryableNotification(async () => {
      await this.kakaoTalkClient.sendCustomMessage(userId, '결제 확인 완료', message);
    });
  }

  async sendPaymentReminderNotification(
    userId: string,
    orderId: string,
    amount: number,
    depositorName: string,
  ): Promise<void> {
    const template = await this.getTemplate('PAYMENT_REMINDER');
    const message = this.replaceVariables(template, {
      orderId,
      amount: amount.toLocaleString('ko-KR'),
      depositorName,
    });

    // 1순위: 웹 푸시
    try {
      const pushResult = await this.pushNotificationService.sendNotificationToUser(
        userId,
        '입금 안내',
        message,
        { type: 'payment_reminder', orderId, url: `/orders/${orderId}` },
      );
      if (pushResult.sent > 0) {
        this.logger.log(`Payment reminder sent via web push to user ${userId}`);
        return;
      }
    } catch (error) {
      this.logger.warn(`Web push failed for user ${userId}: ${error.message}`);
    }

    // 2순위: 카카오톡
    await this.retryableNotification(async () => {
      await this.kakaoTalkClient.sendCustomMessage(userId, '결제 알림', message);
    });
  }

  async sendShippingNotification(
    userId: string,
    orderId: string,
    trackingNumber: string,
  ): Promise<void> {
    const template = await this.getTemplate('SHIPPING_STARTED');
    const message = this.replaceVariables(template, { orderId, trackingNumber });

    // 1순위: 웹 푸시
    try {
      const pushResult = await this.pushNotificationService.sendNotificationToUser(
        userId,
        '배송 시작',
        message,
        { type: 'shipping', orderId, trackingNumber, url: `/orders/${orderId}` },
      );
      if (pushResult.sent > 0) {
        this.logger.log(`Shipping notification sent via web push to user ${userId}`);
        return;
      }
    } catch (error) {
      this.logger.warn(`Web push failed for user ${userId}: ${error.message}`);
    }

    // 2순위: 카카오톡
    await this.retryableNotification(async () => {
      await this.kakaoTalkClient.sendCustomMessage(userId, '배송 시작', message);
    });
  }

  /**
   * Retry notification (95% SLA requirement)
   * Uses NOTIFICATION_MAX_RETRIES and NOTIFICATION_RETRY_DELAY_MS from environment
   */
  private async retryableNotification(fn: () => Promise<void>): Promise<void> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await fn();
        return;
      } catch (error) {
        this.logger.warn(`Notification attempt ${attempt} failed: ${error.message}`);

        if (attempt === this.maxRetries) {
          this.logger.error('Notification failed after max retries');
          // In production, you'd send this to a dead-letter queue or monitoring system
          throw error;
        }

        // Exponential backoff using configured base delay
        await this.delay(Math.pow(2, attempt) * this.retryDelayMs);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get notification template from database by type
   */
  private async getTemplate(type: string): Promise<string> {
    const template = await this.prisma.notificationTemplate.findFirst({
      where: { type },
    });

    if (!template) {
      this.logger.warn(`Notification template not found for type: ${type}`);
      // Fallback to generic message
      return '알림이 도착했습니다.';
    }

    return template.template;
  }

  /**
   * Replace variables in template
   * Example: "주문번호: {{orderId}}" with {orderId: "ORD-123"} -> "주문번호: ORD-123"
   */
  private replaceVariables(template: string, variables: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value));
    }
    return result;
  }
}
