import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';

describe('Reservation API (e2e)', () => {
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

  describe('POST /api/reservations', () => {
    it('should fail without authentication', () => {
      return request(app.getHttpServer())
        .post('/api/reservations')
        .send({ productId: 'product-1', quantity: 1 })
        .expect(401);
    });
  });

  describe('GET /api/reservations', () => {
    it('should fail without authentication', () => {
      return request(app.getHttpServer()).get('/api/reservations').expect(401);
    });
  });

  describe('DELETE /api/reservations/:id', () => {
    it('should fail without authentication', () => {
      return request(app.getHttpServer()).delete('/api/reservations/reservation-1').expect(401);
    });
  });
});
