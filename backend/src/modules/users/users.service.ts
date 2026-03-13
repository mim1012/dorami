import { Injectable, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { ShippingAddress } from '@live-commerce/shared-types';
import { UpdateUserDto, UserResponseDto } from './dto/user.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { UpdateAddressDto, ProfileResponseDto } from './dto/profile.dto';
import { UserNotFoundException } from '../../common/exceptions/business.exception';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new UserNotFoundException(id);
    }

    return this.mapToResponseDto(user);
  }

  async findByKakaoId(kakaoId: string): Promise<UserResponseDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { kakaoId },
    });

    return user ? this.mapToResponseDto(user) : null;
  }

  async updateProfile(userId: string, updateDto: UpdateUserDto): Promise<UserResponseDto> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: updateDto,
      });

      return this.mapToResponseDto(user);
    } catch (err: unknown) {
      const prismaErr = err as { code?: string; meta?: { target?: string[] } };
      if (prismaErr.code === 'P2002') {
        const target = prismaErr.meta?.target ?? [];
        if (target.includes('email')) {
          throw new ConflictException('이미 사용 중인 이메일입니다');
        }
        if (target.includes('instagramId') || target.includes('instagram_id')) {
          throw new ConflictException('이미 사용 중인 인스타그램 ID입니다');
        }
        throw new ConflictException('중복된 정보가 있습니다');
      }
      throw err;
    }
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
    // Return false if instagramId is null/undefined/empty
    if (!instagramId || instagramId.trim() === '') {
      return false;
    }

    const existing = await this.prisma.user.findUnique({
      where: { instagramId },
      select: { id: true },
    });

    if (!existing) {
      return true;
    }
    if (excludeUserId && existing.id === excludeUserId) {
      return true;
    }
    return false;
  }

  /**
   * Complete user profile
   */
  async completeProfile(userId: string, dto: CompleteProfileDto): Promise<UserResponseDto> {
    // Check Instagram ID uniqueness (only if provided)
    if (dto.instagramId) {
      const isAvailable = await this.isInstagramIdAvailable(dto.instagramId, userId);
      if (!isAvailable) {
        throw new ConflictException('This Instagram ID is already registered');
      }
    }

    const shippingAddress: ShippingAddress = {
      fullName: dto.fullName,
      address1: dto.address1,
      address2: dto.address2,
      city: dto.city,
      state: dto.state,
      zip: dto.zip,
    };

    // Update user with profile data
    let user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: dto.email,
        depositorName: dto.depositorName,
        instagramId: dto.instagramId,
        ...(dto.kakaoPhone !== undefined && { kakaoPhone: dto.kakaoPhone }),
        shippingAddress: shippingAddress as unknown as Prisma.InputJsonValue,
        profileCompletedAt: new Date(),
      },
    });

    // Auto-promote to ADMIN if email matches ADMIN_EMAILS env var
    const adminEmails = this.configService.get<string>('ADMIN_EMAILS', '');
    const adminEmailSet = new Set(
      adminEmails
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean),
    );
    if (dto.email && adminEmailSet.has(dto.email) && user.role !== 'ADMIN') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { role: 'ADMIN' },
      });
      user = (await this.prisma.user.findUnique({ where: { id: userId } }))!;
    }

    return this.mapToResponseDto(user);
  }

  /**
   * Get shipping address (admin only)
   */
  async getShippingAddress(userId: string): Promise<ShippingAddress | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { shippingAddress: true },
    });

    if (!user?.shippingAddress) {
      return null;
    }

    return user.shippingAddress as unknown as ShippingAddress;
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UserNotFoundException(userId);
    }

    const shippingAddress = user.shippingAddress
      ? (user.shippingAddress as unknown as ShippingAddress)
      : undefined;

    return {
      id: user.id,
      kakaoId: user.kakaoId,
      email: user.email ?? undefined,
      nickname: user.name, // Prisma schema uses 'name' field
      profileImage: undefined, // Not in current schema
      role: user.role,
      depositorName: user.depositorName ?? undefined,
      instagramId: user.instagramId ?? undefined,
      kakaoPhone: user.kakaoPhone ?? undefined,
      shippingAddress,
      profileComplete: Boolean(user.profileCompletedAt),
      profileCompletedAt: user.profileCompletedAt ?? undefined,
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
    };

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        shippingAddress: shippingAddress as unknown as Prisma.InputJsonValue,
      },
    });

    return this.getProfile(userId);
  }

  /**
   * Normalize phone number to +1XXXXXXXXXX format (US only)
   * Validates and normalizes user input to consistent format
   */
  normalizePhoneNumber(phone: string): string {
    if (!phone) {
      return '';
    }

    // Extract only digits and + sign
    const cleaned = phone.replace(/[^\d+]/g, '');

    if (!cleaned) {
      throw new Error('Phone number must contain at least 10 digits');
    }

    // Remove country code if present
    let digits = cleaned;
    if (cleaned.startsWith('+1')) {
      digits = cleaned.slice(2);
    } else if (cleaned.startsWith('+')) {
      throw new Error('Only US phone numbers (+1) are supported');
    }

    // Take first 10 digits
    digits = digits.slice(0, 10);

    // Validate exactly 10 digits
    if (digits.length !== 10) {
      throw new Error('Phone number must be exactly 10 digits');
    }

    // Return normalized format: +12135551234
    return `+1${digits}`;
  }

  private mapToResponseDto(user: {
    id: string;
    kakaoId: string;
    email?: string | null;
    name: string;
    role: string;
    depositorName?: string | null;
    instagramId?: string | null;
    kakaoPhone?: string | null;
    createdAt: Date;
    updatedAt: Date;
    shippingAddress?: Prisma.JsonValue | null;
    profileCompletedAt?: Date | null;
  }): UserResponseDto {
    return {
      id: user.id,
      kakaoId: user.kakaoId ?? undefined,
      email: user.email ?? undefined,
      nickname: user.name, // Prisma schema uses 'name' field
      profileImage: undefined, // Not in current schema
      role: user.role,
      depositorName: user.depositorName ?? undefined,
      instagramId: user.instagramId ?? undefined,
      kakaoPhone: user.kakaoPhone ?? undefined,
      profileComplete: Boolean(user.profileCompletedAt),
      profileCompletedAt: user.profileCompletedAt ?? undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
