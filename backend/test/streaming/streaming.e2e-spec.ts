import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';

describe('Streaming API (e2e)', () => {
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

  describe('GET /api/streaming/active', () => {
    it('should return active streams list (public)', () => {
      return request(app.getHttpServer())
        .get('/api/streaming/active')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
  });

  describe('GET /api/streaming/upcoming', () => {
    it('should return upcoming streams (public)', () => {
      return request(app.getHttpServer())
        .get('/api/streaming/upcoming')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeDefined();
        });
    });

    it('should respect limit parameter', () => {
      return request(app.getHttpServer())
        .get('/api/streaming/upcoming?limit=1')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });
  });

  describe('POST /api/streaming/start', () => {
    it('should fail without authentication', () => {
      return request(app.getHttpServer())
        .post('/api/streaming/start')
        .send({ expiresAt: new Date(Date.now() + 3600000).toISOString() })
        .expect(401);
    });
  });

  describe('POST /api/streaming/generate-key', () => {
    it('should fail without authentication', () => {
      return request(app.getHttpServer())
        .post('/api/streaming/generate-key')
        .send({ title: 'Test Stream' })
        .expect(401);
    });
  });

  describe('GET /api/streaming/history', () => {
    it('should fail without admin role', () => {
      return request(app.getHttpServer()).get('/api/streaming/history').expect(401);
    });
  });

  describe('POST /api/streaming/auth (RTMP callback)', () => {
    it('should reject invalid stream key', () => {
      return request(app.getHttpServer())
        .post('/api/streaming/auth')
        .send({ name: 'nonexistent-key', addr: '127.0.0.1' })
        .expect(403);
    });
  });

  describe('POST /api/streaming/done (RTMP callback)', () => {
    it('should handle unknown stream key gracefully', () => {
      return request(app.getHttpServer())
        .post('/api/streaming/done')
        .send({ name: 'nonexistent-key' })
        .expect(200);
    });
  });

  describe('GET /api/streaming/key/:streamKey/status', () => {
    it('should return stream status for valid key', () => {
      return request(app.getHttpServer())
        .get('/api/streaming/key/test-key/status')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('status');
          expect(res.body.data).toHaveProperty('viewerCount');
        });
    });
  });

  describe('GET /api/streaming/key/:streamKey/featured-product', () => {
    it('should return null product for non-featured stream', () => {
      return request(app.getHttpServer())
        .get('/api/streaming/key/test-key/featured-product')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.product).toBeNull();
        });
    });
  });
});
