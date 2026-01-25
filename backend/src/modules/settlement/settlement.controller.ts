import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { GenerateSettlementDto } from './dto/settlement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('settlement')
@UseGuards(JwtAuthGuard)
export class SettlementController {
  constructor(private settlementService: SettlementService) {}

  @Post('generate')
  async generateReport(@Body() generateDto: GenerateSettlementDto) {
    return this.settlementService.generateReport(generateDto);
  }

  @Get('seller/:sellerId')
  async getSettlementsBySeller(@Param('sellerId') sellerId: string) {
    return this.settlementService.getSettlementsBySeller(sellerId);
  }

  @Get(':id')
  async getSettlementById(@Param('id') id: string) {
    return this.settlementService.getSettlementById(id);
  }

  @Patch(':id/approve')
  async approveSettlement(@Param('id') id: string) {
    return this.settlementService.approveSettlement(id);
  }
}
