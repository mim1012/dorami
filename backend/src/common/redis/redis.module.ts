import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { MessageQueueService } from '../services/message-queue.service';

@Global()
@Module({
  providers: [RedisService, MessageQueueService],
  exports: [RedisService, MessageQueueService],
})
export class RedisModule {}
