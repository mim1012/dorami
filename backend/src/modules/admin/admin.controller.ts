import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Body,
  Query,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminService } from './admin.service';
import {
  GetUsersQueryDto,
  UpdateNoticeDto,
  GetOrdersQueryDto,
  UpdateUserStatusDto,
} from './dto/admin.dto';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { parsePagination } from '../../common/utils/pagination.util';
import * as Papa from 'papaparse';

@Controller('admin')
@AdminOnly()
export class AdminController {
  constructor(private adminService: AdminService) {}

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
  async updateShippingMessages(@Body() body: Record<string, string>) {
    return this.adminService.updateShippingMessages(body);
  }

  @Get('orders/:id')
  async getOrderDetail(@Param('id') orderId: string) {
    return this.adminService.getOrderDetail(orderId);
  }

  @Patch('orders/:id/confirm-payment')
  async confirmPayment(@Param('id') orderId: string) {
    return this.adminService.confirmOrderPayment(orderId);
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
  async updateNotificationTemplate(@Param('id') id: string, @Body() dto: { template: string }) {
    return this.adminService.updateNotificationTemplate(id, dto.template);
  }

  @Get('settlement')
  async getSettlementReport(@Query('from') from: string, @Query('to') to: string) {
    return this.adminService.getSettlementReport(from, to);
  }

  @Post('orders/bulk-notify')
  @UseInterceptors(FileInterceptor('file'))
  async bulkNotifyShipping(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!file.originalname.endsWith('.csv')) {
      throw new BadRequestException('File must be a CSV');
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
}
