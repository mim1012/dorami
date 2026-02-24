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
  UpdateNotificationTemplateDto,
} from './dto/admin.dto';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { parsePagination } from '../../common/utils/pagination.util';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as Papa from 'papaparse';

@Controller('admin')
@AdminOnly()
export class AdminController {
  constructor(
    private adminService: AdminService,
    private redisService: RedisService,
    private prismaService: PrismaService,
  ) {}

  @Get('users')
  async getUserList(@Query() query: GetUsersQueryDto) {
    return this.adminService.getUserList(query);
  }

  @Get('orders')
  async getOrderList(@Query() query: GetOrdersQueryDto) {
    return this.adminService.getOrderList(query);
  }

  @Get('dashboard/stats')
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('activities/recent')
  async getRecentActivities(@Query('limit') limit?: number) {
    return this.adminService.getRecentActivities(limit ? parseInt(limit.toString(), 10) : 10);
  }

  @Get('config/settings')
  async getSystemSettings() {
    return this.adminService.getSystemSettings();
  }

  @Put('config/settings')
  async updateSystemSettings(@Body() dto: UpdateSystemSettingsDto) {
    return this.adminService.updateSystemSettings(dto);
  }

  @Get('config')
  async getSystemConfig() {
    return this.adminService.getSystemConfig();
  }

  @Put('config')
  async updateSystemConfig(@Body() dto: UpdateNoticeDto) {
    return this.adminService.updateSystemConfig(dto);
  }

  @Get('config/shipping-messages')
  async getShippingMessages() {
    return this.adminService.getShippingMessages();
  }

  @Put('config/shipping-messages')
  async updateShippingMessages(@Body() dto: UpdateShippingMessagesDto) {
    return this.adminService.updateShippingMessages(dto as unknown as Record<string, string>);
  }

  @Get('orders/export')
  async exportOrders(@Query() query: GetOrdersQueryDto, @Res() res: Response) {
    try {
      const csv = await this.adminService.exportOrdersCsv(query);
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=orders_${date}.csv`);
      // Add BOM for Excel UTF-8 compatibility
      res.send('\uFEFF' + csv);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'CSV export failed';
      res.status(500).json({ success: false, message });
    }
  }

  @Get('orders/:id')
  async getOrderDetail(@Param('id') orderId: string) {
    return this.adminService.getOrderDetail(orderId);
  }

  @Patch('orders/:id/confirm-payment')
  async confirmPayment(@Param('id') orderId: string) {
    return this.adminService.confirmOrderPayment(orderId);
  }

  @Patch('orders/:id/status')
  async updateOrderStatus(@Param('id') orderId: string, @Body() dto: UpdateOrderStatusDto) {
    return this.adminService.updateOrderStatus(orderId, dto.status);
  }

  @Patch('orders/:id/shipping-status')
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
  async sendPaymentReminder(@Param('id') orderId: string) {
    return this.adminService.sendPaymentReminder(orderId);
  }

  @Get('users/:id')
  async getUserDetail(@Param('id') userId: string) {
    return this.adminService.getUserDetail(userId);
  }

  @Patch('users/:id/status')
  async updateUserStatus(@Param('id') userId: string, @Body() dto: UpdateUserStatusDto) {
    return this.adminService.updateUserStatus(userId, dto);
  }

  @Get('notification-templates')
  async getNotificationTemplates() {
    return this.adminService.getNotificationTemplates();
  }

  @Patch('notification-templates/:id')
  async updateNotificationTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateNotificationTemplateDto,
  ) {
    return this.adminService.updateNotificationTemplate(id, dto.template, dto.kakaoTemplateCode);
  }

  @Get('settlement')
  async getSettlementReport(@Query('from') from: string, @Query('to') to: string) {
    return this.adminService.getSettlementReport(from, to);
  }

  @Post('orders/bulk-notify')
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
          const items = results.data.map((row: any) => ({
            orderId: row['Order ID'] || row.orderId || row.order_id,
            trackingNumber: row['Tracking Number'] || row.trackingNumber || row.tracking_number,
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
        error: (error) => {
          reject(new BadRequestException(`Failed to parse CSV: ${error.message}`));
        },
      });
    });
  }

  @Get('audit-logs')
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
