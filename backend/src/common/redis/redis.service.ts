import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  private pubClient!: Redis;
  private subClient!: Redis;

  constructor(private configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisHost = this.configService.get<string>('REDIS_HOST') ?? 'localhost';
    const redisPort = this.configService.get<number>('REDIS_PORT') ?? 6379;
    const redisPassword = this.configService.get<string | undefined>('REDIS_PASSWORD');

    this.client = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      retryStrategy: (times: number): number | null => {
        if (times > 3) {
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });

    // Separate clients for Pub/Sub (Socket.IO Adapter)
    this.pubClient = this.client.duplicate();
    this.subClient = this.client.duplicate();

    this.logger.log(
      `Redis clients initialized (${redisHost}:${redisPort},` +
        `${redisPassword ? ' with password' : ' no password'})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this.client?.quit(),
      this.pubClient?.quit(),
      this.subClient?.quit(),
    ]).then((results) => {
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const name = index === 0 ? 'client' : index === 1 ? 'pub' : 'sub';
          this.logger.warn(`Redis ${name} quit failed: ${(result.reason as Error).message}`);
        }
      });
    });
  }

  getClient(): Redis {
    return this.client;
  }

  getPubClient(): Redis {
    return this.pubClient;
  }

  getSubClient(): Redis {
    return this.subClient;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.set(key, value, 'EX', ttl);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async rpush(key: string, value: string): Promise<number> {
    return this.client.rpush(key, value);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.lrange(key, start, stop);
  }

  async llen(key: string): Promise<number> {
    return this.client.llen(key);
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    await this.client.ltrim(key, start, stop);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.client.zadd(key, score, member);
  }

  async zpopmin(key: string, count = 1): Promise<string[]> {
    return this.client.zpopmin(key, count);
  }

  async zrank(key: string, member: string): Promise<number | null> {
    return this.client.zrank(key, member);
  }

  async zcard(key: string): Promise<number> {
    return this.client.zcard(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  /**
   * Health check - PING command
   */
  async ping(): Promise<string> {
    return this.client.ping();
  }
}
