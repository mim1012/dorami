import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

describe('Admin Dashboard and Audit Log (Epic 12) - E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Create admin user and get token (assuming auth is set up)
    // adminToken = 'test-admin-token';
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.auditLog.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.liveStream.deleteMany({});
  });

  describe('GET /admin/dashboard/stats (Epic 12 Story 12.1)', () => {
    it('should return dashboard statistics', async () => {
      // Create test data for last 7 days
      const now = new Date();
      const last7Days = new Date(now);
      last7Days.setDate(last7Days.getDate() - 3);

      const testUser = await prisma.user.findFirst() || await prisma.user.create({
        data: {
          email: 'test@example.com',
          role: 'USER',
        },
      });

      // Create orders
      await prisma.order.createMany({
        data: [
          {
            id: 'order-1',
            userId: testUser.id,
            status: 'PENDING_PAYMENT',
            paymentMethod: 'BANK_TRANSFER',
            paymentStatus: 'CONFIRMED',
            total: 50000,
            createdAt: last7Days,
          },
          {
            id: 'order-2',
            userId: testUser.id,
            status: 'PENDING_PAYMENT',
            paymentMethod: 'BANK_TRANSFER',
            paymentStatus: 'PENDING',
            total: 30000,
            createdAt: last7Days,
          },
        ],
      });

      // Create live streams
      await prisma.liveStream.create({
        data: {
          streamKey: 'live-1',
          userId: testUser.id,
          title: 'Active Stream',
          status: 'LIVE',
          expiresAt: new Date('2024-12-31'),
        },
      });

      const response = await request(app.getHttpServer())
        .get('/admin/dashboard/stats')
        // .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.orders).toBeDefined();
      expect(response.body.revenue).toBeDefined();
      expect(response.body.pendingPayments).toBeDefined();
      expect(response.body.activeLiveStreams).toBeDefined();
      expect(response.body.topProducts).toBeDefined();

      expect(response.body.pendingPayments.value).toBe(1);
      expect(response.body.activeLiveStreams.value).toBe(1);
    });

    it('should calculate trends correctly', async () => {
      const testUser = await prisma.user.findFirst() || await prisma.user.create({
        data: {
          email: 'trend-test@example.com',
          role: 'USER',
        },
      });

      // Create more orders in last 7 days than previous 7 days
      const last7DaysStart = new Date();
      last7DaysStart.setDate(last7DaysStart.getDate() - 3);

      const previous7DaysStart = new Date();
      previous7DaysStart.setDate(previous7DaysStart.getDate() - 10);

      // Last 7 days: 3 orders
      await prisma.order.createMany({
        data: Array.from({ length: 3 }, (_, i) => ({
          id: `order-last-${i}`,
          userId: testUser.id,
          status: 'PENDING_PAYMENT',
          paymentMethod: 'BANK_TRANSFER',
          paymentStatus: 'CONFIRMED',
          total: 50000,
          createdAt: last7DaysStart,
        })),
      });

      // Previous 7 days: 1 order
      await prisma.order.create({
        data: {
          id: 'order-prev',
          userId: testUser.id,
          status: 'PENDING_PAYMENT',
          paymentMethod: 'BANK_TRANSFER',
          paymentStatus: 'CONFIRMED',
          total: 50000,
          createdAt: previous7DaysStart,
        },
      });

      const response = await request(app.getHttpServer())
        .get('/admin/dashboard/stats')
        .expect(200);

      expect(response.body.orders.trendUp).toBe(true);
      expect(response.body.revenue.trendUp).toBe(true);
    });
  });

  describe('GET /admin/audit-logs (Epic 12 Story 12.3)', () => {
    it('should return paginated audit logs', async () => {
      const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } }) ||
        await prisma.user.create({
          data: {
            email: 'admin@example.com',
            role: 'ADMIN',
          },
        });

      // Create audit logs
      await prisma.auditLog.createMany({
        data: [
          {
            adminId: adminUser.id,
            action: 'CONFIRM_PAYMENT',
            entity: 'Order',
            entityId: 'order-1',
            changes: { status: 'CONFIRMED' },
          },
          {
            adminId: adminUser.id,
            action: 'UPDATE',
            entity: 'Product',
            entityId: 'product-1',
            changes: { price: 25000 },
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/admin/audit-logs')
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.total).toBeGreaterThanOrEqual(2);
    });

    it('should filter audit logs by action type', async () => {
      const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } }) ||
        await prisma.user.create({
          data: {
            email: 'filter-admin@example.com',
            role: 'ADMIN',
          },
        });

      await prisma.auditLog.createMany({
        data: [
          {
            adminId: adminUser.id,
            action: 'CONFIRM_PAYMENT',
            entity: 'Order',
            entityId: 'order-1',
            changes: { status: 'CONFIRMED' },
          },
          {
            adminId: adminUser.id,
            action: 'UPDATE',
            entity: 'Product',
            entityId: 'product-1',
            changes: { price: 25000 },
          },
          {
            adminId: adminUser.id,
            action: 'CONFIRM_PAYMENT',
            entity: 'Order',
            entityId: 'order-2',
            changes: { status: 'CONFIRMED' },
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/admin/audit-logs?action=CONFIRM_PAYMENT')
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.every((log: any) => log.action === 'CONFIRM_PAYMENT')).toBe(true);
    });

    it('should filter audit logs by date range', async () => {
      const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } }) ||
        await prisma.user.create({
          data: {
            email: 'date-admin@example.com',
            role: 'ADMIN',
          },
        });

      const oldDate = new Date('2024-01-01');
      const recentDate = new Date('2024-01-15');

      await prisma.auditLog.create({
        data: {
          adminId: adminUser.id,
          action: 'OLD_ACTION',
          entity: 'Order',
          entityId: 'order-old',
          changes: {},
          createdAt: oldDate,
        },
      });

      await prisma.auditLog.create({
        data: {
          adminId: adminUser.id,
          action: 'RECENT_ACTION',
          entity: 'Order',
          entityId: 'order-recent',
          changes: {},
          createdAt: recentDate,
        },
      });

      const response = await request(app.getHttpServer())
        .get('/admin/audit-logs?from=2024-01-10&to=2024-01-20')
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.every((log: any) =>
        new Date(log.timestamp) >= new Date('2024-01-10') &&
        new Date(log.timestamp) <= new Date('2024-01-20')
      )).toBe(true);
    });

    it('should handle pagination correctly', async () => {
      const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } }) ||
        await prisma.user.create({
          data: {
            email: 'pagination-admin@example.com',
            role: 'ADMIN',
          },
        });

      // Create 60 audit logs
      const logs = Array.from({ length: 60 }, (_, i) => ({
        adminId: adminUser.id,
        action: 'TEST_ACTION',
        entity: 'Test',
        entityId: `test-${i}`,
        changes: {},
      }));

      await prisma.auditLog.createMany({ data: logs });

      const page1 = await request(app.getHttpServer())
        .get('/admin/audit-logs?page=1&limit=50')
        .expect(200);

      expect(page1.body.data.length).toBeLessThanOrEqual(50);
      expect(page1.body.meta.page).toBe(1);
      expect(page1.body.meta.totalPages).toBeGreaterThanOrEqual(2);

      const page2 = await request(app.getHttpServer())
        .get('/admin/audit-logs?page=2&limit=50')
        .expect(200);

      expect(page2.body.meta.page).toBe(2);
    });
  });
});
