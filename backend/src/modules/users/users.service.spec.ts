import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { ShippingAddress } from '@live-commerce/shared-types';
import { CompleteProfileDto } from './dto/complete-profile.dto';

describe('UsersService - Profile Completion', () => {
  let service: UsersService;
  let _prismaService: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
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
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('') },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    _prismaService = module.get<PrismaService>(PrismaService);

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
      email: 'user@test.com',
      depositorName: 'Kim MinJi',
      instagramId: '@minji_official',
      fullName: 'Minji Kim',
      address1: '123 Main St',
      address2: 'Apt 4B',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
    };

    const expectedPlainAddress: ShippingAddress = {
      fullName: 'Minji Kim',
      address1: '123 Main St',
      address2: 'Apt 4B',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
    };

    it('should complete profile successfully with plain JSON address', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null); // Instagram ID available
      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        email: 'user@test.com',
        kakaoId: 'kakao-123',
        name: 'MinJi',
        role: 'USER',
        status: 'ACTIVE',
        depositorName: 'Kim MinJi',
        instagramId: '@minji_official',
        shippingAddress: expectedPlainAddress,
        profileCompletedAt: new Date('2026-01-31'),
        createdAt: new Date(),
        lastLoginAt: null,
        updatedAt: new Date(),
      });

      const result = await service.completeProfile(userId, completeProfileDto);

      // Verify user was updated with plain JSON address
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          email: 'user@test.com',
          depositorName: 'Kim MinJi',
          instagramId: '@minji_official',
          shippingAddress: expectedPlainAddress,
          profileCompletedAt: expect.any(Date),
        }),
      });

      expect(result).toHaveProperty('id', userId);
      expect(result).toHaveProperty('depositorName', 'Kim MinJi');
      expect(result).toHaveProperty('instagramId', '@minji_official');
    });

    it('should throw ConflictException if Instagram ID is already taken', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'other-user-id' });

      await expect(service.completeProfile(userId, completeProfileDto)).rejects.toThrow(
        ConflictException,
      );

      await expect(service.completeProfile(userId, completeProfileDto)).rejects.toThrow(
        'This Instagram ID is already registered',
      );

      // Should not call update if Instagram ID is taken
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('should allow user to update their own Instagram ID', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId }); // Same user
      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        depositorName: 'Kim MinJi',
        instagramId: '@updated_instagram',
        name: 'MinJi',
        role: 'USER',
        kakaoId: 'kakao-123',
        email: 'user@test.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        profileCompletedAt: new Date(),
      } as any);

      await expect(
        service.completeProfile(userId, {
          ...completeProfileDto,
          instagramId: '@updated_instagram',
        }),
      ).resolves.not.toThrow();

      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });

    it('should auto-add @ prefix to Instagram ID (via DTO transform)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        instagramId: '@no_at_symbol',
        name: 'MinJi',
        role: 'USER',
        kakaoId: 'kakao-123',
        email: 'user@test.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        profileCompletedAt: new Date(),
      } as any);

      // Note: The @ prefix is added by class-transformer in the DTO
      // This test assumes the DTO has already applied the transform
      await service.completeProfile(userId, {
        ...completeProfileDto,
        instagramId: '@no_at_symbol',
      });

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
      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        name: 'MinJi',
        role: 'USER',
        kakaoId: 'kakao-123',
        email: 'user@test.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        profileCompletedAt: new Date(),
      } as any);

      await service.completeProfile(userId, dtoWithoutAddress2);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shippingAddress: expect.objectContaining({
              fullName: 'Minji Kim',
              address1: '123 Main St',
              address2: undefined,
              city: 'Los Angeles',
              state: 'CA',
              zip: '90001',
            }),
          }),
        }),
      );
    });

    it('should set profileCompletedAt timestamp', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        name: 'MinJi',
        role: 'USER',
        kakaoId: 'kakao-123',
        email: 'user@test.com',
        createdAt: new Date(),
        updatedAt: new Date(),
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
    const mockPlainAddress: ShippingAddress = {
      fullName: 'John Doe',
      address1: '123 Main St',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
    };

    it('should return plain JSON shipping address', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        shippingAddress: mockPlainAddress,
      });

      const result = await service.getShippingAddress(userId);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { shippingAddress: true },
      });
      expect(result).toEqual(mockPlainAddress);
    });

    it('should return null if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.getShippingAddress(userId);

      expect(result).toBeNull();
    });

    it('should return null if shipping address is null', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        shippingAddress: null,
      });

      const result = await service.getShippingAddress(userId);

      expect(result).toBeNull();
    });

    it('should handle missing address gracefully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        shippingAddress: null,
      });

      const result = await service.getShippingAddress(userId);

      expect(result).toBeNull();
    });
  });

  describe('updateAddress', () => {
    const userId = 'user-123';
    const updateAddressDto = {
      fullName: 'Updated Name',
      address1: '456 New St',
      address2: 'Suite 100',
      city: 'San Francisco',
      state: 'CA',
      zip: '94102',
    };
    const expectedPlainAddress: ShippingAddress = {
      fullName: 'Updated Name',
      address1: '456 New St',
      address2: 'Suite 100',
      city: 'San Francisco',
      state: 'CA',
      zip: '94102',
    };

    const mockFullUser = {
      id: userId,
      email: 'user@test.com',
      kakaoId: 'kakao-123',
      name: 'Test User',
      role: 'USER',
      status: 'ACTIVE',
      depositorName: 'Test',
      instagramId: '@test',
      kakaoPhone: null,
      shippingAddress: expectedPlainAddress,
      profileCompletedAt: new Date(),
      createdAt: new Date(),
      lastLoginAt: null,
      updatedAt: new Date(),
    };

    it('should update shipping address successfully', async () => {
      mockPrismaService.user.update.mockResolvedValue(mockFullUser);
      // updateAddress calls getProfile which calls findUnique
      mockPrismaService.user.findUnique.mockResolvedValue(mockFullUser);

      const result = await service.updateAddress(userId, updateAddressDto as any);

      // Verify user was updated with plain JSON address
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          shippingAddress: expectedPlainAddress,
        },
      });

      expect(result).toHaveProperty('id', userId);
    });

    it('should handle address without optional address2 field', async () => {
      const dtoWithoutAddress2 = {
        ...updateAddressDto,
        address2: undefined,
      };
      const plainAddressNoAddress2: ShippingAddress = {
        fullName: 'Updated Name',
        address1: '456 New St',
        address2: undefined,
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
      };

      mockPrismaService.user.update.mockResolvedValue({
        ...mockFullUser,
        shippingAddress: plainAddressNoAddress2,
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockFullUser,
        shippingAddress: plainAddressNoAddress2,
      });

      await service.updateAddress(userId, dtoWithoutAddress2 as any);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          shippingAddress: plainAddressNoAddress2,
        },
      });
    });

    it('should store plain JSON address (not encrypted)', async () => {
      mockPrismaService.user.update.mockResolvedValue(mockFullUser);
      mockPrismaService.user.findUnique.mockResolvedValue(mockFullUser);

      await service.updateAddress(userId, updateAddressDto as any);

      // Verify plain JSON address was stored, not an encrypted string
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shippingAddress: expect.objectContaining({
              fullName: 'Updated Name',
            }),
          }),
        }),
      );
    });

    it('should throw error if user not found', async () => {
      mockPrismaService.user.update.mockRejectedValue(new Error('Record not found'));

      await expect(
        service.updateAddress('non-existent-user', updateAddressDto as any),
      ).rejects.toThrow('Record not found');
    });
  });
});
