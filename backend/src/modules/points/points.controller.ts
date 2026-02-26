import { Controller, Get, Post, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { PointsService } from './points.service';
import { PointsConfigService } from './points-config.service';
import { GetPointHistoryQueryDto, AdjustPointsDto, UpdatePointsConfigDto } from './dto/points.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PointTransactionType } from '@prisma/client';

@Controller()
@UseGuards(JwtAuthGuard)
export class PointsController {
  constructor(
    private pointsService: PointsService,
    private pointsConfigService: PointsConfigService,
  ) {}

  // ── User Endpoints ──

  /**
   * Get current user's point balance
   */
  @Get('users/me/points')
  async getMyBalance(@CurrentUser('userId') userId: string) {
    return this.pointsService.getBalance(userId);
  }

  /**
   * Get current user's point transaction history
   */
  @Get('users/me/points/history')
  async getMyHistory(
    @CurrentUser('userId') userId: string,
    @Query() query: GetPointHistoryQueryDto,
  ) {
    return this.pointsService.getTransactionHistory(userId, query);
  }

  /**
   * Get specific user's point balance (admin or self)
   */
  @Get('users/:userId/points')
  async getUserBalance(@Param('userId') userId: string) {
    return this.pointsService.getBalance(userId);
  }

  /**
   * Get specific user's point transaction history (admin or self)
   */
  @Get('users/:userId/points/history')
  async getUserHistory(@Param('userId') userId: string, @Query() query: GetPointHistoryQueryDto) {
    return this.pointsService.getTransactionHistory(userId, query);
  }

  // ── Admin Endpoints ──

  /**
   * Get points configuration (Admin)
   */
  @Get('admin/config/points')
  @AdminOnly()
  async getPointsConfig() {
    return this.pointsConfigService.getPointsConfig();
  }

  /**
   * Update points configuration (Admin)
   */
  @Put('admin/config/points')
  @AdminOnly()
  async updatePointsConfig(@Body() dto: UpdatePointsConfigDto) {
    return this.pointsConfigService.updatePointsConfig(dto);
  }

  /**
   * Manual point adjustment (Admin)
   */
  @Post('admin/users/:userId/points/adjust')
  @AdminOnly()
  async adjustPoints(@Param('userId') userId: string, @Body() dto: AdjustPointsDto) {
    if (dto.type === 'add') {
      return this.pointsService.addPoints(
        userId,
        dto.amount,
        PointTransactionType.MANUAL_ADD,
        undefined,
        dto.reason,
      );
    } else {
      return this.pointsService.deductPoints(
        userId,
        dto.amount,
        PointTransactionType.MANUAL_SUBTRACT,
        undefined,
        dto.reason,
      );
    }
  }
}
