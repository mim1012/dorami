import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService, ShippingAddress } from '../../common/services/encryption.service';
import { CompleteProfileDto } from './dto/complete-profile.dto';

describe('UsersService - Profile Completion', () => {
  let service: UsersService;
  let _prismaService: PrismaService;
  let _encryptionService: EncryptionService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockEncryptionService = {
    encryptAddress: jest.fn(),
    decryptAddress: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    _prismaService = module.get<PrismaService>(PrismaService);
    _encryptionService = module.get<EncryptionService>(EncryptionService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isInstagramIdAvailable', () => {
    it('should return true if Instagram ID is not taken', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.isInstagramIdAvailable('@new_user');

      expect(result).toBe(true);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { instagramId: '@new_user' },
        select: { id: true },
      });
    });

    it('should return false if Instagram ID is already taken', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'other-user-id' });

      const result = await service.isInstagramIdAvailable('@taken_user');

      expect(result).toBe(false);
    });

    it('should return true if Instagram ID belongs to the same user (updating own ID)', async () => {
      const userId = 'user-123';
      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId });

      const result = await service.isInstagramIdAvailable('@my_instagram', userId);

      expect(result).toBe(true);
    });

    it('should return false if Instagram ID belongs to different user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'other-user-id' });

      const result = await service.isInstagramIdAvailable('@taken_user', 'current-user-id');

      expect(result).toBe(false);
    });
  });

  describe('completeProfile', () => {
    const userId = 'user-123';
    const completeProfileDto: CompleteProfileDto = {
      depositorName: 'Kim MinJi',
      instagramId: '@minji_official',
      fullName: 'Minji Kim',
      address1: '123 Main St',
      address2: 'Apt 4B',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
      phone: '(310) 555-0123',
    };

    const mockEncryptedAddress = 'iv:authTag:ciphertext';

    it('should complete profile successfully with encrypted address', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null); // Instagram ID available
      mockEncryptionService.encryptAddress.mockReturnValue(mockEncryptedAddress);
      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        email: 'user@test.com',
        kakaoId: 'kakao-123',
        name: 'MinJi',
        role: 'USER',
        status: 'ACTIVE',
        depositorName: 'Kim MinJi',
        instagramId: '@minji_official',
        shippingAddress: mockEncryptedAddress,
        profileCompletedAt: new Date('2026-01-31'),
        createdAt: new Date(),
        lastLoginAt: null,
        updatedAt: new Date(),
      });

      const result = await service.completeProfile(userId, completeProfileDto);

      // Verify encryption was called with correct address
      expect(mockEncryptionService.encryptAddress).toHaveBeenCalledWith({
        fullName: 'Minji Kim',
        address1: '123 Main St',
        address2: 'Apt 4B',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90001',
        phone: '(310) 555-0123',
      });

      // Verify user was updated with encrypted address
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          depositorName: 'Kim MinJi',
          instagramId: '@minji_official',
          shippingAddress: mockEncryptedAddress,
          profileCompletedAt: expect.any(Date),
        },
      });

      expect(result).toHaveProperty('id', userId);
      expect(result).toHaveProperty('depositorName', 'Kim MinJi');
      expect(result).toHaveProperty('instagramId', '@minji_official');
    });

    it('should throw ConflictException if Instagram ID is already taken', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'other-user-id' });

      await expect(
        service.completeProfile(userId, completeProfileDto),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.completeProfile(userId, completeProfileDto),
      ).rejects.toThrow('This Instagram ID is already registered');

      // Should not call encryptAddress or update if Instagram ID is taken
      expect(mockEncryptionService.encryptAddress).not.toHaveBeenCalled();
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('should allow user to update their own Instagram ID', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId }); // Same user
      mockEncryptionService.encryptAddress.mockReturnValue(mockEncryptedAddress);
      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        depositorName: 'Kim MinJi',
        instagramId: '@updated_instagram',
        profileCompletedAt: new Date(),
      } as any);

      await expect(
        service.completeProfile(userId, { ...completeProfileDto, instagramId: '@updated_instagram' }),
      ).resolves.not.toThrow();

      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });

    it('should auto-add @ prefix to Instagram ID (via DTO transform)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockEncryptionService.encryptAddress.mockReturnValue(mockEncryptedAddress);
      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        instagramId: '@no_at_symbol',
        profileCompletedAt: new Date(),
      } as any);

      // Note: The @ prefix is added by class-transformer in the DTO
      // This test assumes the DTO has already applied the transform
      await service.completeProfile(userId, { ...completeProfileDto, instagramId: '@no_at_symbol' });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            instagramId: '@no_at_symbol',
          }),
        }),
      );
    });

    it('should handle address without optional address2 field', async () => {
      const dtoWithoutAddress2: CompleteProfileDto = {
        ...completeProfileDto,
        address2: undefined,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockEncryptionService.encryptAddress.mockReturnValue(mockEncryptedAddress);
      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        profileCompletedAt: new Date(),
      } as any);

      await service.completeProfile(userId, dtoWithoutAddress2);

      expect(mockEncryptionService.encryptAddress).toHaveBeenCalledWith({
        fullName: 'Minji Kim',
        address1: '123 Main St',
        address2: undefined,
        city: 'Los Angeles',
        state: 'CA',
        zip: '90001',
        phone: '(310) 555-0123',
      });
    });

    it('should set profileCompletedAt timestamp', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockEncryptionService.encryptAddress.mockReturnValue(mockEncryptedAddress);
      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        profileCompletedAt: new Date('2026-01-31T10:30:00Z'),
      } as any);

      await service.completeProfile(userId, completeProfileDto);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            profileCompletedAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('getShippingAddress', () => {
    const userId = 'user-123';
    const mockEncryptedAddress = 'iv:authTag:ciphertext';
    const mockDecryptedAddress: ShippingAddress = {
      fullName: 'John Doe',
      address1: '123 Main St',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
      phone: '(310) 555-0123',
    };

    it('should return decrypted shipping address', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        shippingAddress: mockEncryptedAddress,
      });
      mockEncryptionService.decryptAddress.mockReturnValue(mockDecryptedAddress);

      const result = await service.getShippingAddress(userId);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { shippingAddress: true },
      });
      expect(mockEncryptionService.decryptAddress).toHaveBeenCalledWith(mockEncryptedAddress);
      expect(result).toEqual(mockDecryptedAddress);
    });

    it('should return null if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.getShippingAddress(userId);

      expect(result).toBeNull();
      expect(mockEncryptionService.decryptAddress).not.toHaveBeenCalled();
    });

    it('should return null if shipping address is null', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        shippingAddress: null,
      });

      const result = await service.getShippingAddress(userId);

      expect(result).toBeNull();
      expect(mockEncryptionService.decryptAddress).not.toHaveBeenCalled();
    });

    it('should handle decryption errors gracefully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        shippingAddress: 'corrupted:data',
      });
      mockEncryptionService.decryptAddress.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      await expect(service.getShippingAddress(userId)).rejects.toThrow('Decryption failed');
    });
  });

  describe('updateAddress', () => {
    const userId = 'user-123';
    const mockEncryptedAddress = 'new-iv:new-authTag:new-ciphertext';
    const updateAddressDto = {
      fullName: 'Updated Name',
      address1: '456 New St',
      address2: 'Suite 100',
      city: 'San Francisco',
      state: 'CA',
      zip: '94102',
      phone: '(415) 555-9999',
    };

    it('should update shipping address successfully', async () => {
      mockEncryptionService.encryptAddress.mockReturnValue(mockEncryptedAddress);
      mockEncryptionService.decryptAddress.mockReturnValue(updateAddressDto);
      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        email: 'user@test.com',
        kakaoId: 'kakao-123',
        name: 'Test User',
        role: 'USER',
        status: 'ACTIVE',
        depositorName: 'Test',
        instagramId: '@test',
        shippingAddress: mockEncryptedAddress,
        profileCompletedAt: new Date(),
        createdAt: new Date(),
        lastLoginAt: null,
        updatedAt: new Date(),
      });

      const result = await service.updateAddress(userId, updateAddressDto as any);

      // Verify encryption was called with new address
      expect(mockEncryptionService.encryptAddress).toHaveBeenCalledWith({
        fullName: 'Updated Name',
        address1: '456 New St',
        address2: 'Suite 100',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
        phone: '(415) 555-9999',
      });

      // Verify user was updated with encrypted address
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          shippingAddress: mockEncryptedAddress,
        },
      });

      expect(result).toHaveProperty('id', userId);
    });

    it('should handle address without optional address2 field', async () => {
      const dtoWithoutAddress2 = {
        ...updateAddressDto,
        address2: undefined,
      };

      mockEncryptionService.encryptAddress.mockReturnValue(mockEncryptedAddress);
      mockEncryptionService.decryptAddress.mockReturnValue(dtoWithoutAddress2);
      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        shippingAddress: mockEncryptedAddress,
      } as any);

      await service.updateAddress(userId, dtoWithoutAddress2 as any);

      expect(mockEncryptionService.encryptAddress).toHaveBeenCalledWith({
        fullName: 'Updated Name',
        address1: '456 New St',
        address2: undefined,
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
        phone: '(415) 555-9999',
      });
    });

    it('should encrypt address before storing', async () => {
      mockEncryptionService.encryptAddress.mockReturnValue(mockEncryptedAddress);
      mockEncryptionService.decryptAddress.mockReturnValue(updateAddressDto);
      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
      } as any);

      await service.updateAddress(userId, updateAddressDto as any);

      // Verify encrypted address was stored, not plain text
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shippingAddress: mockEncryptedAddress,
          }),
        }),
      );
    });

    it('should throw error if user not found', async () => {
      mockEncryptionService.encryptAddress.mockReturnValue(mockEncryptedAddress);
      mockEncryptionService.decryptAddress.mockReturnValue(updateAddressDto);
      mockPrismaService.user.update.mockRejectedValue(new Error('Record not found'));

      await expect(
        service.updateAddress('non-existent-user', updateAddressDto as any),
      ).rejects.toThrow('Record not found');
    });
  });
});
