import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { EncryptionService } from '../../src/common/services/encryption.service';

describe('My Page - Address Update (E2E)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let encryptionService: EncryptionService;
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
    encryptionService = moduleFixture.get<EncryptionService>(EncryptionService);

    // Create test user with completed profile
    const encryptedAddress = encryptionService.encryptAddress({
      fullName: 'Original User',
      address1: '123 Original St',
      address2: 'Apt 1',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
      phone: '(310) 555-0001',
    });

    testUser = await prismaService.user.create({
      data: {
        id: 'user-mypage-test',
        kakaoId: 'kakao-mypage-test',
        name: 'Test User',
        email: 'mypage-test@test.com',
        role: 'USER',
        status: 'ACTIVE',
        depositorName: 'Test Depositor',
        instagramId: '@mypage_test_user',
        shippingAddress: encryptedAddress as any,
        profileCompletedAt: new Date(),
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
      where: { id: { startsWith: 'user-mypage' } },
    });

    await app.close();
  });

  describe('GET /users/profile/me', () => {
    it('should return user profile with decrypted address', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/profile/me')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testUser.id);
      expect(response.body).toHaveProperty('depositorName', 'Test Depositor');
      expect(response.body).toHaveProperty('instagramId', '@mypage_test_user');
      expect(response.body).toHaveProperty('shippingAddress');

      const address = response.body.shippingAddress;
      expect(address).toHaveProperty('fullName', 'Original User');
      expect(address).toHaveProperty('address1', '123 Original St');
      expect(address).toHaveProperty('address2', 'Apt 1');
      expect(address).toHaveProperty('city', 'Los Angeles');
      expect(address).toHaveProperty('state', 'CA');
      expect(address).toHaveProperty('zip', '90001');
      expect(address).toHaveProperty('phone', '(310) 555-0001');
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get('/users/profile/me')
        .expect(401);
    });
  });

  describe('PATCH /users/profile/address', () => {
    it('should update shipping address successfully', async () => {
      const response = await request(app.getHttpServer())
        .patch('/users/profile/address')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          fullName: 'Updated User',
          address1: '456 Updated Ave',
          address2: 'Suite 200',
          city: 'San Francisco',
          state: 'CA',
          zip: '94102',
          phone: '(415) 555-9999',
        })
        .expect(200);

      expect(response.body).toHaveProperty('id', testUser.id);

      // Verify in database that address was updated and encrypted
      const updatedUser = await prismaService.user.findUnique({
        where: { id: testUser.id },
      });

      expect(updatedUser.shippingAddress).toBeDefined();

      // Verify address is encrypted (should contain colons in format iv:authTag:ciphertext)
      const encryptedAddress = JSON.stringify(updatedUser.shippingAddress);
      expect(encryptedAddress).toContain(':');

      // Decrypt and verify new values
      const decryptedAddress = encryptionService.decryptAddress(updatedUser.shippingAddress as any as string);
      expect(decryptedAddress.fullName).toBe('Updated User');
      expect(decryptedAddress.address1).toBe('456 Updated Ave');
      expect(decryptedAddress.city).toBe('San Francisco');
      expect(decryptedAddress.zip).toBe('94102');
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .patch('/users/profile/address')
        .send({
          fullName: 'Test',
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
        .patch('/users/profile/address')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          fullName: 'Test',
          // Missing other required fields
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should return 400 with invalid ZIP code format', async () => {
      const response = await request(app.getHttpServer())
        .patch('/users/profile/address')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          fullName: 'Test',
          address1: '123 Test St',
          city: 'Test City',
          state: 'CA',
          zip: '1234', // Invalid format
          phone: '(123) 456-7890',
        })
        .expect(400);

      expect(response.body.message).toContain('ZIP code must be in format 12345 or 12345-6789');
    });

    it('should return 400 with invalid phone format', async () => {
      const response = await request(app.getHttpServer())
        .patch('/users/profile/address')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          fullName: 'Test',
          address1: '123 Test St',
          city: 'Test City',
          state: 'CA',
          zip: '12345',
          phone: '1234567890', // Invalid format
        })
        .expect(400);

      expect(response.body.message).toContain('Phone number must be in format (123) 456-7890');
    });

    it('should return 400 with invalid state code', async () => {
      const response = await request(app.getHttpServer())
        .patch('/users/profile/address')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          fullName: 'Test',
          address1: '123 Test St',
          city: 'Test City',
          state: 'XX', // Invalid state code
          zip: '12345',
          phone: '(123) 456-7890',
        })
        .expect(400);

      expect(response.body.message).toContain('State must be a 2-letter US state code');
    });

    it('should handle address without optional address2 field', async () => {
      const response = await request(app.getHttpServer())
        .patch('/users/profile/address')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          fullName: 'Test User',
          address1: '789 Test Blvd',
          // No address2
          city: 'Seattle',
          state: 'WA',
          zip: '98101',
          phone: '(206) 555-3333',
        })
        .expect(200);

      expect(response.body).toHaveProperty('id', testUser.id);

      // Verify address was updated
      const updatedUser = await prismaService.user.findUnique({
        where: { id: testUser.id },
      });

      const decryptedAddress = encryptionService.decryptAddress(updatedUser.shippingAddress as any as string);
      expect(decryptedAddress.address1).toBe('789 Test Blvd');
      expect(decryptedAddress.city).toBe('Seattle');
      expect(decryptedAddress.address2).toBeUndefined();
    });

    it('should accept extended ZIP code format', async () => {
      await request(app.getHttpServer())
        .patch('/users/profile/address')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          fullName: 'Test User',
          address1: '999 Test St',
          city: 'New York',
          state: 'NY',
          zip: '10001-1234', // Extended format
          phone: '(212) 555-7777',
        })
        .expect(200);

      const updatedUser = await prismaService.user.findUnique({
        where: { id: testUser.id },
      });

      const decryptedAddress = encryptionService.decryptAddress(updatedUser.shippingAddress as any as string);
      expect(decryptedAddress.zip).toBe('10001-1234');
    });

    it('should encrypt address before storing', async () => {
      await request(app.getHttpServer())
        .patch('/users/profile/address')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          fullName: 'Security Test',
          address1: '111 Security St',
          city: 'Privacy City',
          state: 'CA',
          zip: '90210',
          phone: '(310) 555-0000',
        })
        .expect(200);

      // Verify address is stored encrypted, not plain text
      const updatedUser = await prismaService.user.findUnique({
        where: { id: testUser.id },
        select: { shippingAddress: true },
      });

      // Should be a string in format iv:authTag:ciphertext
      const encryptedString = updatedUser.shippingAddress as any as string;
      expect(typeof encryptedString).toBe('string');
      expect(encryptedString.split(':').length).toBe(3);

      // Should NOT contain plain text data
      expect(encryptedString).not.toContain('Security Test');
      expect(encryptedString).not.toContain('111 Security St');
      expect(encryptedString).not.toContain('Privacy City');
    });
  });
});
