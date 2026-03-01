import { Controller, Get, Query, Response } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { SettlementService } from './settlement.service';
import { GetSettlementQueryDto } from './dto/settlement.dto';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { Response as ExpressResponse } from 'express';

@ApiTags('Settlement')
@ApiBearerAuth()
@Controller('admin/settlement')
@AdminOnly()
export class SettlementController {
  constructor(private settlementService: SettlementService) {}

  @Get()
  @ApiOperation({
    summary: '정산 보고서 조회 (관리자)',
    description: '기간별 정산 내역을 조회합니다.',
  })
  @ApiQuery({ name: 'from', description: '시작일 (YYYY-MM-DD)', example: '2024-01-01' })
  @ApiQuery({ name: 'to', description: '종료일 (YYYY-MM-DD)', example: '2024-01-31' })
  @ApiResponse({ status: 200, description: '정산 보고서 데이터' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getSettlementReport(@Query() query: GetSettlementQueryDto) {
    return this.settlementService.getSettlementReport(query);
  }

  @Get('download')
  @ApiOperation({
    summary: '정산 보고서 엑셀 다운로드 (관리자)',
    description: '기간별 정산 내역을 Excel 파일로 다운로드합니다.',
  })
  @ApiQuery({ name: 'from', description: '시작일 (YYYY-MM-DD)', example: '2024-01-01' })
  @ApiQuery({ name: 'to', description: '종료일 (YYYY-MM-DD)', example: '2024-01-31' })
  @ApiResponse({
    status: 200,
    description: 'Excel 파일 다운로드',
    content: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {} },
  })
  @ApiResponse({ status: 403, description: '권한 없음' })
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
