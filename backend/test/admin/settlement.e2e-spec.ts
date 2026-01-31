import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Settlement Management (E2E)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let regularUserToken: string;

  let adminUser: any;
  let regularUser: any;
  let confirmedOrders: any[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Create admin user
    adminUser = await prismaService.user.create({
      data: {
        id: 'admin-settlement-test',
        kakaoId: 'kakao-admin-settlement',
        name: 'Admin Settlement',
        email: 'admin-settlement@test.com',
        role: 'ADMIN',
        status: 'ACTIVE',
        instagramId: '@admin_settlement',
      },
    });

    adminToken = jwtService.sign({
      sub: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    });

    // Create regular user
    regularUser = await prismaService.user.create({
      data: {
        id: 'user-settlement-test',
        kakaoId: 'kakao-user-settlement',
        name: 'Regular User Settlement',
        email: 'user-settlement@test.com',
        role: 'USER',
        status: 'ACTIVE',
        instagramId: '@user_settlement',
      },
    });

    regularUserToken = jwtService.sign({
      sub: regularUser.id,
      email: regularUser.email,
      role: regularUser.role,
    });

    // Create test orders with CONFIRMED payment status
    const orderData = [
      {
        id: 'ORD-20260115-SET001',
        userId: regularUser.id,
        userEmail: regularUser.email!,
        depositorName: 'John Doe',
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          state: 'CA',
          zipCode: '12345',
          country: 'USA',
        },
        instagramId: '@user_settlement',
        subtotal: 100.5,
        shippingFee: 10,
        total: 110.5,
        paymentMethod: 'BANK_TRANSFER' as const,
        paymentStatus: 'CONFIRMED' as const,
        shippingStatus: 'PENDING' as const,
        status: 'PAYMENT_CONFIRMED' as const,
        paidAt: new Date('2026-01-15T10:00:00Z'),
        createdAt: new Date('2026-01-14T10:00:00Z'),
      },
      {
        id: 'ORD-20260120-SET002',
        userId: regularUser.id,
        userEmail: regularUser.email!,
        depositorName: 'Jane Smith',
        shippingAddress: {
          street: '456 Test Ave',
          city: 'Test City',
          state: 'NY',
          zipCode: '67890',
          country: 'USA',
        },
        instagramId: '@user_settlement',
        subtotal: 200.75,
        shippingFee: 15,
        total: 215.75,
        paymentMethod: 'BANK_TRANSFER' as const,
        paymentStatus: 'CONFIRMED' as const,
        shippingStatus: 'SHIPPED' as const,
        status: 'SHIPPED' as const,
        paidAt: new Date('2026-01-20T14:00:00Z'),
        createdAt: new Date('2026-01-19T10:00:00Z'),
      },
      {
        id: 'ORD-20260125-SET003',
        userId: regularUser.id,
        userEmail: regularUser.email!,
        depositorName: 'Bob Johnson',
        shippingAddress: {
          street: '789 Test Blvd',
          city: 'Test City',
          state: 'TX',
          zipCode: '11111',
          country: 'USA',
        },
        instagramId: '@user_settlement',
        subtotal: 50.25,
        shippingFee: 5,
        total: 55.25,
        paymentMethod: 'BANK_TRANSFER' as const,
        paymentStatus: 'PENDING' as const, // Not confirmed - should not appear in settlement
        shippingStatus: 'PENDING' as const,
        status: 'PENDING_PAYMENT' as const,
        createdAt: new Date('2026-01-25T10:00:00Z'),
      },
    ];

    for (const data of orderData) {
      const order = await prismaService.order.create({ data });
      if (data.paymentStatus === 'CONFIRMED') {
        confirmedOrders.push(order);
      }
    }
  });

  afterAll(async () => {
    // Cleanup
    await prismaService.order.deleteMany({
      where: { id: { startsWith: 'ORD-' } },
    });
    await prismaService.user.deleteMany({
      where: { id: { in: [adminUser.id, regularUser.id] } },
    });

    await app.close();
  });

  describe('GET /admin/settlement', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/settlement')
        .query({ from: '2026-01-01', to: '2026-01-31' });

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/settlement')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .query({ from: '2026-01-01', to: '2026-01-31' });

      expect(response.status).toBe(403);
    });

    it('should return 400 without required query parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/settlement')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
    });

    it('should return settlement report with correct summary for date range', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/settlement')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ from: '2026-01-01', to: '2026-01-31' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('orders');
      expect(response.body).toHaveProperty('dateRange');

      const { summary, orders, dateRange } = response.body;

      // Verify summary calculations
      expect(summary.totalOrders).toBe(2); // Only CONFIRMED orders
      expect(summary.totalRevenue).toBe(326.25); // 110.5 + 215.75
      expect(summary.avgOrderValue).toBe(163.125); // 326.25 / 2
      expect(summary.totalShippingFee).toBe(25); // 10 + 15

      // Verify date range
      expect(dateRange.from).toBe('2026-01-01');
      expect(dateRange.to).toBe('2026-01-31');

      // Verify orders
      expect(orders).toHaveLength(2);
      expect(orders[0].orderId).toBe('ORD-20260120-SET002'); // Ordered by paidAt desc
      expect(orders[1].orderId).toBe('ORD-20260115-SET001');
    });

    it('should exclude PENDING orders from settlement report', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/settlement')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ from: '2026-01-01', to: '2026-01-31' });

      expect(response.status).toBe(200);

      const orderIds = response.body.orders.map((o: any) => o.orderId);
      expect(orderIds).not.toContain('ORD-20260125-SET003'); // PENDING order
    });

    it('should return empty report for date range with no CONFIRMED orders', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/settlement')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ from: '2026-02-01', to: '2026-02-28' });

      expect(response.status).toBe(200);
      expect(response.body.summary.totalOrders).toBe(0);
      expect(response.body.summary.totalRevenue).toBe(0);
      expect(response.body.summary.avgOrderValue).toBe(0);
      expect(response.body.summary.totalShippingFee).toBe(0);
      expect(response.body.orders).toHaveLength(0);
    });

    it('should filter orders by paidAt date range correctly', async () => {
      // Query only for orders paid in January 15-19
      const response = await request(app.getHttpServer())
        .get('/admin/settlement')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ from: '2026-01-15', to: '2026-01-19' });

      expect(response.status).toBe(200);
      expect(response.body.summary.totalOrders).toBe(1); // Only first order
      expect(response.body.orders[0].orderId).toBe('ORD-20260115-SET001');
    });

    it('should return orders with correct DTO structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/settlement')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ from: '2026-01-01', to: '2026-01-31' });

      expect(response.status).toBe(200);
      const order = response.body.orders[0];

      expect(order).toHaveProperty('orderId');
      expect(order).toHaveProperty('orderDate');
      expect(order).toHaveProperty('customerId');
      expect(order).toHaveProperty('total');
      expect(order).toHaveProperty('paidAt');

      expect(typeof order.orderId).toBe('string');
      expect(typeof order.orderDate).toBe('string');
      expect(typeof order.customerId).toBe('string');
      expect(typeof order.total).toBe('number');
      expect(typeof order.paidAt).toBe('string');
    });
  });

  describe('GET /admin/settlement/download', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/settlement/download')
        .query({ from: '2026-01-01', to: '2026-01-31' });

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/settlement/download')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .query({ from: '2026-01-01', to: '2026-01-31' });

      expect(response.status).toBe(403);
    });

    it('should return Excel file with correct headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/settlement/download')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ from: '2026-01-01', to: '2026-01-31' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(response.headers['content-disposition']).toContain(
        'attachment; filename=settlement_2026-01-01_2026-01-31.xlsx',
      );
    });

    it('should return valid Excel file buffer', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/settlement/download')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ from: '2026-01-01', to: '2026-01-31' });

      expect(response.status).toBe(200);
      expect(Buffer.isBuffer(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Excel files start with PK (zip signature)
      expect(response.body[0]).toBe(0x50); // 'P'
      expect(response.body[1]).toBe(0x4b); // 'K'
    });

    it('should generate Excel file for empty date range', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/settlement/download')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ from: '2026-02-01', to: '2026-02-28' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(Buffer.isBuffer(response.body)).toBe(true);
    });
  });
});
