import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckError } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.health';
import { RedisService } from '../../../common/redis/redis.service';

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;

  const mockRedisService = {
    ping: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisHealthIndicator, { provide: RedisService, useValue: mockRedisService }],
    }).compile();

    indicator = module.get<RedisHealthIndicator>(RedisHealthIndicator);
    jest.clearAllMocks();
  });

  it('should return healthy when Redis responds PONG', async () => {
    mockRedisService.ping.mockResolvedValue('PONG');

    const result = await indicator.isHealthy('redis');

    expect(result.redis.status).toBe('up');
  });

  it('should throw HealthCheckError when Redis is down', async () => {
    mockRedisService.ping.mockRejectedValue(new Error('Connection refused'));

    await expect(indicator.isHealthy('redis')).rejects.toThrow(HealthCheckError);
  });

  it('should throw HealthCheckError when Redis returns unexpected response', async () => {
    mockRedisService.ping.mockResolvedValue('NOT_PONG');

    await expect(indicator.isHealthy('redis')).rejects.toThrow(HealthCheckError);
  });
});
