import { IsOptional, IsInt, Min, IsString, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

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
