import { Controller, Get, Query, Response } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { GetSettlementQueryDto } from './dto/settlement.dto';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { Response as ExpressResponse } from 'express';

@Controller('admin/settlement')
@AdminOnly()
export class SettlementController {
  constructor(private settlementService: SettlementService) {}

  @Get()
  async getSettlementReport(@Query() query: GetSettlementQueryDto) {
    return this.settlementService.getSettlementReport(query);
  }

  @Get('download')
  async downloadExcel(@Query() query: GetSettlementQueryDto, @Response() res: ExpressResponse) {
    const buffer = await this.settlementService.generateExcelReport(query);

    // Sanitize filename to prevent header injection
    const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9\-_]/g, '');
    const filename = `settlement_${sanitize(query.from)}_${sanitize(query.to)}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }
}
