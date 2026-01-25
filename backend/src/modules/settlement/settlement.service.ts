import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  GenerateSettlementDto,
  SettlementResponseDto,
} from './dto/settlement.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class SettlementService {
  private readonly COMMISSION_RATE = 0.1; // 10% platform commission

  constructor(private prisma: PrismaService) {}

  async generateReport(
    generateDto: GenerateSettlementDto,
  ): Promise<SettlementResponseDto> {
    const { sellerId, periodStart, periodEnd } = generateDto;

    // Aggregate orders for the seller in the period
    const orders = await this.prisma.order.findMany({
      where: {
        userId: sellerId,
        status: 'PAYMENT_CONFIRMED',
        createdAt: {
          gte: new Date(periodStart),
          lte: new Date(periodEnd),
        },
      },
    });

    // Calculate total sales
    const totalSales = orders.reduce(
      (sum, order) => sum + Number(order.total),
      0,
    );

    // Calculate commission and settlement amount
    const commission = totalSales * this.COMMISSION_RATE;
    const settlementAmount = totalSales - commission;

    // Create settlement record
    const settlement = await this.prisma.settlement.create({
      data: {
        sellerId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        totalSales: new Decimal(totalSales),
        commission: new Decimal(commission),
        settlementAmount: new Decimal(settlementAmount),
        status: 'PENDING',
      },
    });

    return this.mapToResponseDto(settlement);
  }

  async getSettlementById(id: string): Promise<SettlementResponseDto> {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
    });

    if (!settlement) {
      throw new Error('Settlement not found');
    }

    return this.mapToResponseDto(settlement);
  }

  async getSettlementsBySeller(sellerId: string): Promise<SettlementResponseDto[]> {
    const settlements = await this.prisma.settlement.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
    });

    return settlements.map((s) => this.mapToResponseDto(s));
  }

  async approveSettlement(id: string): Promise<SettlementResponseDto> {
    const settlement = await this.prisma.settlement.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    return this.mapToResponseDto(settlement);
  }

  private mapToResponseDto(settlement: any): SettlementResponseDto {
    return {
      id: settlement.id,
      sellerId: settlement.sellerId,
      periodStart: settlement.periodStart,
      periodEnd: settlement.periodEnd,
      totalSales: Number(settlement.totalSales),
      commission: Number(settlement.commission),
      settlementAmount: Number(settlement.settlementAmount),
      status: settlement.status,
      createdAt: settlement.createdAt,
      updatedAt: settlement.updatedAt,
    };
  }
}
