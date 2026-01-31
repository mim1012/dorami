import { Controller, Get, Query, UseGuards, Response } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { GetSettlementQueryDto } from './dto/settlement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Response as ExpressResponse } from 'express';

@Controller('admin/settlement')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SettlementController {
  constructor(private settlementService: SettlementService) {}

  @Get()
  async getSettlementReport(@Query() query: GetSettlementQueryDto) {
    return this.settlementService.getSettlementReport(query);
  }

  @Get('download')
  async downloadExcel(
    @Query() query: GetSettlementQueryDto,
    @Response() res: ExpressResponse,
  ) {
    const buffer = await this.settlementService.generateExcelReport(query);

    const filename = `settlement_${query.from}_${query.to}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }
}
