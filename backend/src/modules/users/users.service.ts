import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService, ShippingAddress } from '../../common/services/encryption.service';
import { UpdateUserDto, UserResponseDto } from './dto/user.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { UpdateAddressDto, ProfileResponseDto } from './dto/profile.dto';
import {
  UnauthorizedException,
  ProductNotFoundException,
} from '../../common/exceptions/business.exception';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {}

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new ProductNotFoundException(id);
    }

    return this.mapToResponseDto(user);
  }

  async findByKakaoId(kakaoId: string): Promise<UserResponseDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { kakaoId },
    });

    return user ? this.mapToResponseDto(user) : null;
  }

  async updateProfile(
    userId: string,
    updateDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateDto,
    });

    return this.mapToResponseDto(user);
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id: userId },
    });
  }

  /**
   * Check if Instagram ID is available (not taken by another user)
   */
  async isInstagramIdAvailable(instagramId: string, excludeUserId?: string): Promise<boolean> {
    const existing = await this.prisma.user.findUnique({
      where: { instagramId },
      select: { id: true },
    });

    if (!existing) return true;
    if (excludeUserId && existing.id === excludeUserId) return true;
    return false;
  }

  /**
   * Complete user profile with encrypted shipping address
   */
  async completeProfile(userId: string, dto: CompleteProfileDto): Promise<UserResponseDto> {
    // Check Instagram ID uniqueness
    const isAvailable = await this.isInstagramIdAvailable(dto.instagramId, userId);
    if (!isAvailable) {
      throw new ConflictException('This Instagram ID is already registered');
    }

    // Prepare shipping address for encryption
    const shippingAddress: ShippingAddress = {
      fullName: dto.fullName,
      address1: dto.address1,
      address2: dto.address2,
      city: dto.city,
      state: dto.state,
      zip: dto.zip,
      phone: dto.phone,
    };

    // Encrypt shipping address
    const encryptedAddress = this.encryptionService.encryptAddress(shippingAddress);

    // Update user with profile data
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        depositorName: dto.depositorName,
        instagramId: dto.instagramId,
        shippingAddress: encryptedAddress as any, // Store encrypted string as Json
      },
    });

    return this.mapToResponseDto(user);
  }

  /**
   * Get decrypted shipping address (admin only)
   */
  async getShippingAddress(userId: string): Promise<ShippingAddress | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { shippingAddress: true },
    });

    if (!user || !user.shippingAddress) {
      return null;
    }

    // Cast Json to string for decryption
    const encryptedString = user.shippingAddress as string;
    return this.encryptionService.decryptAddress(encryptedString);
  }

  /**
   * Get user profile with decrypted shipping address
   */
  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ProductNotFoundException(userId);
    }

    // Decrypt shipping address if exists
    let shippingAddress: ShippingAddress | undefined;
    if (user.shippingAddress) {
      const encryptedString = user.shippingAddress as string;
      shippingAddress = this.encryptionService.decryptAddress(encryptedString);
    }

    return {
      id: user.id,
      kakaoId: user.kakaoId,
      email: user.email,
      nickname: user.name, // Prisma schema uses 'name' field
      profileImage: undefined, // Not in current schema
      role: user.role,
      depositorName: user.depositorName,
      instagramId: user.instagramId,
      shippingAddress,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Update user shipping address
   */
  async updateAddress(userId: string, dto: UpdateAddressDto): Promise<ProfileResponseDto> {
    const shippingAddress: ShippingAddress = {
      fullName: dto.fullName,
      address1: dto.address1,
      address2: dto.address2,
      city: dto.city,
      state: dto.state,
      zip: dto.zip,
      phone: dto.phone,
    };

    // Encrypt shipping address
    const encryptedAddress = this.encryptionService.encryptAddress(shippingAddress);

    // Update user with new address
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        shippingAddress: encryptedAddress as any,
      },
    });

    return this.getProfile(userId);
  }

  private mapToResponseDto(user: any): UserResponseDto {
    return {
      id: user.id,
      kakaoId: user.kakaoId,
      email: user.email,
      nickname: user.name, // Prisma schema uses 'name' field
      profileImage: undefined, // Not in current schema
      role: user.role,
      depositorName: user.depositorName,
      instagramId: user.instagramId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
