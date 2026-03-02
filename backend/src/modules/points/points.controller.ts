import { Controller, Get, Post, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { PointsService } from './points.service';
import { PointsConfigService } from './points-config.service';
import { GetPointHistoryQueryDto, AdjustPointsDto, UpdatePointsConfigDto } from './dto/points.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PointTransactionType } from '@prisma/client';

@ApiTags('Points')
@ApiBearerAuth()
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
  @ApiOperation({ summary: '내 포인트 잔액 조회' })
  @ApiResponse({ status: 200, description: '포인트 잔액 정보' })
  async getMyBalance(@CurrentUser('userId') userId: string) {
    return this.pointsService.getBalance(userId);
  }

  /**
   * Get current user's point transaction history
   */
  @Get('users/me/points/history')
  @ApiOperation({ summary: '내 포인트 내역 조회' })
  @ApiResponse({ status: 200, description: '포인트 거래 내역 목록' })
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
  @ApiOperation({ summary: '특정 사용자 포인트 잔액 조회 (본인 또는 관리자)' })
  @ApiParam({ name: 'userId', description: '사용자 ID' })
  @ApiResponse({ status: 200, description: '포인트 잔액 정보' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getUserBalance(
    @Param('userId') targetUserId: string,
    @CurrentUser('userId') currentUserId: string,
    @CurrentUser('role') role: string,
  ) {
    // Only allow access to own data or if admin
    if (targetUserId !== currentUserId && role !== 'ADMIN') {
      throw new Error("Forbidden: Cannot view another user's points");
    }
    return this.pointsService.getBalance(targetUserId);
  }

  /**
   * Get specific user's point transaction history (admin or self)
   */
  @Get('users/:userId/points/history')
  @ApiOperation({ summary: '특정 사용자 포인트 내역 조회 (본인 또는 관리자)' })
  @ApiParam({ name: 'userId', description: '사용자 ID' })
  @ApiResponse({ status: 200, description: '포인트 거래 내역 목록' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getUserHistory(
    @Param('userId') targetUserId: string,
    @Query() query: GetPointHistoryQueryDto,
    @CurrentUser('userId') currentUserId: string,
    @CurrentUser('role') role: string,
  ) {
    // Only allow access to own data or if admin
    if (targetUserId !== currentUserId && role !== 'ADMIN') {
      throw new Error("Forbidden: Cannot view another user's point history");
    }
    return this.pointsService.getTransactionHistory(targetUserId, query);
  }

  // ── Admin Endpoints ──

  /**
   * Get points configuration (Admin)
   */
  @Get('admin/config/points')
  @AdminOnly()
  @ApiOperation({ summary: '포인트 설정 조회 (관리자)' })
  @ApiResponse({ status: 200, description: '포인트 설정 정보' })
  async getPointsConfig() {
    return this.pointsConfigService.getPointsConfig();
  }

  /**
   * Update points configuration (Admin)
   */
  @Put('admin/config/points')
  @AdminOnly()
  @ApiOperation({ summary: '포인트 설정 업데이트 (관리자)' })
  @ApiResponse({ status: 200, description: '포인트 설정 업데이트 성공' })
  async updatePointsConfig(@Body() dto: UpdatePointsConfigDto) {
    return this.pointsConfigService.updatePointsConfig(dto);
  }

  /**
   * Manual point adjustment (Admin)
   */
  @Post('admin/users/:userId/points/adjust')
  @AdminOnly()
  @ApiOperation({
    summary: '포인트 수동 조정 (관리자)',
    description: '사용자의 포인트를 수동으로 추가하거나 차감합니다.',
  })
  @ApiParam({ name: 'userId', description: '사용자 ID' })
  @ApiResponse({ status: 201, description: '포인트 조정 성공' })
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
