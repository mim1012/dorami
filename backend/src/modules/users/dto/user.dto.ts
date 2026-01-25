import { IsString, IsEmail, IsOptional, IsEnum } from 'class-validator';

export enum UserRole {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  ADMIN = 'ADMIN',
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  nickname?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  profileImage?: string;
}

export class UserResponseDto {
  id: string;
  kakaoId: string;
  email?: string;
  nickname: string;
  profileImage?: string;
  role: string;
  depositorName?: string;
  instagramId?: string;
  createdAt: Date;
  updatedAt: Date;
}
