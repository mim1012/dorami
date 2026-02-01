import { IsString, IsNotEmpty, Matches, IsOptional, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsUSState } from '../../common/validators/us-state.validator';

export class CompleteProfileDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  depositorName: string;  // 입금자명

  @IsString()
  @IsNotEmpty()
  @Matches(/^@?[a-zA-Z0-9._]+$/, {
    message: 'Instagram ID must contain only letters, numbers, periods, and underscores',
  })
  @Transform(({ value }) => {
    // Auto-add @ prefix if missing
    return value.startsWith('@') ? value : `@${value}`;
  })
  instagramId: string;

  // Shipping address fields (will be encrypted)
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  fullName: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  address1: string;

  @IsString()
  @IsOptional()
  @Length(0, 200)
  address2?: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  city: string;

  @IsString()
  @IsNotEmpty()
  @IsUSState({
    message: 'State must be a 2-letter US state code',
  })
  state: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{5}(-\d{4})?$/, {
    message: 'ZIP code must be in format 12345 or 12345-6789',
  })
  zip: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\(\d{3}\) \d{3}-\d{4}$/, {
    message: 'Phone number must be in format (123) 456-7890',
  })
  phone: string;
}

export class CheckInstagramDto {
  @IsString()
  @IsNotEmpty()
  instagramId: string;
}
