import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Profile Completion (E2E)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let userAccessToken: string;
  let testUser: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Create test user without completed profile
    testUser = await prismaService.user.create({
      data: {
        id: 'user-profile-test',
        kakaoId: 'kakao-profile-test',
        name: 'Test User',
        email: 'profile-test@test.com',
        role: 'USER',
        status: 'ACTIVE',
      },
    });

    userAccessToken = jwtService.sign({
      sub: testUser.id,
      email: testUser.email,
      role: testUser.role,
    });
  });

  afterAll(async () => {
    // Cleanup
    await prismaService.user.deleteMany({
      where: { id: { startsWith: 'user-profile' } },
    });

    await app.close();
  });

  describe('POST /users/complete-profile', () => {
    it('should complete profile successfully with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/complete-profile')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          depositorName: 'Kim MinJi',
          instagramId: '@minji_official_e2e',
          fullName: 'Minji Kim',
          address1: '123 Main St',
          address2: 'Apt 4B',
          city: 'Los Angeles',
          state: 'CA',
          zip: '90001',
          phone: '(310) 555-0123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('id', testUser.id);
      expect(response.body).toHaveProperty('depositorName', 'Kim MinJi');
      expect(response.body).toHaveProperty('instagramId', '@minji_official_e2e');

      // Verify in database
      const updatedUser = await prismaService.user.findUnique({
        where: { id: testUser.id },
      });

      expect(updatedUser.depositorName).toBe('Kim MinJi');
      expect(updatedUser.instagramId).toBe('@minji_official_e2e');
      expect(updatedUser.shippingAddress).toBeDefined();
      expect(updatedUser.profileCompletedAt).toBeDefined();
      expect(updatedUser.profileCompletedAt).toBeInstanceOf(Date);

      // Verify address is encrypted (should contain colons in format iv:authTag:ciphertext)
      const encryptedAddress = JSON.stringify(updatedUser.shippingAddress);
      expect(encryptedAddress).toContain(':');
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post('/users/complete-profile')
        .send({
          depositorName: 'Test',
          instagramId: '@test',
          fullName: 'Test User',
          address1: '123 Test St',
          city: 'Test City',
          state: 'CA',
          zip: '12345',
          phone: '(123) 456-7890',
        })
        .expect(401);
    });

    it('should return 400 with missing required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/complete-profile')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          depositorName: 'Test',
          // Missing instagramId, fullName, etc.
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should return 400 with invalid phone format', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/complete-profile')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          depositorName: 'Test',
          instagramId: '@test_phone',
          fullName: 'Test User',
          address1: '123 Test St',
          city: 'Test City',
          state: 'CA',
          zip: '12345',
          phone: '1234567890', // Invalid format
        })
        .expect(400);

      expect(response.body.message).toContain('Phone number must be in format (123) 456-7890');
    });

    it('should return 400 with invalid ZIP code format', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/complete-profile')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          depositorName: 'Test',
          instagramId: '@test_zip',
          fullName: 'Test User',
          address1: '123 Test St',
          city: 'Test City',
          state: 'CA',
          zip: '1234', // Invalid format
          phone: '(123) 456-7890',
        })
        .expect(400);

      expect(response.body.message).toContain('ZIP code must be in format 12345 or 12345-6789');
    });

    it('should return 400 with invalid state code', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/complete-profile')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          depositorName: 'Test',
          instagramId: '@test_state',
          fullName: 'Test User',
          address1: '123 Test St',
          city: 'Test City',
          state: 'XX', // Invalid state code
          zip: '12345',
          phone: '(123) 456-7890',
        })
        .expect(400);

      expect(response.body.message).toContain('State must be a 2-letter US state code');
    });

    it('should return 409 if Instagram ID is already taken by another user', async () => {
      // Create another user with Instagram ID
      const anotherUser = await prismaService.user.create({
        data: {
          id: 'user-profile-test-2',
          kakaoId: 'kakao-profile-test-2',
          name: 'Another User',
          email: 'another@test.com',
          role: 'USER',
          status: 'ACTIVE',
          instagramId: '@taken_instagram_e2e',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/users/complete-profile')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          depositorName: 'Test',
          instagramId: '@taken_instagram_e2e',
          fullName: 'Test User',
          address1: '123 Test St',
          city: 'Test City',
          state: 'CA',
          zip: '12345',
          phone: '(123) 456-7890',
        })
        .expect(409);

      expect(response.body.message).toContain('This Instagram ID is already registered');

      // Cleanup
      await prismaService.user.delete({ where: { id: anotherUser.id } });
    });

    it('should auto-add @ prefix to Instagram ID if missing', async () => {
      // Create fresh user for this test
      const freshUser = await prismaService.user.create({
        data: {
          id: 'user-profile-test-prefix',
          kakaoId: 'kakao-profile-test-prefix',
          name: 'Prefix Test User',
          email: 'prefix@test.com',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      const freshToken = jwtService.sign({
        sub: freshUser.id,
        email: freshUser.email,
        role: freshUser.role,
      });

      const response = await request(app.getHttpServer())
        .post('/users/complete-profile')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({
          depositorName: 'Test',
          instagramId: 'no_at_prefix_e2e', // No @ prefix
          fullName: 'Test User',
          address1: '123 Test St',
          city: 'Test City',
          state: 'CA',
          zip: '12345',
          phone: '(123) 456-7890',
        })
        .expect(200);

      expect(response.body.instagramId).toBe('@no_at_prefix_e2e');

      // Cleanup
      await prismaService.user.delete({ where: { id: freshUser.id } });
    });

    it('should accept valid ZIP code with extended format', async () => {
      // Create fresh user for this test
      const freshUser = await prismaService.user.create({
        data: {
          id: 'user-profile-test-zip',
          kakaoId: 'kakao-profile-test-zip',
          name: 'Zip Test User',
          email: 'zip@test.com',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      const freshToken = jwtService.sign({
        sub: freshUser.id,
        email: freshUser.email,
        role: freshUser.role,
      });

      await request(app.getHttpServer())
        .post('/users/complete-profile')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({
          depositorName: 'Test',
          instagramId: '@zip_test_e2e',
          fullName: 'Test User',
          address1: '123 Test St',
          city: 'Test City',
          state: 'CA',
          zip: '90001-1234', // Extended format
          phone: '(310) 555-0123',
        })
        .expect(200);

      // Cleanup
      await prismaService.user.delete({ where: { id: freshUser.id } });
    });

    it('should handle address without optional address2 field', async () => {
      // Create fresh user for this test
      const freshUser = await prismaService.user.create({
        data: {
          id: 'user-profile-test-no-addr2',
          kakaoId: 'kakao-profile-test-no-addr2',
          name: 'No Address2 User',
          email: 'no-addr2@test.com',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      const freshToken = jwtService.sign({
        sub: freshUser.id,
        email: freshUser.email,
        role: freshUser.role,
      });

      await request(app.getHttpServer())
        .post('/users/complete-profile')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({
          depositorName: 'Test',
          instagramId: '@no_addr2_e2e',
          fullName: 'Test User',
          address1: '123 Test St',
          // No address2
          city: 'Test City',
          state: 'CA',
          zip: '12345',
          phone: '(123) 456-7890',
        })
        .expect(200);

      // Cleanup
      await prismaService.user.delete({ where: { id: freshUser.id } });
    });
  });

  describe('GET /users/check-instagram', () => {
    it('should return available: true for available Instagram ID', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/check-instagram')
        .query({ instagramId: '@available_instagram_e2e' })
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.data.available).toBe(true);
    });

    it('should return available: false for taken Instagram ID', async () => {
      // Create user with Instagram ID
      const takenUser = await prismaService.user.create({
        data: {
          id: 'user-profile-test-taken',
          kakaoId: 'kakao-profile-test-taken',
          name: 'Taken User',
          email: 'taken@test.com',
          role: 'USER',
          status: 'ACTIVE',
          instagramId: '@already_taken_e2e',
        },
      });

      const response = await request(app.getHttpServer())
        .get('/users/check-instagram')
        .query({ instagramId: '@already_taken_e2e' })
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.data.available).toBe(false);

      // Cleanup
      await prismaService.user.delete({ where: { id: takenUser.id } });
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get('/users/check-instagram')
        .query({ instagramId: '@test' })
        .expect(401);
    });
  });
});
