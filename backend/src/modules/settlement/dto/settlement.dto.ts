import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class GenerateSettlementDto {
  @IsString()
  @IsNotEmpty()
  sellerId: string;

  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;
}

export class SettlementResponseDto {
  id: string;
  sellerId: string;
  periodStart: Date;
  periodEnd: Date;
  totalSales: number;
  commission: number;
  settlementAmount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
