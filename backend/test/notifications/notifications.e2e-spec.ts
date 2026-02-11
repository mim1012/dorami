import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';

describe('Notifications API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
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

    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/notifications/subscribe', () => {
    it('should fail without authentication', () => {
      return request(app.getHttpServer())
        .post('/api/notifications/subscribe')
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/test',
          p256dh: 'test-key',
          auth: 'test-auth',
        })
        .expect(401);
    });
  });

  describe('DELETE /api/notifications/unsubscribe', () => {
    it('should fail without authentication', () => {
      return request(app.getHttpServer())
        .delete('/api/notifications/unsubscribe')
        .send({ endpoint: 'https://fcm.googleapis.com/fcm/send/test' })
        .expect(401);
    });
  });

  describe('GET /api/notifications/subscriptions', () => {
    it('should fail without authentication', () => {
      return request(app.getHttpServer()).get('/api/notifications/subscriptions').expect(401);
    });
  });
});
