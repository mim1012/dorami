import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { NotificationsController } from '../src/modules/notifications/notifications.controller';
import { PushNotificationService } from '../src/modules/notifications/push-notification.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

describe('Notifications API route bindings (e2e)', () => {
  let app: INestApplication;
  const userId = 'user-1';

  const mockPushNotificationService = {
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    getSubscriptions: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: PushNotificationService,
          useValue: mockPushNotificationService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { userId };
          return true;
        },
      })
      .compile();

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
    mockPushNotificationService.subscribe.mockReset();
    mockPushNotificationService.unsubscribe.mockReset();
    mockPushNotificationService.getSubscriptions.mockReset();
  });

  it('POST /api/notifications/subscribe (POST body binding)', async () => {
    const endpoint = 'https://example.invalid/subscription';
    const payload = { endpoint, p256dh: 'p256dh-key', auth: 'auth-key', liveStreamId: 'live-1' };

    mockPushNotificationService.subscribe.mockResolvedValue({
      id: 'sub-1',
      userId,
      liveStreamId: payload.liveStreamId,
      createdAt: new Date().toISOString(),
    });

    const response = await request(app.getHttpServer())
      .post('/api/notifications/subscribe')
      .send(payload)
      .expect(201);

    expect(mockPushNotificationService.subscribe).toHaveBeenCalledWith(userId, payload);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toMatchObject({
      id: 'sub-1',
      userId,
      liveStreamId: payload.liveStreamId,
    });
  });

  it('DELETE /api/notifications/unsubscribe (DELETE body binding)', async () => {
    const endpoint = 'https://example.invalid/subscription';

    mockPushNotificationService.unsubscribe.mockResolvedValue({ success: true });

    const response = await request(app.getHttpServer())
      .delete('/api/notifications/unsubscribe')
      .send({ endpoint })
      .expect(200);

    expect(mockPushNotificationService.unsubscribe).toHaveBeenCalledWith(userId, endpoint);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('success', true);
  });

  it('DELETE /api/notifications/unsubscribe rejects missing endpoint in body', async () => {
    const response = await request(app.getHttpServer())
      .delete('/api/notifications/unsubscribe')
      .send({})
      .expect(400);

    // ValidationPipe throws BadRequestException — NestJS default format (not wrapped by BusinessExceptionFilter)
    expect(response.body).toHaveProperty('statusCode', 400);
    expect(response.body.message).toEqual(expect.arrayContaining([expect.stringContaining('endpoint')]));
    expect(mockPushNotificationService.unsubscribe).not.toHaveBeenCalled();
  });
});
