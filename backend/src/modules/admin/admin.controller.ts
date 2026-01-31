import { Controller, Get, Put, Patch, Body, Query, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { GetUsersQueryDto, UpdateNoticeDto, GetOrdersQueryDto } from './dto/admin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
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

  @Patch('orders/:id/confirm-payment')
  async confirmPayment(@Param('id') orderId: string) {
    return this.adminService.confirmOrderPayment(orderId);
  }
}
