import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { EncryptionService } from '../../src/common/services/encryption.service';

describe('Admin User Detail (E2E)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let encryptionService: EncryptionService;
  let adminAccessToken: string;
  let userAccessToken: string;
  let testAdminUser: any;
  let testRegularUser: any;
  let testTargetUser: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    encryptionService = moduleFixture.get<EncryptionService>(EncryptionService);

    // Create test admin user
    testAdminUser = await prismaService.user.create({
      data: {
        id: 'admin-user-detail-test',
        kakaoId: 'kakao-admin-detail-test',
        name: 'Admin User',
        email: 'admin-detail@test.com',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    // Create test regular user
    testRegularUser = await prismaService.user.create({
      data: {
        id: 'regular-user-detail-test',
        kakaoId: 'kakao-regular-detail-test',
        name: 'Regular User',
        email: 'regular-detail@test.com',
        role: 'USER',
        status: 'ACTIVE',
      },
    });

    // Create test target user with full profile
    const shippingAddress = {
      fullName: 'John Doe',
      address1: '123 Main Street',
      address2: 'Apt 4B',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
      phone: '(310) 555-0123',
    };

    testTargetUser = await prismaService.user.create({
      data: {
        id: 'target-user-test',
        kakaoId: 'kakao-target-test',
        name: 'Target User',
        email: 'target@test.com',
        role: 'USER',
        status: 'ACTIVE',
        instagramId: '@targetuser',
        depositorName: 'Target Depositor',
        shippingAddress: encryptionService.encryptAddress(shippingAddress) as any,
      },
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
            'admin-user-detail-test',
            'regular-user-detail-test',
            'target-user-test',
          ],
        },
      },
    });

    await app.close();
  });

  describe('GET /admin/users/:id', () => {
    it('should return user detail for admin', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/users/${testTargetUser.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testTargetUser.id);
      expect(response.body).toHaveProperty('email', 'target@test.com');
      expect(response.body).toHaveProperty('name', 'Target User');
      expect(response.body).toHaveProperty('instagramId', '@targetuser');
      expect(response.body).toHaveProperty('depositorName', 'Target Depositor');
      expect(response.body).toHaveProperty('shippingAddress');
      expect(response.body).toHaveProperty('statistics');
    });

    it('should return decrypted shipping address', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/users/${testTargetUser.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.shippingAddress).toEqual({
        fullName: 'John Doe',
        address1: '123 Main Street',
        address2: 'Apt 4B',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90001',
        phone: '(310) 555-0123',
      });
    });

    it('should return Epic 8 placeholder statistics', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/users/${testTargetUser.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.statistics).toEqual({
        totalOrders: 0,
        totalPurchaseAmount: 0,
        averageOrderValue: 0,
        orderFrequency: 0,
      });
    });

    it('should return 403 for regular user', async () => {
      await request(app.getHttpServer())
        .get(`/admin/users/${testTargetUser.id}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(403);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get(`/admin/users/${testTargetUser.id}`)
        .expect(401);
    });

    it('should return 404 for non-existent user', async () => {
      await request(app.getHttpServer())
        .get('/admin/users/non-existent-id')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404);
    });

    it('should handle user without shipping address', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/users/${testRegularUser.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.shippingAddress).toBeNull();
    });
  });

  describe('PATCH /admin/users/:id/status', () => {
    it('should update user status to SUSPENDED', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/admin/users/${testTargetUser.id}/status`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ status: 'SUSPENDED' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('SUSPENDED');
      expect(response.body.data.suspendedAt).toBeDefined();

      // Verify in database
      const updatedUser = await prismaService.user.findUnique({
        where: { id: testTargetUser.id },
      });
      expect(updatedUser?.status).toBe('SUSPENDED');
      expect(updatedUser?.suspendedAt).toBeDefined();
    });

    it('should update user status back to ACTIVE', async () => {
      // First suspend
      await request(app.getHttpServer())
        .patch(`/admin/users/${testTargetUser.id}/status`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ status: 'SUSPENDED' })
        .expect(200);

      // Then reactivate
      const response = await request(app.getHttpServer())
        .patch(`/admin/users/${testTargetUser.id}/status`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ status: 'ACTIVE' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ACTIVE');
      expect(response.body.data.suspendedAt).toBeNull();

      // Verify in database
      const updatedUser = await prismaService.user.findUnique({
        where: { id: testTargetUser.id },
      });
      expect(updatedUser?.status).toBe('ACTIVE');
      expect(updatedUser?.suspendedAt).toBeNull();
    });

    it('should return 403 for regular user', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/users/${testTargetUser.id}/status`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ status: 'SUSPENDED' })
        .expect(403);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/users/${testTargetUser.id}/status`)
        .send({ status: 'SUSPENDED' })
        .expect(401);
    });

    it('should return 404 for non-existent user', async () => {
      await request(app.getHttpServer())
        .patch('/admin/users/non-existent-id/status')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ status: 'SUSPENDED' })
        .expect(404);
    });

    it('should validate status enum', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/admin/users/${testTargetUser.id}/status`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ status: 'INVALID_STATUS' })
        .expect(400);

      expect(response.body.message).toContain('status');
    });
  });
});
