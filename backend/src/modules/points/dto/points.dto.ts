import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
  MinLength,
  Max,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PointTransactionType } from '@prisma/client';

export class GetPointHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(PointTransactionType)
  transactionType?: PointTransactionType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class AdjustPointsDto {
  @IsIn(['add', 'subtract'])
  type: 'add' | 'subtract';

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  reason: string;
}

export class UpdatePointsConfigDto {
  @IsOptional()
  @IsBoolean()
  pointsEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  pointEarningRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  pointMinRedemption?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pointMaxRedemptionPct?: number;

  @IsOptional()
  @IsBoolean()
  pointExpirationEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  @Type(() => Number)
  pointExpirationMonths?: number;
}

export class PointBalanceResponseDto {
  currentBalance: number;
  lifetimeEarned: number;
  lifetimeUsed: number;
  lifetimeExpired: number;
}

export class PointTransactionResponseDto {
  id: string;
  transactionType: PointTransactionType;
  amount: number;
  balanceAfter: number;
  orderId?: string;
  reason?: string;
  expiresAt?: Date;
  createdAt: Date;
}
