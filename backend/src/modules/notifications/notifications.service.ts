import { Injectable } from '@nestjs/common';
import { KakaoTalkClient } from './clients/kakao-talk.client';
import { LoggerService } from '../../common/logger/logger.service';

@Injectable()
export class NotificationsService {
  private logger: LoggerService;

  constructor(private kakaoTalkClient: KakaoTalkClient) {
    this.logger = new LoggerService('NotificationsService');
  }

  async sendOrderCreatedNotification(userId: string, orderId: string): Promise<void> {
    await this.retryableNotification(async () => {
      await this.kakaoTalkClient.sendCustomMessage(
        userId,
        '주문 완료',
        `주문이 생성되었습니다. 주문번호: ${orderId}\n10분 이내에 결제를 완료해주세요.`,
      );
    });
  }

  async sendReservationPromotedNotification(userId: string, productId: string): Promise<void> {
    await this.retryableNotification(async () => {
      await this.kakaoTalkClient.sendCustomMessage(
        userId,
        '예비번호 승급',
        `축하합니다! 예비번호가 승급되었습니다.\n상품: ${productId}\n10분 이내에 주문을 완료해주세요.`,
      );
    });
  }

  async sendCartExpiredNotification(userId: string): Promise<void> {
    await this.retryableNotification(async () => {
      await this.kakaoTalkClient.sendCustomMessage(
        userId,
        '장바구니 만료',
        '장바구니가 만료되어 주문이 자동 취소되었습니다.',
      );
    });
  }

  /**
   * Retry notification up to 3 times (95% SLA requirement)
   */
  private async retryableNotification(
    fn: () => Promise<void>,
    maxRetries: number = 3,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await fn();
        return;
      } catch (error) {
        this.logger.warn(`Notification attempt ${attempt} failed: ${error.message}`);

        if (attempt === maxRetries) {
          this.logger.error('Notification failed after max retries');
          // In production, you'd send this to a dead-letter queue or monitoring system
          throw error;
        }

        // Exponential backoff
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
