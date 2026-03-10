import { IsString, IsEmail, IsOptional, Matches, Length, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
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
  @IsNotEmpty()
  nickname?: string;

  @ApiPropertyOptional({ description: '이메일', example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  @IsNotEmpty()
  email?: string;

  @ApiPropertyOptional({
    description: '프로필 이미지 URL',
    example: 'https://example.com/profile.jpg',
  })
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  profileImage?: string;

  @ApiPropertyOptional({
    description: '카카오톡에 등록된 전화번호 (미국: +1 213-555-1234 / 한국: 010-1234-5678)',
    example: '+1 213-555-1234',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+1|1)?[\s\-.]?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}$|^(\+82|0)\d{8,11}$/, {
    message: '미국 번호 (+1 213-555-1234) 또는 한국 번호 (010-1234-5678) 형식으로 입력해주세요',
  })
  kakaoPhone?: string;

  @ApiPropertyOptional({ description: '인스타그램 ID', example: '@my_instagram' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^@?[a-zA-Z0-9._]+$/, {
    message: 'Instagram ID must contain only letters, numbers, periods, and underscores',
  })
  @Transform(({ value }: { value: string }) => {
    if (!value) {
      return value;
    }
    return value.startsWith('@') ? value : `@${value}`;
  })
  instagramId?: string;

  @ApiPropertyOptional({ description: '입금자명', example: '홍길동' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  depositorName?: string;
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

  @ApiPropertyOptional({
    description: '카카오 전화번호 (알림톡용)',
    example: '010-1234-5678',
  })
  kakaoPhone?: string;

  @ApiPropertyOptional({ description: '배송지 (복호화됨)' })
  shippingAddress?: {
    fullName?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
  };

  @ApiProperty({ description: '프로필 완료 여부', example: true })
  profileComplete!: boolean;

  @ApiPropertyOptional({ description: '프로필 완료 시각 (ISO 문자열)' })
  profileCompletedAt?: Date;

  @ApiProperty({ description: '계정 생성일' })
  createdAt!: Date;

  @ApiProperty({ description: '계정 수정일' })
  updatedAt!: Date;
}
