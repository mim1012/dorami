import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateUserDto, UserResponseDto } from './dto/user.dto';
import {
  UnauthorizedException,
  ProductNotFoundException,
} from '../../common/exceptions/business.exception';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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

  private mapToResponseDto(user: any): UserResponseDto {
    return {
      id: user.id,
      kakaoId: user.kakaoId,
      email: user.email,
      nickname: user.nickname,
      profileImage: user.profileImage,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
