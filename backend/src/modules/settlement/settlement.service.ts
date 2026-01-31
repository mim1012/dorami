import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  GetSettlementQueryDto,
  SettlementReportDto,
  SettlementSummaryDto,
  SettlementOrderItemDto,
} from './dto/settlement.dto';
import * as ExcelJS from 'exceljs';

@Injectable()
export class SettlementService {
  constructor(private prisma: PrismaService) {}

  async getSettlementReport(query: GetSettlementQueryDto): Promise<SettlementReportDto> {
    const fromDate = new Date(query.from);
    fromDate.setHours(0, 0, 0, 0);

    const toDate = new Date(query.to);
    toDate.setHours(23, 59, 59, 999);

    // Get all confirmed orders within date range
    const orders = await this.prisma.order.findMany({
      where: {
        paymentStatus: 'CONFIRMED',
        paidAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        user: {
          select: {
            instagramId: true,
          },
        },
      },
      orderBy: {
        paidAt: 'desc',
      },
    });

    // Calculate summary
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total), 0);
    const totalShippingFee = orders.reduce((sum, order) => sum + Number(order.shippingFee), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const summary: SettlementSummaryDto = {
      totalOrders,
      totalRevenue,
      avgOrderValue,
      totalShippingFee,
    };

    // Map orders to DTOs
    const orderDtos: SettlementOrderItemDto[] = orders.map((order) => ({
      orderId: order.id,
      orderDate: order.createdAt.toISOString(),
      customerId: order.user.instagramId || order.instagramId,
      total: Number(order.total),
      paidAt: order.paidAt!.toISOString(),
    }));

    return {
      summary,
      orders: orderDtos,
      dateRange: {
        from: query.from,
        to: query.to,
      },
    };
  }

  async generateExcelReport(query: GetSettlementQueryDto): Promise<Buffer> {
    const report = await this.getSettlementReport(query);

    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Order Details
    const ordersSheet = workbook.addWorksheet('주문 내역');
    
    ordersSheet.columns = [
      { header: '주문일', key: 'orderDate', width: 15 },
      { header: '주문번호', key: 'orderId', width: 25 },
      { header: '고객 (@인스타그램)', key: 'customerId', width: 20 },
      { header: '주문금액', key: 'subtotal', width: 15 },
      { header: '배송비', key: 'shippingFee', width: 12 },
      { header: '총 금액', key: 'total', width: 15 },
      { header: '입금일', key: 'paidAt', width: 15 },
      { header: '입금자명', key: 'depositorName', width: 15 },
    ];

    // Style header row
    ordersSheet.getRow(1).font = { bold: true };
    ordersSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE91E63' }, // Hot Pink
    };
    ordersSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add order data
    const ordersWithDetails = await this.prisma.order.findMany({
      where: {
        id: { in: report.orders.map((o) => o.orderId) },
      },
      select: {
        id: true,
        createdAt: true,
        subtotal: true,
        shippingFee: true,
        total: true,
        paidAt: true,
        depositorName: true,
        instagramId: true,
      },
      orderBy: {
        paidAt: 'desc',
      },
    });

    ordersWithDetails.forEach((order) => {
      ordersSheet.addRow({
        orderDate: this.formatDate(order.createdAt),
        orderId: order.id,
        customerId: order.instagramId,
        subtotal: Number(order.subtotal),
        shippingFee: Number(order.shippingFee),
        total: Number(order.total),
        paidAt: order.paidAt ? this.formatDate(order.paidAt) : '',
        depositorName: order.depositorName,
      });
    });

    // Format currency columns
    ordersSheet.getColumn('subtotal').numFmt = '$#,##0.00';
    ordersSheet.getColumn('shippingFee').numFmt = '$#,##0.00';
    ordersSheet.getColumn('total').numFmt = '$#,##0.00';

    // Sheet 2: Summary
    const summarySheet = workbook.addWorksheet('요약');
    
    summarySheet.columns = [
      { header: '항목', key: 'label', width: 25 },
      { header: '값', key: 'value', width: 20 },
    ];

    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE91E63' },
    };
    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    summarySheet.addRow({ label: '조회 기간', value: `${query.from} ~ ${query.to}` });
    summarySheet.addRow({ label: '총 주문 건수', value: report.summary.totalOrders });
    summarySheet.addRow({ label: '총 매출액', value: report.summary.totalRevenue });
    summarySheet.addRow({ label: '평균 주문액', value: report.summary.avgOrderValue });
    summarySheet.addRow({ label: '배송비 총액', value: report.summary.totalShippingFee });

    summarySheet.getColumn('value').numFmt = '$#,##0.00';

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }
}
