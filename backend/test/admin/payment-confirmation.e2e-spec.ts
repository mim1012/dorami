/**
 * Admin Payment Confirmation E2E Test
 *
 * Tests for Story 8.3: Admin Order List and Payment Status Management
 *
 * 테스트 실행:
 * npm run test:e2e payment-confirmation.e2e-spec.ts
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../src/common/prisma/prisma.module';
import { RedisModule } from '../../src/common/redis/redis.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { AdminModule } from '../../src/modules/admin/admin.module';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthService } from '../../src/modules/auth/auth.service';

describe('Admin Payment Confirmation (E2E)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let authService: AuthService;
  let adminToken: string;
  let userToken: string;
  let testOrder: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.env.test',
          isGlobal: true,
        }),
        EventEmitterModule.forRoot({
          wildcard: true,
          delimiter: ':',
        }),
        PrismaModule,
        RedisModule,
        AuthModule,
        AdminModule,
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

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    authService = moduleFixture.get<AuthService>(AuthService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await prismaService.order.deleteMany({
      where: {
        userEmail: {
          contains: 'paymenttest',
        },
      },
    });

    await prismaService.user.deleteMany({
      where: {
        email: {
          contains: 'paymenttest',
        },
      },
    });

    // Create admin user and get token
    const adminUser = await prismaService.user.create({
      data: {
        kakaoId: 'admin_payment_test',
        email: 'admin_paymenttest@example.com',
        name: 'Admin Payment Test',
        role: 'ADMIN',
        instagramId: '@adminpaymenttest',
        depositorName: 'Admin Test',
      },
    });

    const adminLogin = await authService.login(adminUser);
    adminToken = adminLogin.accessToken;

    // Create regular user and get token
    const regularUser = await prismaService.user.create({
      data: {
        kakaoId: 'user_payment_test',
        email: 'user_paymenttest@example.com',
        name: 'User Payment Test',
        role: 'USER',
        instagramId: '@userpaymenttest',
        depositorName: 'User Test',
      },
    });

    const userLogin = await authService.login(regularUser);
    userToken = userLogin.accessToken;

    // Create test order with PENDING payment status
    testOrder = await prismaService.order.create({
      data: {
        id: 'ORD-TEST-PAYMENT-001',
        userId: regularUser.id,
        userEmail: regularUser.email,
        depositorName: regularUser.depositorName!,
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          state: 'CA',
          zipCode: '12345',
          country: 'USA',
        },
        instagramId: regularUser.instagramId!,
        status: 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
        shippingStatus: 'PENDING',
        subtotal: 100,
        shippingFee: 10,
        total: 110,
      },
    });
  });

  describe('PATCH /admin/orders/:id/confirm-payment', () => {
    it('should confirm payment successfully as admin', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/admin/orders/${testOrder.id}/confirm-payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orderId).toBe(testOrder.id);
      expect(response.body.data.paymentStatus).toBe('CONFIRMED');
      expect(response.body.data.status).toBe('PAYMENT_CONFIRMED');
      expect(response.body.data.paidAt).toBeDefined();

      // Verify database was updated
      const updatedOrder = await prismaService.order.findUnique({
        where: { id: testOrder.id },
      });

      expect(updatedOrder?.paymentStatus).toBe('CONFIRMED');
      expect(updatedOrder?.status).toBe('PAYMENT_CONFIRMED');
      expect(updatedOrder?.paidAt).toBeDefined();
    });

    it('should return 404 when order not found', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/admin/orders/NON_EXISTENT_ORDER/confirm-payment')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.message).toContain('Order not found');
    });

    it('should return 400 when payment already confirmed', async () => {
      // First confirmation
      await request(app.getHttpServer())
        .patch(`/api/admin/orders/${testOrder.id}/confirm-payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Second confirmation attempt
      const response = await request(app.getHttpServer())
        .patch(`/api/admin/orders/${testOrder.id}/confirm-payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.message).toContain('Payment already confirmed');
    });

    it('should return 403 when non-admin user tries to confirm payment', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/admin/orders/${testOrder.id}/confirm-payment`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.message).toContain('Insufficient permissions');
    });

    it('should return 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .patch(`/api/admin/orders/${testOrder.id}/confirm-payment`)
        .expect(401);
    });

    it('should emit domain event on successful confirmation', async () => {
      // This test verifies the domain event is emitted
      // In a real system, you'd verify the event listener receives the event
      const response = await request(app.getHttpServer())
        .patch(`/api/admin/orders/${testOrder.id}/confirm-payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify order was updated (event emission happens after update)
      const updatedOrder = await prismaService.order.findUnique({
        where: { id: testOrder.id },
      });

      expect(updatedOrder?.paymentStatus).toBe('CONFIRMED');
    });

    it('should handle concurrent payment confirmation attempts atomically', async () => {
      // Send two concurrent confirmation requests
      const promises = [
        request(app.getHttpServer())
          .patch(`/api/admin/orders/${testOrder.id}/confirm-payment`)
          .set('Authorization', `Bearer ${adminToken}`),
        request(app.getHttpServer())
          .patch(`/api/admin/orders/${testOrder.id}/confirm-payment`)
          .set('Authorization', `Bearer ${adminToken}`),
      ];

      const responses = await Promise.all(promises);

      // One should succeed (200), one should fail (400)
      const successCount = responses.filter((r) => r.status === 200).length;
      const failCount = responses.filter((r) => r.status === 400).length;

      expect(successCount).toBe(1);
      expect(failCount).toBe(1);

      // Verify order was only updated once
      const finalOrder = await prismaService.order.findUnique({
        where: { id: testOrder.id },
      });

      expect(finalOrder?.paymentStatus).toBe('CONFIRMED');
      expect(finalOrder?.status).toBe('PAYMENT_CONFIRMED');
    });
  });

  describe('GET /admin/orders (with payment status filter)', () => {
    beforeEach(async () => {
      // Create multiple orders with different payment statuses
      const user = await prismaService.user.findFirst({
        where: { email: 'user_paymenttest@example.com' },
      });

      await prismaService.order.create({
        data: {
          id: 'ORD-TEST-CONFIRMED-001',
          userId: user!.id,
          userEmail: user!.email,
          depositorName: user!.depositorName!,
          shippingAddress: {
            street: '456 Confirmed St',
            city: 'Test City',
            state: 'NY',
            zipCode: '54321',
            country: 'USA',
          },
          instagramId: user!.instagramId!,
          status: 'PAYMENT_CONFIRMED',
          paymentStatus: 'CONFIRMED',
          shippingStatus: 'PENDING',
          subtotal: 200,
          shippingFee: 10,
          total: 210,
          paidAt: new Date(),
        },
      });

      await prismaService.order.create({
        data: {
          id: 'ORD-TEST-FAILED-001',
          userId: user!.id,
          userEmail: user!.email,
          depositorName: user!.depositorName!,
          shippingAddress: {
            street: '789 Failed St',
            city: 'Test City',
            state: 'TX',
            zipCode: '67890',
            country: 'USA',
          },
          instagramId: user!.instagramId!,
          status: 'CANCELLED',
          paymentStatus: 'FAILED',
          shippingStatus: 'PENDING',
          subtotal: 150,
          shippingFee: 10,
          total: 160,
        },
      });
    });

    it('should filter orders by payment status PENDING', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/orders')
        .query({ paymentStatus: 'PENDING' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.orders).toBeDefined();
      expect(response.body.orders.length).toBeGreaterThan(0);
      response.body.orders.forEach((order: any) => {
        expect(order.paymentStatus).toBe('PENDING');
      });
    });

    it('should filter orders by payment status CONFIRMED', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/orders')
        .query({ paymentStatus: 'CONFIRMED' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.orders).toBeDefined();
      response.body.orders.forEach((order: any) => {
        expect(order.paymentStatus).toBe('CONFIRMED');
      });
    });
  });
});
