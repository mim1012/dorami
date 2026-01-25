import { IsOptional, IsInt, Min, IsString, IsEnum, IsArray } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GetUsersQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @IsEnum(['createdAt', 'email', 'name', 'instagramId', 'lastLoginAt'])
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  // Search
  @IsOptional()
  @IsString()
  search?: string;

  // Date range filter
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  // Order count filter
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(0)
  minOrders?: number;

  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(0)
  maxOrders?: number;

  // Purchase amount filter
  @IsOptional()
  @Transform(({ value }) => (value ? parseFloat(value) : undefined))
  minAmount?: number;

  @IsOptional()
  @Transform(({ value }) => (value ? parseFloat(value) : undefined))
  maxAmount?: number;

  // Status filter (array)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  status?: string[];
}

export class UserListItemDto {
  id: string;
  email: string;
  name: string;
  instagramId: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  status: string;
  role: string;
  totalOrders: number;
  totalPurchaseAmount: number;
}

export class UserListResponseDto {
  users: UserListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
