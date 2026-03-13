import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HealthCheckService } from '@nestjs/terminus';
import request from 'supertest';
import { HealthController } from '../src/modules/health/health.controller';
import { PrismaHealthIndicator } from '../src/modules/health/indicators/prisma.health';
import { RedisHealthIndicator } from '../src/modules/health/indicators/redis.health';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

describe('Health API route bindings (e2e)', () => {
  let app: INestApplication;
  const mockHealthCheckService = {
    check: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: mockHealthCheckService,
        },
        {
          provide: PrismaHealthIndicator,
          useValue: {},
        },
        {
          provide: RedisHealthIndicator,
          useValue: {},
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor(moduleFixture.get(Reflector)));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockHealthCheckService.check.mockReset();
  });

  it('/api/health/full (GET)', async () => {
    mockHealthCheckService.check.mockResolvedValue({
      status: 'ok',
      details: {
        database: { status: 'up' },
        redis: { status: 'up' },
      },
    });

    const response = await request(app.getHttpServer())
      .get('/api/health/full')
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toEqual({
      status: 'ok',
      details: {
        database: { status: 'up' },
        redis: { status: 'up' },
      },
    });
  });

  it('/api/health/live (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health/live')
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('status', 'ok');
    expect(response.body.data).toHaveProperty('timestamp');
  });

  it('/api/health/ready (GET)', async () => {
    mockHealthCheckService.check.mockResolvedValue({
      status: 'ok',
      details: {
        database: { status: 'up' },
        redis: { status: 'up' },
      },
    });

    const response = await request(app.getHttpServer())
      .get('/api/health/ready')
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('status', 'ok');
    expect(response.body.data).toHaveProperty('details.database.status', 'up');
  });

  it('/api/health (GET) keeps backward-compatible alias', async () => {
    mockHealthCheckService.check.mockResolvedValue({
      status: 'ok',
      details: {
        database: { status: 'up' },
        redis: { status: 'up' },
      },
    });

    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toEqual({
      status: 'ok',
      details: {
        database: { status: 'up' },
        redis: { status: 'up' },
      },
    });
  });
});
