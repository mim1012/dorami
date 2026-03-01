import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Body,
  Query,
  Param,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminService } from './admin.service';
import {
  GetUsersQueryDto,
  UpdateNoticeDto,
  GetOrdersQueryDto,
  UpdateUserStatusDto,
  UpdateOrderStatusDto,
  UpdateOrderShippingStatusDto,
  UpdateSystemSettingsDto,
  UpdateShippingMessagesDto,
  UpdateHomeFeaturedProductsDto,
  UpdateMarketingCampaignsDto,
  UpdatePaymentProvidersDto,
  UpdateNotificationTemplateDto,
} from './dto/admin.dto';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { parsePagination } from '../../common/utils/pagination.util';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as Papa from 'papaparse';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@AdminOnly()
export class AdminController {
  constructor(
    private adminService: AdminService,
    private redisService: RedisService,
    private prismaService: PrismaService,
  ) {}

  @Get('users')
  @ApiOperation({ summary: '사용자 목록 조회 (관리자)' })
  @ApiResponse({ status: 200, description: '사용자 목록 및 페이지네이션 정보' })
  async getUserList(@Query() query: GetUsersQueryDto) {
    return this.adminService.getUserList(query);
  }

  @Get('orders')
  @ApiOperation({ summary: '주문 목록 조회 (관리자)' })
  @ApiResponse({ status: 200, description: '주문 목록 및 페이지네이션 정보' })
  async getOrderList(@Query() query: GetOrdersQueryDto) {
    return this.adminService.getOrderList(query);
  }

