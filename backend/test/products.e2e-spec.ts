import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

describe('Products API (e2e)', () => {
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

    app.useGlobalInterceptors(new TransformInterceptor(moduleFixture.get(Reflector)));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/products (GET) - should return products list', () => {
    return request(app.getHttpServer())
      .get('/api/products')
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
      });
  });

  it('/products (POST) - should fail without authentication', () => {
    return request(app.getHttpServer())
      .post('/api/products')
      .send({
        name: 'Test Product',
        price: 10000,
        stock: 100,
      })
      .expect(401);
  });
});
