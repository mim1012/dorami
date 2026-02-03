import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { RedisService } from '../../../common/redis/redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redisService: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Execute PING command to check Redis connectivity
      const result = await this.redisService.ping();

      if (result === 'PONG') {
        return this.getStatus(key, true, {
          message: 'Redis connection is healthy',
        });
      }

      throw new Error('Unexpected PING response');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, {
          message: errorMessage,
        }),
      );
    }
  }
}
