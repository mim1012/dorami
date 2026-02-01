import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Admin Order Management (E2E)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let regularUserToken: string;

  let adminUser: any;
  let regularUser: any;
  let testOrders: any[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Create admin user
    adminUser = await prismaService.user.create({
      data: {
        id: 'admin-orders-test',
        kakaoId: 'kakao-admin-orders',
        name: 'Admin Orders',
        email: 'admin-orders@test.com',
        role: 'ADMIN',
        status: 'ACTIVE',
        instagramId: '@admin_orders',
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
        id: 'user-orders-test',
        kakaoId: 'kakao-user-orders',
        name: 'Regular User Orders',
        email: 'user-orders@test.com',
        role: 'USER',
        status: 'ACTIVE',
        instagramId: '@user_orders',
      },
    });

    regularUserToken = jwtService.sign({
      sub: regularUser.id,
      email: regularUser.email,
      role: regularUser.role,
    });

    // Create test orders with various statuses
    const orderData = [
      {
        id: 'ORD-20260201-001',
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
        instagramId: '@user_orders',
        subtotal: 100,
        shippingFee: 10,
        total: 110,
        paymentMethod: 'BANK_TRANSFER' as const,
        paymentStatus: 'PENDING' as const,
        shippingStatus: 'PENDING' as const,
        status: 'PENDING_PAYMENT' as const,
        createdAt: new Date('2026-02-01T10:00:00Z'),
      },
      {
        id: 'ORD-20260201-002',
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
        instagramId: '@user_orders',
        subtotal: 200,
        shippingFee: 15,
        total: 215,
        paymentMethod: 'BANK_TRANSFER' as const,
        paymentStatus: 'CONFIRMED' as const,
        shippingStatus: 'PENDING' as const,
        status: 'PAYMENT_CONFIRMED' as const,
        paidAt: new Date('2026-02-01T11:00:00Z'),
        createdAt: new Date('2026-02-01T10:30:00Z'),
      },
      {
        id: 'ORD-20260131-003',
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
        instagramId: '@user_orders',
        subtotal: 50,
        shippingFee: 5,
        total: 55,
        paymentMethod: 'BANK_TRANSFER' as const,
        paymentStatus: 'CONFIRMED' as const,
        shippingStatus: 'SHIPPED' as const,
        status: 'SHIPPED' as const,
        paidAt: new Date('2026-01-31T15:00:00Z'),
        shippedAt: new Date('2026-02-01T09:00:00Z'),
        createdAt: new Date('2026-01-31T14:00:00Z'),
      },
    ];

    for (const data of orderData) {
      const order = await prismaService.order.create({ data });
      testOrders.push(order);
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

  describe('GET /admin/orders', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app.getHttpServer()).get('/api/admin/orders');

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(response.status).toBe(403);
    });

    it('should return paginated order list', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('orders');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('totalPages');

      expect(Array.isArray(response.body.orders)).toBe(true);
      expect(response.body.total).toBeGreaterThanOrEqual(3);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(20);
    });

    it('should filter by search query', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ search: 'John Doe' });

      expect(response.status).toBe(200);
      expect(response.body.orders.length).toBeGreaterThanOrEqual(1);

      const johnOrder = response.body.orders.find(
        (o: any) => o.depositorName === 'John Doe'
      );
      expect(johnOrder).toBeDefined();
      expect(johnOrder.id).toBe('ORD-20260201-001');
    });

    it('should filter by date range', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ dateFrom: '2026-02-01', dateTo: '2026-02-01' });

      expect(response.status).toBe(200);

      const orderIds = response.body.orders.map((o: any) => o.id);
      expect(orderIds).toContain('ORD-20260201-001');
      expect(orderIds).toContain('ORD-20260201-002');
      expect(orderIds).not.toContain('ORD-20260131-003'); // Outside date range
    });

    it('should filter by payment status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ paymentStatus: ['PENDING'] });

      expect(response.status).toBe(200);

      const allPending = response.body.orders.every(
        (o: any) => o.paymentStatus === 'PENDING'
      );
      expect(allPending).toBe(true);
    });

    it('should filter by order status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ orderStatus: ['SHIPPED'] });

      expect(response.status).toBe(200);

      const shippedOrders = response.body.orders.filter(
        (o: any) => o.status === 'SHIPPED'
      );
      expect(shippedOrders.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by shipping status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ shippingStatus: ['SHIPPED'] });

      expect(response.status).toBe(200);

      const shippedOrders = response.body.orders.filter(
        (o: any) => o.shippingStatus === 'SHIPPED'
      );
      expect(shippedOrders.length).toBeGreaterThanOrEqual(1);
      expect(shippedOrders[0].shippedAt).toBeDefined();
    });

    it('should filter by amount range', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ minAmount: 100, maxAmount: 150 });

      expect(response.status).toBe(200);

      const allInRange = response.body.orders.every(
        (o: any) => o.total >= 100 && o.total <= 150
      );
      expect(allInRange).toBe(true);
    });

    it('should combine multiple filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          dateFrom: '2026-02-01',
          dateTo: '2026-02-01',
          paymentStatus: ['CONFIRMED'],
        });

      expect(response.status).toBe(200);

      const orders = response.body.orders;
      expect(orders.length).toBeGreaterThanOrEqual(1);

      const allMatch = orders.every((o: any) => {
        const orderDate = new Date(o.createdAt);
        const isInDateRange =
          orderDate >= new Date('2026-02-01T00:00:00Z') &&
          orderDate <= new Date('2026-02-01T23:59:59Z');
        return isInDateRange && o.paymentStatus === 'CONFIRMED';
      });
      expect(allMatch).toBe(true);
    });

    it('should sort by different fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ sortBy: 'total', sortOrder: 'desc' });

      expect(response.status).toBe(200);

      const orders = response.body.orders;
      for (let i = 0; i < orders.length - 1; i++) {
        expect(orders[i].total).toBeGreaterThanOrEqual(orders[i + 1].total);
      }
    });

    it('should return orders with correct DTO structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const order = response.body.orders[0];

      // Verify all required fields
      expect(order).toHaveProperty('id');
      expect(order).toHaveProperty('userId');
      expect(order).toHaveProperty('userEmail');
      expect(order).toHaveProperty('depositorName');
      expect(order).toHaveProperty('instagramId');
      expect(order).toHaveProperty('status');
      expect(order).toHaveProperty('paymentStatus');
      expect(order).toHaveProperty('shippingStatus');
      expect(order).toHaveProperty('subtotal');
      expect(order).toHaveProperty('shippingFee');
      expect(order).toHaveProperty('total');
      expect(order).toHaveProperty('itemCount');
      expect(order).toHaveProperty('createdAt');

      // Verify data types
      expect(typeof order.id).toBe('string');
      expect(typeof order.total).toBe('number');
      expect(typeof order.itemCount).toBe('number');
      expect(typeof order.createdAt).toBe('string');
    });
  });

  describe('PATCH /admin/orders/:id/confirm-payment', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/admin/orders/${testOrders[0].id}/confirm-payment`);

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/admin/orders/${testOrders[0].id}/confirm-payment`)
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(response.status).toBe(403);
    });

    it('should confirm payment successfully', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/admin/orders/${testOrders[0].id}/confirm-payment`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('orderId');
      expect(response.body.data).toHaveProperty('paymentStatus');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('paidAt');

      expect(response.body.data.paymentStatus).toBe('CONFIRMED');
      expect(response.body.data.status).toBe('PAYMENT_CONFIRMED');
      expect(response.body.data.paidAt).toBeDefined();
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/admin/orders/NON_EXISTENT_ORDER_ID/confirm-payment')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 400 if already confirmed', async () => {
      // testOrders[0] was just confirmed in previous test
      const response = await request(app.getHttpServer())
        .patch(`/api/admin/orders/${testOrders[0].id}/confirm-payment`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already confirmed');
    });

    it('should update paidAt timestamp', async () => {
      const beforeConfirm = await prismaService.order.findUnique({
        where: { id: testOrders[0].id },
      });

      expect(beforeConfirm?.paidAt).toBeDefined();

      const paidAtTime = beforeConfirm!.paidAt!.getTime();
      const now = new Date().getTime();

      // paidAt should be within last minute (just confirmed)
      expect(now - paidAtTime).toBeLessThan(60000);
    });
  });
});
