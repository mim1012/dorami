import { IsString, IsNotEmpty, Matches, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUSState } from '../../../common/validators/us-state.validator';

export class UpdateAddressDto {
  @ApiProperty({ description: '수령인 이름', example: '홍길동', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  fullName!: string;

  @ApiProperty({ description: '주소 1', example: '123 Main St', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  address1!: string;

  @ApiPropertyOptional({
    description: '주소 2 (아파트, 동호수 등)',
    example: 'Apt 4B',
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @Length(0, 200)
  address2?: string;

  @ApiProperty({ description: '도시', example: 'Los Angeles', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  city!: string;

  @ApiProperty({ description: '주 코드 (2자리)', example: 'CA' })
  @IsString()
  @IsNotEmpty()
  @IsUSState({
    message: 'State must be a 2-letter US state code',
  })
  state!: string;

  @ApiProperty({ description: 'ZIP 코드', example: '90001' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{5}(-\d{4})?$/, {
    message: 'ZIP code must be in format 12345 or 12345-6789',
  })
  zip!: string;

  @ApiProperty({ description: '전화번호', example: '(213) 555-1234' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\(\d{3}\) \d{3}-\d{4}$/, {
    message: 'Phone number must be in format (123) 456-7890',
  })
  phone!: string;
}

export class ProfileResponseDto {
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

  @ApiProperty({ description: '역할', example: 'USER' })
  role!: string;

  @ApiPropertyOptional({ description: '입금자명', example: '홍길동' })
  depositorName?: string;

  @ApiPropertyOptional({ description: '인스타그램 ID', example: '@my_instagram' })
  instagramId?: string;

  @ApiPropertyOptional({ description: '전화번호', example: '01012345678' })
  phone?: string;

  @ApiPropertyOptional({ description: '배송지 정보 (복호화됨)' })
  shippingAddress?: {
    fullName: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
  };

  @ApiProperty({ description: '계정 생성일' })
  createdAt!: Date;

  @ApiProperty({ description: '계정 수정일' })
  updatedAt!: Date;
}
