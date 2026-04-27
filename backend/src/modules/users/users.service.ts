import { Injectable, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
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
    private encryptionService: EncryptionService,
  ) {}

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new UserNotFoundException(id);
    }

    return this.mapToResponseDto(user);
  }

  async findByKakaoId(kakaoId: string): Promise<UserResponseDto | null> {
    const user = await this.prisma.user.findUnique({ where: { kakaoId } });
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
    await this.prisma.user.delete({ where: { id: userId } });
  }

  async isInstagramIdAvailable(instagramId: string, excludeUserId?: string): Promise<boolean> {
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

  async completeProfile(userId: string, dto: CompleteProfileDto): Promise<UserResponseDto> {
    const isAvailable = await this.isInstagramIdAvailable(dto.instagramId, userId);
    if (!isAvailable) {
      throw new ConflictException('This Instagram ID is already registered');
    }

    const shippingAddress = this.buildShippingAddress(dto);
    const encryptedShippingAddress = this.encryptionService.encryptAddress(shippingAddress);

    let user;
    try {
      user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          email: dto.email,
          depositorName: dto.depositorName,
          instagramId: dto.instagramId,
          ...(dto.kakaoPhone !== undefined && { kakaoPhone: dto.kakaoPhone }),
          shippingAddress: encryptedShippingAddress as any,
          profileCompletedAt: new Date(),
        },
      });
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

  async getShippingAddress(userId: string): Promise<ShippingAddress | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { shippingAddress: true },
    });

    if (!user?.shippingAddress) {
      return null;
    }

    return this.encryptionService.normalizeAddressValue(user.shippingAddress);
  }

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UserNotFoundException(userId);
    }

    const shippingAddress = this.encryptionService.normalizeAddressValue(user.shippingAddress) ?? undefined;

    return {
      id: user.id,
      kakaoId: user.kakaoId,
      email: user.email ?? undefined,
      nickname: user.name,
      profileImage: undefined,
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

  async updateAddress(userId: string, dto: UpdateAddressDto): Promise<ProfileResponseDto> {
    const shippingAddress = this.buildShippingAddress(dto);
    const encryptedShippingAddress = this.encryptionService.encryptAddress(shippingAddress);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        shippingAddress: encryptedShippingAddress as any,
      },
    });

    return this.getProfile(userId);
  }

  normalizePhoneNumber(phone: string): string {
    if (!phone) {
      return '';
    }

    const cleaned = phone.replace(/[^\d+]/g, '');

    if (!cleaned) {
      throw new Error('Phone number must contain at least 10 digits');
    }

    let digits = cleaned;
    if (cleaned.startsWith('+1')) {
      digits = cleaned.slice(2);
    } else if (cleaned.startsWith('+')) {
      throw new Error('Only US phone numbers (+1) are supported');
    }

    digits = digits.slice(0, 10);

    if (digits.length !== 10) {
      throw new Error('Phone number must be exactly 10 digits');
    }

    return `+1${digits}`;
  }

  private buildShippingAddress(dto: {
    fullName: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
  }): ShippingAddress {
    return {
      fullName: dto.fullName,
      address1: dto.address1,
      address2: dto.address2,
      city: dto.city,
      state: dto.state,
      zip: dto.zip,
    };
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
    profileCompletedAt?: Date | null;
  }): UserResponseDto {
    return {
      id: user.id,
      kakaoId: user.kakaoId ?? undefined,
      email: user.email ?? undefined,
      nickname: user.name,
      profileImage: undefined,
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
