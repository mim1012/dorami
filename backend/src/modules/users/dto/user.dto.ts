import { IsString, IsEmail, IsOptional, Matches } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export enum UserRole {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  ADMIN = 'ADMIN',
}

export class UpdateUserDto {
  @ApiPropertyOptional({ description: '닉네임', example: '홍길동' })
  @IsString()
  @IsOptional()
  nickname?: string;

  @ApiPropertyOptional({ description: '이메일', example: 'user@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: '프로필 이미지 URL',
    example: 'https://example.com/profile.jpg',
  })
  @IsString()
  @IsOptional()
  profileImage?: string;

  @ApiPropertyOptional({ description: '전화번호 (01012345678 형식)', example: '01012345678' })
  @IsOptional()
  @IsString()
  @Matches(/^01[0-9]{8,9}$/, {
    message: '전화번호는 01012345678 형식이어야 합니다',
  })
  phone?: string;
}

export class UserResponseDto {
  @ApiProperty({ description: '사용자 ID' })
  id!: string;

  @ApiProperty({ description: '카카오 ID' })
  kakaoId!: string;

  @ApiPropertyOptional({ description: '이메일', example: 'user@example.com' })
  email?: string;

  @ApiProperty({ description: '닉네임', example: '홍길동' })
  nickname!: string;

  @ApiPropertyOptional({ description: '프로필 이미지 URL' })
  profileImage?: string;

  @ApiProperty({ description: '역할', enum: UserRole, example: UserRole.BUYER })
  role!: string;

  @ApiPropertyOptional({ description: '입금자명', example: '홍길동' })
  depositorName?: string;

  @ApiPropertyOptional({ description: '인스타그램 ID', example: '@my_instagram' })
  instagramId?: string;

  @ApiPropertyOptional({ description: '전화번호', example: '01012345678' })
  phone?: string;

  @ApiProperty({ description: '계정 생성일' })
  createdAt!: Date;

  @ApiProperty({ description: '계정 수정일' })
  updatedAt!: Date;
}
