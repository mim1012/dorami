import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

interface QueueMessage {
  event: string;
  data: Record<string, unknown>;
  queuedAt: number;
}

@Injectable()
export class MessageQueueService {
  private readonly logger = new Logger(MessageQueueService.name);
  private readonly maxQueueSize = 100;
  private readonly queueTtlSeconds = 60 * 60; // 1 hour

  constructor(private readonly redisService: RedisService) {}

  private getQueueKey(userId: string): string {
    return `message-queue:${userId}`;
  }

  async queueMessage(userId: string, message: Omit<QueueMessage, 'queuedAt'>): Promise<void> {
    const key = this.getQueueKey(userId);
    const payload = JSON.stringify({
      ...message,
      queuedAt: Date.now(),
    });

    try {
      await this.redisService.rpush(key, payload);

      const count = await this.redisService.llen(key);
      if (count > this.maxQueueSize) {
        // Keep only latest maxQueueSize messages
        await this.redisService.ltrim(key, -this.maxQueueSize, -1);
      }

      await this.redisService.expire(key, this.queueTtlSeconds);
    } catch (error) {
      this.logger.error(`Failed to queue message for user=${userId}`, error as Error);
    }
  }

  async getQueuedMessages(userId: string): Promise<QueueMessage[]> {
    const key = this.getQueueKey(userId);

    try {
      const rawMessages = await this.redisService.lrange(key, 0, -1);
      await this.redisService.del(key);

      if (!rawMessages?.length) {
        return [];
      }

      return rawMessages
        .map((raw) => {
          try {
            const parsed = JSON.parse(raw) as QueueMessage;
            return parsed;
          } catch {
            return null;
          }
        })
        .filter((item): item is QueueMessage => item !== null);
    } catch (error) {
      this.logger.error(`Failed to load queued messages for user=${userId}`, error as Error);
      return [];
    }
  }
}
