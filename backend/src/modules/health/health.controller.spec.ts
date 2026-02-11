import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RedisHealthIndicator } from './indicators/redis.health';

describe('HealthController', () => {
  let controller: HealthController;

  const mockHealthCheckService = {
    check: jest.fn(),
  };

  const mockPrismaHealth = {
    isHealthy: jest.fn(),
  };

  const mockRedisHealth = {
    isHealthy: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: PrismaHealthIndicator, useValue: mockPrismaHealth },
        { provide: RedisHealthIndicator, useValue: mockRedisHealth },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    jest.clearAllMocks();
  });

  describe('check', () => {
    it('should return healthy status when all services are up', async () => {
      const healthResult = {
        status: 'ok',
        details: {
          database: { status: 'up' },
          redis: { status: 'up' },
        },
      };
      mockHealthCheckService.check.mockResolvedValue(healthResult);

      const result = await controller.check();

      expect(result.status).toBe('ok');
      expect(mockHealthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
        expect.any(Function),
      ]);
    });
  });

  describe('liveness', () => {
    it('should return ok status with timestamp', () => {
      const result = controller.liveness();

      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('readiness', () => {
    it('should check database and redis health', async () => {
      const healthResult = {
        status: 'ok',
        details: {
          database: { status: 'up' },
          redis: { status: 'up' },
        },
      };
      mockHealthCheckService.check.mockResolvedValue(healthResult);

      const result = await controller.readiness();

      expect(result.status).toBe('ok');
      expect(mockHealthCheckService.check).toHaveBeenCalled();
    });
  });
});
