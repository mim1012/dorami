import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';

describe('Store Products API (Epic 11) - E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  let testUser: any;

  beforeAll(async () => {
    // Create test user for live streams
    testUser = await prisma.user.create({
      data: {
        id: 'test-user-store-products',
        kakaoId: 'kakao-test-store',
        name: 'Store Test User',
        email: 'store@example.com',
        role: 'USER',
      },
    });
  });

  afterAll(async () => {
    // Clean up test data (delete live streams first due to foreign key)
    await prisma.liveStream.deleteMany({});
    await prisma.user.deleteMany({ where: { id: testUser.id } });
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.product.deleteMany({});
    await prisma.liveStream.deleteMany({});
  });

  describe('GET /products/store', () => {
    it('should return empty array when no store products exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/products/store')
        .expect(200);

      expect(response.body.data.data).toEqual([]);
      expect(response.body.data.meta.total).toBe(0);
      expect(response.body.data.meta.totalPages).toBe(0);
    });

    it('should return products from ended live streams only', async () => {
      // Create a live stream that ended
      const endedStream = await prisma.liveStream.create({
        data: {
          streamKey: 'ended-stream',
          userId: testUser.id,
          title: 'Past Live Stream',
          status: 'OFFLINE',
          startedAt: new Date('2024-01-01'),
          endedAt: new Date('2024-01-02'),
          expiresAt: new Date('2024-12-31'),
        },
      });

      // Create a live stream that is still active
      const liveStream = await prisma.liveStream.create({
        data: {
          streamKey: 'live-stream',
          userId: testUser.id,
          title: 'Current Live Stream',
          status: 'LIVE',
          startedAt: new Date(),
          expiresAt: new Date('2024-12-31'),
        },
      });

      // Create products for both streams
      await prisma.product.create({
        data: {
          streamKey: endedStream.streamKey,
          name: 'Past Product 1',
          price: 25000,
          quantity: 10,
          status: 'AVAILABLE',
        },
      });

      await prisma.product.create({
        data: {
          streamKey: endedStream.streamKey,
          name: 'Past Product 2',
          price: 35000,
          quantity: 5,
          status: 'AVAILABLE',
        },
      });

      await prisma.product.create({
        data: {
          streamKey: liveStream.streamKey,
          name: 'Live Product',
          price: 45000,
          quantity: 8,
          status: 'AVAILABLE',
        },
      });

      const response = await request(app.getHttpServer())
        .get('/products/store')
        .expect(200);

      expect(response.body.data.data).toHaveLength(2);
      expect(response.body.data.meta.total).toBe(2);
      expect(response.body.data.data[0].name).toContain('Past Product');
      expect(response.body.data.data[1].name).toContain('Past Product');
    });

    it('should handle pagination correctly', async () => {
      // Create ended stream
      const endedStream = await prisma.liveStream.create({
        data: {
          streamKey: 'store-stream',
          userId: testUser.id,
          title: 'Store Stream',
          status: 'OFFLINE',
          endedAt: new Date('2024-01-01'),
          expiresAt: new Date('2024-12-31'),
        },
      });

      // Create 30 products
      const products = Array.from({ length: 30 }, (_, i) => ({
        streamKey: endedStream.streamKey,
        name: `Product ${i + 1}`,
        price: 10000 + i * 1000,
        quantity: 5,
        status: 'AVAILABLE' as const,
      }));

      await prisma.product.createMany({ data: products });

      // Get page 1
      const page1 = await request(app.getHttpServer())
        .get('/products/store?page=1&limit=24')
        .expect(200);

      expect(page1.body.data.data).toHaveLength(24);
      expect(page1.body.data.meta.page).toBe(1);
      expect(page1.body.data.meta.totalPages).toBe(2);
      expect(page1.body.data.meta.total).toBe(30);

      // Get page 2
      const page2 = await request(app.getHttpServer())
        .get('/products/store?page=2&limit=24')
        .expect(200);

      expect(page2.body.data.data).toHaveLength(6);
      expect(page2.body.data.meta.page).toBe(2);
    });

    it('should not return sold out products', async () => {
      const endedStream = await prisma.liveStream.create({
        data: {
          streamKey: 'store-stream-2',
          userId: testUser.id,
          title: 'Store Stream 2',
          status: 'OFFLINE',
          endedAt: new Date('2024-01-01'),
          expiresAt: new Date('2024-12-31'),
        },
      });

      await prisma.product.create({
        data: {
          streamKey: endedStream.streamKey,
          name: 'Available Product',
          price: 25000,
          quantity: 10,
          status: 'AVAILABLE',
        },
      });

      await prisma.product.create({
        data: {
          streamKey: endedStream.streamKey,
          name: 'Sold Out Product',
          price: 35000,
          quantity: 0,
          status: 'SOLD_OUT',
        },
      });

      const response = await request(app.getHttpServer())
        .get('/products/store')
        .expect(200);

      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0].name).toBe('Available Product');
    });
  });
});
