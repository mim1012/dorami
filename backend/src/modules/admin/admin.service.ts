import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  GetUsersQueryDto,
  UserListResponseDto,
  UserListItemDto,
  DashboardStatsDto,
  StatItemDto,
  RecentActivitiesDto,
  ActivityLogDto
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getUserList(query: GetUsersQueryDto): Promise<UserListResponseDto> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      dateFrom,
      dateTo,
      minOrders,
      maxOrders,
      minAmount,
      maxAmount,
      status,
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause for filters
    const where: any = {};

    // Search filter (name, email, instagramId)
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { instagramId: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999); // End of day
        where.createdAt.lte = endDate;
      }
    }

    // Status filter
    if (status && status.length > 0) {
      where.status = { in: status };
    }

    // Note: Order count and purchase amount filters will be implemented in Epic 8
    // For now, these filters are ignored as we don't have Orders table populated

    // Get total count with filters
    const total = await this.prisma.user.count({ where });

    // Get paginated users with sorting and filters
    const users = await this.prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        id: true,
        email: true,
        name: true,
        instagramId: true,
        createdAt: true,
        lastLoginAt: true,
        status: true,
        role: true,
      },
    });

    // Map users to DTOs with order stats (placeholder for now, will be implemented in Epic 8)
    const userDtos: UserListItemDto[] = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      instagramId: user.instagramId,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      status: user.status,
      role: user.role,
      totalOrders: 0, // Epic 8 dependency - will aggregate from Orders table
      totalPurchaseAmount: 0, // Epic 8 dependency - will sum order totals
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      users: userDtos,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getDashboardStats(): Promise<DashboardStatsDto> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    // Revenue Stats
    const todayRevenue = await this.prisma.order.aggregate({
      where: {
        createdAt: { gte: todayStart },
        paymentStatus: 'CONFIRMED',
      },
      _sum: { total: true },
    });

    const yesterdayRevenue = await this.prisma.order.aggregate({
      where: {
        createdAt: { gte: yesterdayStart, lt: todayStart },
        paymentStatus: 'CONFIRMED',
      },
      _sum: { total: true },
    });

    const revenueToday = Number(todayRevenue._sum.total || 0);
    const revenueYesterday = Number(yesterdayRevenue._sum.total || 0);
    const revenueTrend = this.calculateTrend(revenueToday, revenueYesterday);

    // Orders Stats
    const todayOrders = await this.prisma.order.count({
      where: { createdAt: { gte: todayStart } },
    });

    const yesterdayOrders = await this.prisma.order.count({
      where: { createdAt: { gte: yesterdayStart, lt: todayStart } },
    });

    const ordersTrend = this.calculateTrend(todayOrders, yesterdayOrders);

    // Chat Messages Stats
    const todayMessages = await this.prisma.chatMessage.count({
      where: {
        timestamp: { gte: todayStart },
        isDeleted: false,
      },
    });

    const yesterdayMessages = await this.prisma.chatMessage.count({
      where: {
        timestamp: { gte: yesterdayStart, lt: todayStart },
        isDeleted: false,
      },
    });

    const messagesTrend = this.calculateTrend(todayMessages, yesterdayMessages);

    // Active Viewers - Get current live stream viewer count
    // For now, return 0 since WebSocket tracking isn't implemented
    const viewerCount = 0;
    const viewersTrend = '+0%';

    return {
      revenue: {
        value: revenueToday,
        formatted: `$${this.formatNumber(revenueToday)}`,
        trend: revenueTrend.formatted,
        trendUp: revenueTrend.isUp,
      },
      viewers: {
        value: viewerCount,
        formatted: this.formatNumber(viewerCount),
        trend: viewersTrend,
        trendUp: true,
      },
      orders: {
        value: todayOrders,
        formatted: this.formatNumber(todayOrders),
        trend: ordersTrend.formatted,
        trendUp: ordersTrend.isUp,
      },
      messages: {
        value: todayMessages,
        formatted: this.formatNumber(todayMessages),
        trend: messagesTrend.formatted,
        trendUp: messagesTrend.isUp,
      },
    };
  }

  async getRecentActivities(limit: number = 10): Promise<RecentActivitiesDto> {
    // Get recent audit logs
    const auditLogs = await this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const activities: ActivityLogDto[] = auditLogs.map((log) => ({
      id: log.id,
      type: log.action,
      message: this.formatActivityMessage(log.action, log.entity),
      timestamp: log.createdAt,
      metadata: log.changes as Record<string, any>,
    }));

    return {
      activities,
      total: activities.length,
    };
  }

  private calculateTrend(today: number, yesterday: number): { formatted: string; isUp: boolean } {
    if (yesterday === 0) {
      return { formatted: '+0%', isUp: true };
    }

    const percentChange = ((today - yesterday) / yesterday) * 100;
    const sign = percentChange >= 0 ? '+' : '';
    const formatted = `${sign}${percentChange.toFixed(1)}%`;

    return {
      formatted,
      isUp: percentChange >= 0,
    };
  }

  private formatNumber(num: number): string {
    return num.toLocaleString('en-US');
  }

  private formatActivityMessage(action: string, entity: string): string {
    const actionMap: Record<string, string> = {
      CREATE: 'created',
      UPDATE: 'updated',
      DELETE: 'deleted',
    };

    const verb = actionMap[action] || action.toLowerCase();
    return `${entity} ${verb}`;
  }
}