  @Get('dashboard/stats')
  @ApiOperation({ summary: '대시보드 통계 조회 (관리자)' })
  @ApiResponse({ status: 200, description: '총 사용자수, 매출, 주문수 등 통계' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('activities/recent')
  @ApiOperation({ summary: '최근 활동 조회 (관리자)' })
  @ApiQuery({ name: 'limit', required: false, description: '조회 수 (기본값: 10)', example: '10' })
  @ApiResponse({ status: 200, description: '최근 활동 목록' })
  async getRecentActivities(@Query('limit') limit?: number) {
    return this.adminService.getRecentActivities(limit ? parseInt(limit.toString(), 10) : 10);
  }

  @Get('config/settings')
  @ApiOperation({ summary: '시스템 설정 조회 (관리자)' })
  @ApiResponse({ status: 200, description: '시스템 설정 정보' })
  async getSystemSettings() {
    return this.adminService.getSystemSettings();
  }

  @Put('config/settings')
  @ApiOperation({ summary: '시스템 설정 업데이트 (관리자)' })
  @ApiResponse({ status: 200, description: '설정 업데이트 성공' })
  async updateSystemSettings(@Body() dto: UpdateSystemSettingsDto) {
    return this.adminService.updateSystemSettings(dto);
  }

  @Get('config')
  @ApiOperation({ summary: '시스템 구성 조회 (관리자)' })
  @ApiResponse({ status: 200, description: '시스템 구성 정보' })
  async getSystemConfig() {
    return this.adminService.getSystemConfig();
  }

  @Put('config')
  @ApiOperation({ summary: '시스템 구성 업데이트 (관리자)' })
  @ApiResponse({ status: 200, description: '구성 업데이트 성공' })
  async updateSystemConfig(@Body() dto: UpdateNoticeDto) {
    return this.adminService.updateSystemConfig(dto);
  }

  @Get('config/shipping-messages')
  @ApiOperation({ summary: '배송 메시지 템플릿 조회 (관리자)' })
  @ApiResponse({ status: 200, description: '배송 단계별 메시지 템플릿' })
  async getShippingMessages() {
    return this.adminService.getShippingMessages();
  }

  @Put('config/shipping-messages')
  @ApiOperation({ summary: '배송 메시지 템플릿 업데이트 (관리자)' })
  @ApiResponse({ status: 200, description: '메시지 템플릿 업데이트 성공' })
  async updateShippingMessages(@Body() dto: UpdateShippingMessagesDto) {
    return this.adminService.updateShippingMessages(dto as unknown as Record<string, string>);
  }

  @Get('config/home-featured-products')
  @ApiOperation({ summary: '홈 특가 상품 설정 조회 (관리자)' })
  @ApiResponse({ status: 200, description: '홈 특가 상품 목록' })
  async getHomeFeaturedProducts() {
    return this.adminService.getHomeFeaturedProducts();
  }

  @Put('config/home-featured-products')
  @ApiOperation({ summary: '홈 특가 상품 설정 저장 (관리자)' })
  @ApiResponse({ status: 200, description: '홈 특가 상품 목록 저장 완료' })
  async updateHomeFeaturedProducts(@Body() dto: UpdateHomeFeaturedProductsDto) {
    return this.adminService.updateHomeFeaturedProducts(dto);
  }

  @Get('config/marketing-campaigns')
  @ApiOperation({ summary: '마케팅 캠페인 설정 조회 (관리자)' })
  @ApiResponse({ status: 200, description: '마케팅 캠페인 목록' })
  async getMarketingCampaigns() {
    return this.adminService.getMarketingCampaigns();
  }

  @Put('config/marketing-campaigns')
  @ApiOperation({ summary: '마케팅 캠페인 설정 저장 (관리자)' })
  @ApiResponse({ status: 200, description: '마케팅 캠페인 목록 저장 완료' })
  async updateMarketingCampaigns(@Body() dto: UpdateMarketingCampaignsDto) {
    return this.adminService.updateMarketingCampaigns(dto);
  }

  @Get('config/payment-providers')
  @ApiOperation({ summary: '해외 결제 수단 설정 조회 (관리자)' })
  @ApiResponse({ status: 200, description: '해외 결제 수단 목록' })
  async getPaymentProviders() {
    return this.adminService.getPaymentProviders();
  }

  @Put('config/payment-providers')
  @ApiOperation({ summary: '해외 결제 수단 설정 저장 (관리자)' })
  @ApiResponse({ status: 200, description: '해외 결제 수단 목록 저장 완료' })
  async updatePaymentProviders(@Body() dto: UpdatePaymentProvidersDto) {
    return this.adminService.updatePaymentProviders(dto);
  }

  @Get('orders/export')
  @ApiOperation({ summary: '주문 목록 엑셀 다운로드 (관리자)' })
  @ApiResponse({
    status: 200,
    description: 'Excel 파일 다운로드',
    content: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {} },
  })
  async exportOrders(@Query() query: GetOrdersQueryDto, @Res() res: Response) {
    try {
      const buffer = await this.adminService.exportOrdersExcel(query);
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename=orders_${date}.xlsx`);
      res.send(buffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Excel export failed';
      res.status(500).json({ success: false, message });
    }
  }

  @Get('orders/:id')
  @ApiOperation({ summary: '주문 상세 조회 (관리자)' })
  @ApiParam({ name: 'id', description: '주문 ID', example: 'ORD-20240101-00001' })
  @ApiResponse({ status: 200, description: '주문 상세 정보' })
  async getOrderDetail(@Param('id') orderId: string) {
    return this.adminService.getOrderDetail(orderId);
  }

  @Patch('orders/:id/confirm-payment')
  @ApiOperation({
    summary: '결제 확인 처리 (관리자)',
    description: '주문의 결제를 수동으로 확인합니다.',
  })
  @ApiParam({ name: 'id', description: '주문 ID', example: 'ORD-20240101-00001' })
  @ApiResponse({ status: 200, description: '결제 확인 성공' })
  async confirmPayment(@Param('id') orderId: string) {
    return this.adminService.confirmOrderPayment(orderId);
  }

  @Patch('orders/:id/status')
  @ApiOperation({ summary: '주문 상태 변경 (관리자)' })
  @ApiParam({ name: 'id', description: '주문 ID', example: 'ORD-20240101-00001' })
  @ApiResponse({ status: 200, description: '주문 상태 변경 성공' })
  async updateOrderStatus(@Param('id') orderId: string, @Body() dto: UpdateOrderStatusDto) {
    return this.adminService.updateOrderStatus(orderId, dto.status);
  }

  @Patch('orders/:id/shipping-status')
  @ApiOperation({
    summary: '배송 상태 변경 (관리자)',
    description: '배송 상태와 운송장 번호를 업데이트합니다.',
  })
  @ApiParam({ name: 'id', description: '주문 ID', example: 'ORD-20240101-00001' })
  @ApiResponse({ status: 200, description: '배송 상태 변경 성공' })
  async updateOrderShippingStatus(
    @Param('id') orderId: string,
    @Body() dto: UpdateOrderShippingStatusDto,
  ) {
    return this.adminService.updateOrderShippingStatus(
      orderId,
      dto.shippingStatus,
      dto.trackingNumber,
    );
  }

  @Patch('orders/:id/send-reminder')
  @ApiOperation({ summary: '결제 독촉 알림 발송 (관리자)' })
  @ApiParam({ name: 'id', description: '주문 ID', example: 'ORD-20240101-00001' })
  @ApiResponse({ status: 200, description: '알림 발송 성공' })
  async sendPaymentReminder(@Param('id') orderId: string) {
    return this.adminService.sendPaymentReminder(orderId);
  }

  @Get('users/:id')
  @ApiOperation({ summary: '사용자 상세 조회 (관리자)' })
  @ApiParam({ name: 'id', description: '사용자 ID' })
  @ApiResponse({ status: 200, description: '사용자 상세 정보' })
  async getUserDetail(@Param('id') userId: string) {
    return this.adminService.getUserDetail(userId);
  }

  @Patch('users/:id/status')
  @ApiOperation({
    summary: '사용자 상태 변경 (관리자)',
    description: '사용자 계정 활성/비활성 상태를 변경합니다.',
  })
  @ApiParam({ name: 'id', description: '사용자 ID' })
  @ApiResponse({ status: 200, description: '사용자 상태 변경 성공' })
  async updateUserStatus(@Param('id') userId: string, @Body() dto: UpdateUserStatusDto) {
    return this.adminService.updateUserStatus(userId, dto);
  }

  @Get('notification-templates')
  @ApiOperation({ summary: '알림 템플릿 목록 조회 (관리자)' })
  @ApiResponse({ status: 200, description: '알림 템플릿 목록' })
  async getNotificationTemplates() {
    return this.adminService.getNotificationTemplates();
  }

  @Patch('notification-templates/:id')
  @ApiOperation({ summary: '알림 템플릿 수정 (관리자)' })
  @ApiParam({ name: 'id', description: '알림 템플릿 ID' })
  @ApiResponse({ status: 200, description: '템플릿 수정 성공' })
  async updateNotificationTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateNotificationTemplateDto,
  ) {
    return this.adminService.updateNotificationTemplate(id, dto.template, dto.kakaoTemplateCode);
  }

  @Post('orders/bulk-notify')
  @ApiOperation({
    summary: '일괄 배송 알림 발송 (관리자)',
    description:
      'CSV 파일(Order ID, Tracking Number 컬럼)을 업로드하여 일괄 배송 알림을 발송합니다.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: '일괄 알림 발송 성공' })
  @ApiResponse({ status: 400, description: '잘못된 CSV 형식' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB max CSV
      fileFilter: (_req, file, callback) => {
        const allowedMimes = new Set([
          'text/csv',
          'application/csv',
          'application/vnd.ms-excel',
          'text/plain',
        ]);
        const hasAllowedExt = file.originalname.toLowerCase().endsWith('.csv');
        if (!hasAllowedExt || !allowedMimes.has(file.mimetype)) {
          return callback(new BadRequestException('Only CSV files are allowed'), false);
        }
        callback(null, true);
      },
    }),
  )
  async bulkNotifyShipping(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const csvContent = file.buffer.toString('utf-8');

    return new Promise((resolve, reject) => {
      Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const items = (results.data as Record<string, string>[]).map((row) => ({
            orderId: row['Order ID'] ?? row.orderId ?? row.order_id,
            trackingNumber: row['Tracking Number'] ?? row.trackingNumber ?? row.tracking_number,
          }));

          // Validate data
          const invalidItems = items.filter((item) => !item.orderId || !item.trackingNumber);
          if (invalidItems.length > 0) {
            reject(
              new BadRequestException(
                `Invalid CSV format. Missing Order ID or Tracking Number in ${invalidItems.length} rows`,
              ),
            );
            return;
          }

          this.adminService.sendBulkShippingNotifications(items).then(resolve).catch(reject);
        },
        error: (error: Error) => {
          reject(new BadRequestException(`Failed to parse CSV: ${error.message}`));
        },
      });
    });
  }

  @Get('audit-logs')
  @ApiOperation({
    summary: '감사 로그 조회 (관리자)',
    description: '관리자 작업 감사 로그를 조회합니다.',
  })
  @ApiQuery({ name: 'from', required: false, description: '시작일 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: false, description: '종료일 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'action', required: false, description: '액션 필터' })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호', example: '1' })
  @ApiQuery({ name: 'limit', required: false, description: '페이지 크기', example: '50' })
  @ApiResponse({ status: 200, description: '감사 로그 목록' })
  async getAuditLogs(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('action') action?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const { page: pageNum, limit: limitNum } = parsePagination(page, limit, { limit: 50 });

    return this.adminService.getAuditLogs(from, to, action, pageNum, limitNum);
  }

  /**
   * Real-time system monitoring dashboard data
   */
  @Get('monitoring')
  @ApiOperation({
    summary: '실시간 시스템 모니터링 (관리자)',
    description:
      '서버 메모리, 스트림 상태, Redis/DB 연결 상태 등 실시간 모니터링 데이터를 반환합니다.',
  })
  @ApiResponse({ status: 200, description: '시스템 모니터링 데이터 (서버/스트림/Redis/DB 상태)' })
  async getMonitoring() {
    const redis = this.redisService.getClient();

    // 1. Active streams & viewer counts
    const activeStreams = await this.prismaService.liveStream.findMany({
      where: { status: 'LIVE' },
      select: { id: true, streamKey: true, title: true, startedAt: true, peakViewers: true },
    });

    const streamStats = await Promise.all(
      activeStreams.map(async (stream) => {
        const viewers = await redis.get(`stream:${stream.streamKey}:viewers`);
        return {
          streamId: stream.id,
          streamKey: stream.streamKey,
          title: stream.title,
          startedAt: stream.startedAt,
          viewerCount: parseInt(viewers || '0', 10),
          peakViewers: stream.peakViewers,
        };
      }),
    );

    const totalViewers = streamStats.reduce((sum, s) => sum + s.viewerCount, 0);

    // 2. Redis health & stats
    let redisStatus = 'down';
    let redisConnections = 0;
    let redisMemory = '0';
    try {
      await redis.ping();
      redisStatus = 'up';
      const info = await redis.info('clients');
      const connMatch = info.match(/connected_clients:(\d+)/);
      redisConnections = connMatch ? parseInt(connMatch[1], 10) : 0;
      const memInfo = await redis.info('memory');
      const memMatch = memInfo.match(/used_memory_human:(.+)/);
      redisMemory = memMatch ? memMatch[1].trim() : '0';
    } catch {
      redisStatus = 'down';
    }

    // 3. DB connection pool (approximate from active query)
    let dbStatus = 'down';
    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      dbStatus = 'up';
    } catch {
      dbStatus = 'down';
    }

    // 4. Process metrics + event loop lag
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    const eventLoopLagMs = await new Promise<number>((resolve) => {
      const start = performance.now();
      setTimeout(() => resolve(Math.round(performance.now() - start)), 0);
    });

    // 5. SRS active streams via API (best-effort)
    // SSRF guard: only allow requests to known internal hosts
    let srsStreams = 0;
    try {
      const srsHost = process.env.SRS_API_URL || 'http://localhost:1985';
      const parsedSrsUrl = new URL(srsHost);
      const allowedSrsHosts = new Set(['localhost', '127.0.0.1', 'srs', '::1']);
      if (allowedSrsHosts.has(parsedSrsUrl.hostname)) {
        const safeUrl = `${parsedSrsUrl.origin}/api/streams/`;
        const srsRes = await fetch(safeUrl, { signal: AbortSignal.timeout(3000) });
        if (srsRes.ok) {
          const data = (await srsRes.json()) as { streams?: unknown[] };
          srsStreams = data.streams?.length ?? 0;
        }
      }
    } catch {
      // SRS unreachable or invalid URL — skip
    }

    return {
      timestamp: new Date().toISOString(),
      server: {
        uptime: Math.floor(uptime),
        memoryMB: Math.round(memUsage.rss / 1024 / 1024),
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        eventLoopLagMs,
      },
      streams: {
        activeCount: activeStreams.length,
        totalViewers,
        srsActiveStreams: srsStreams,
        details: streamStats,
      },
      redis: {
        status: redisStatus,
        connections: redisConnections,
        memory: redisMemory,
      },
      database: {
        status: dbStatus,
      },
    };
  }
}
