import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Admin Users (E2E)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let adminAccessToken: string;
  let userAccessToken: string;
  let testAdminUser: any;
  let testRegularUser: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Create test admin user
    testAdminUser = await prismaService.user.create({
      data: {
        id: 'admin-user-test',
        kakaoId: 'kakao-admin-test',
        name: 'Test Admin',
        email: 'admin@test.com',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    // Create test regular user
    testRegularUser = await prismaService.user.create({
      data: {
        id: 'regular-user-test',
        kakaoId: 'kakao-regular-test',
        name: 'Test User',
        email: 'user@test.com',
        role: 'USER',
        status: 'ACTIVE',
      },
    });

    // Create additional test users for pagination
    await prismaService.user.createMany({
      data: [
        {
          id: 'test-user-1',
          kakaoId: 'kakao-test-1',
          name: 'Alice Johnson',
          email: 'alice@test.com',
          instagramId: '@alice_j',
          role: 'USER',
          status: 'ACTIVE',
        },
        {
          id: 'test-user-2',
          kakaoId: 'kakao-test-2',
          name: 'Bob Smith',
          email: 'bob@test.com',
          instagramId: '@bob_smith',
          role: 'USER',
          status: 'ACTIVE',
        },
        {
          id: 'test-user-3',
          kakaoId: 'kakao-test-3',
          name: 'Charlie Brown',
          email: 'charlie@test.com',
          instagramId: '@charlie_b',
          role: 'USER',
          status: 'INACTIVE',
        },
      ],
    });

    adminAccessToken = jwtService.sign({
      sub: testAdminUser.id,
      email: testAdminUser.email,
      role: testAdminUser.role,
    });

    userAccessToken = jwtService.sign({
      sub: testRegularUser.id,
      email: testRegularUser.email,
      role: testRegularUser.role,
    });
  });

  afterAll(async () => {
    // Cleanup
    await prismaService.user.deleteMany({
      where: {
        id: {
          in: [
            'admin-user-test',
            'regular-user-test',
            'test-user-1',
            'test-user-2',
            'test-user-3',
          ],
        },
      },
    });

    await app.close();
  });

  describe('GET /admin/users', () => {
    it('should return user list for admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/users?page=1&limit=20')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 20);
      expect(response.body).toHaveProperty('totalPages');
      expect(Array.isArray(response.body.users)).toBe(true);
    });

    it('should return 403 for regular user', async () => {
      await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(403);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get('/admin/users')
        .expect(401);
    });

    it('should respect pagination parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/users?page=2&limit=10')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(10);
    });

    it('should sort by instagramId ascending', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/users?sortBy=instagramId&sortOrder=asc')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      const users = response.body.users;

      // Filter users with instagramId (not null)
      const usersWithInstagram = users.filter((u: any) => u.instagramId);

      if (usersWithInstagram.length > 1) {
        const instagramIds = usersWithInstagram.map((u: any) => u.instagramId);
        const sortedIds = [...instagramIds].sort();
        expect(instagramIds).toEqual(sortedIds);
      }
    });

    it('should filter by search query', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/users?search=alice')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.users.length).toBeGreaterThan(0);

      // Check that at least one user matches the search
      const hasMatch = response.body.users.some((user: any) =>
        user.name?.toLowerCase().includes('alice') ||
        user.email?.toLowerCase().includes('alice') ||
        user.instagramId?.toLowerCase().includes('alice'),
      );
      expect(hasMatch).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/users?status=ACTIVE')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      const users = response.body.users;

      // All returned users should have ACTIVE status
      users.forEach((user: any) => {
        expect(user.status).toBe('ACTIVE');
      });
    });

    it('should filter by date range', async () => {
      const dateFrom = '2026-01-01';
      const dateTo = '2026-02-01';

      const response = await request(app.getHttpServer())
        .get(`/admin/users?dateFrom=${dateFrom}&dateTo=${dateTo}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(Array.isArray(response.body.users)).toBe(true);

      // All returned users should be within date range
      response.body.users.forEach((user: any) => {
        const createdAt = new Date(user.createdAt);
        expect(createdAt >= new Date(dateFrom)).toBe(true);
        expect(createdAt <= new Date(dateTo)).toBe(true);
      });
    });

    it('should return users with totalOrders and totalPurchaseAmount as 0 (Epic 8 placeholder)', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/users?page=1&limit=5')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      response.body.users.forEach((user: any) => {
        expect(user.totalOrders).toBe(0);
        expect(user.totalPurchaseAmount).toBe(0);
      });
    });

    it('should return correct user data structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/users?page=1&limit=5')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      const users = response.body.users;

      if (users.length > 0) {
        const user = users[0];
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('name');
        expect(user).toHaveProperty('createdAt');
        expect(user).toHaveProperty('status');
        expect(user).toHaveProperty('role');
        expect(user).toHaveProperty('totalOrders');
        expect(user).toHaveProperty('totalPurchaseAmount');
      }
    });

    it('should handle combined filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/users?search=test&status=ACTIVE&page=1&limit=10&sortBy=createdAt&sortOrder=desc')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it('should return empty array when no users match filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/users?search=nonexistentuser123456')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.users).toHaveLength(0);
      expect(response.body.total).toBe(0);
      expect(response.body.totalPages).toBe(0);
    });

    it('should handle default parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(20);
      expect(response.body).toHaveProperty('totalPages');
    });

    it('should calculate total pages correctly', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/users?page=1&limit=2')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      const { total, limit, totalPages } = response.body;
      const expectedPages = Math.ceil(total / limit);

      expect(totalPages).toBe(expectedPages);
    });
  });
});
