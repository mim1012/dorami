import { IsString, IsEmail, IsOptional, Matches } from 'class-validator';

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

  @IsOptional()
  @IsString()
  @Matches(/^01[0-9]{8,9}$/, {
    message: '전화번호는 01012345678 형식이어야 합니다',
  })
  phone?: string;
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
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}
