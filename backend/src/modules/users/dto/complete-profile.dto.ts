import { IsString, IsNotEmpty, Matches, IsOptional, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUSState } from '../../../common/validators/us-state.validator';

export class CompleteProfileDto {
  @ApiProperty({ description: '입금자명', example: '홍길동', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  depositorName!: string; // 입금자명

  @ApiProperty({ description: '인스타그램 ID (@ 자동 추가)', example: 'my_instagram' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^@?[a-zA-Z0-9._]+$/, {
    message: 'Instagram ID must contain only letters, numbers, periods, and underscores',
  })
  @Transform(({ value }: { value: string }) => {
    // Auto-add @ prefix if missing
    return value.startsWith('@') ? value : `@${value}`;
  })
  instagramId!: string;

  // Shipping address fields (will be encrypted)
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

export class CheckInstagramDto {
  @ApiProperty({ description: '확인할 인스타그램 ID', example: 'my_instagram' })
  @IsString()
  @IsNotEmpty()
  instagramId!: string;
}
