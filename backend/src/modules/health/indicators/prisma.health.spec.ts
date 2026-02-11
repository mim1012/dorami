import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckError } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('PrismaHealthIndicator', () => {
  let indicator: PrismaHealthIndicator;

  const mockPrisma = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaHealthIndicator, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    indicator = module.get<PrismaHealthIndicator>(PrismaHealthIndicator);
    jest.clearAllMocks();
  });

  it('should return healthy when database is connected', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await indicator.isHealthy('database');

    expect(result.database.status).toBe('up');
  });

  it('should throw HealthCheckError when database is down', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

    await expect(indicator.isHealthy('database')).rejects.toThrow(HealthCheckError);
  });

  it('should include error message in health check error', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection timeout'));

    try {
      await indicator.isHealthy('database');
      fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(HealthCheckError);
      expect((error as HealthCheckError).causes).toEqual(
        expect.objectContaining({
          database: expect.objectContaining({
            status: 'down',
          }),
        }),
      );
    }
  });
});
