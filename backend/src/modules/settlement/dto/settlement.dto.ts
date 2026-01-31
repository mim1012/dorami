import { IsDateString, IsOptional } from 'class-validator';

export class GetSettlementQueryDto {
  @IsDateString()
  from: string; // YYYY-MM-DD format

  @IsDateString()
  to: string; // YYYY-MM-DD format
}

export class SettlementSummaryDto {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  totalShippingFee: number;
}

export class SettlementOrderItemDto {
  orderId: string;
  orderDate: string; // ISO 8601 format
  customerId: string; // Instagram ID
  total: number;
  paidAt: string; // ISO 8601 format
}

export class SettlementReportDto {
  summary: SettlementSummaryDto;
  orders: SettlementOrderItemDto[];
  dateRange: {
    from: string;
    to: string;
  };
}
