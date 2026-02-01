import { Injectable, Inject, forwardRef, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import {
  GetUsersQueryDto,
  UserListResponseDto,
  UserListItemDto,
  DashboardStatsDto,
  StatItemDto,
  RecentActivitiesDto,
  ActivityLogDto,
  UpdateNoticeDto,
  NoticeDto,
  GetOrdersQueryDto,
  OrderListResponseDto,
  OrderListItemDto,
  UserDetailDto,
  UpdateUserStatusDto,
  ShippingAddressDto,
  UserStatisticsDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private encryptionService: EncryptionService,
    @Inject(forwardRef(() => 'WEBSOCKET_GATEWAY'))
    private websocketGateway: any,
  ) {}

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

  async getOrderList(query: GetOrdersQueryDto): Promise<OrderListResponseDto> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      dateFrom,
      dateTo,
      orderStatus,
      paymentStatus,
      shippingStatus,
      minAmount,
      maxAmount,
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause for filters
    const where: any = {};

    // Search filter (order ID, user email, depositor name, instagram ID)
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { userEmail: { contains: search, mode: 'insensitive' } },
        { depositorName: { contains: search, mode: 'insensitive' } },
        { instagramId: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Date range filter (for createdAt)
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

    // Order status filter
    if (orderStatus && orderStatus.length > 0) {
      where.status = { in: orderStatus };
    }

    // Payment status filter
    if (paymentStatus && paymentStatus.length > 0) {
      where.paymentStatus = { in: paymentStatus };
    }

    // Shipping status filter
    if (shippingStatus && shippingStatus.length > 0) {
      where.shippingStatus = { in: shippingStatus };
    }

    // Amount range filter
    if (minAmount !== undefined || maxAmount !== undefined) {
      where.total = {};
      if (minAmount !== undefined) {
        where.total.gte = minAmount;
      }
      if (maxAmount !== undefined) {
        where.total.lte = maxAmount;
      }
    }

    // Get total count with filters
    const total = await this.prisma.order.count({ where });

    // Get paginated orders with sorting and filters
    const orders = await this.prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        orderItems: {
          select: {
            id: true,
          },
        },
      },
    });

    // Map orders to DTOs
    const orderDtos: OrderListItemDto[] = orders.map((order) => ({
      id: order.id,
      userId: order.userId,
      userEmail: order.userEmail,
      depositorName: order.depositorName,
      instagramId: order.instagramId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      shippingStatus: order.shippingStatus,
      subtotal: Number(order.subtotal),
      shippingFee: Number(order.shippingFee),
      total: Number(order.total),
      itemCount: order.orderItems.length,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      orders: orderDtos,
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

  /**
   * Get current system configuration (notice settings)
   */
  async getSystemConfig(): Promise<NoticeDto> {
    // Get or create the single system config entry
    let config = await this.prisma.systemConfig.findFirst({
      where: { id: 'system' },
    });

    // If no config exists, create one with defaults
    if (!config) {
      config = await this.prisma.systemConfig.create({
        data: {
          id: 'system',
          noticeText: null,
          noticeFontSize: 14,
          noticeFontFamily: 'Pretendard',
        },
      });
    }

    return {
      text: config.noticeText,
      fontSize: config.noticeFontSize,
      fontFamily: config.noticeFontFamily,
    };
  }

  /**
   * Update system configuration (notice settings)
   */
  async updateSystemConfig(dto: UpdateNoticeDto): Promise<NoticeDto> {
    // Prepare update data
    const updateData: any = {};
    if (dto.noticeText !== undefined) {
      updateData.noticeText = dto.noticeText;
    }
    if (dto.noticeFontSize !== undefined) {
      updateData.noticeFontSize = dto.noticeFontSize;
    }
    if (dto.noticeFontFamily !== undefined) {
      updateData.noticeFontFamily = dto.noticeFontFamily;
    }

    // Update or create the system config
    const config = await this.prisma.systemConfig.upsert({
      where: { id: 'system' },
      update: updateData,
      create: {
        id: 'system',
        noticeText: dto.noticeText ?? null,
        noticeFontSize: dto.noticeFontSize ?? 14,
        noticeFontFamily: dto.noticeFontFamily ?? 'Pretendard',
      },
    });

    const result = {
      text: config.noticeText,
      fontSize: config.noticeFontSize,
      fontFamily: config.noticeFontFamily,
    };

    // Broadcast notice update via WebSocket
    if (this.websocketGateway && this.websocketGateway.server) {
      this.websocketGateway.server.emit('notice:updated', result);
    }

    return result;
  }

  /**
   * Confirm order payment (admin only)
   * Updates payment status from PENDING to CONFIRMED
   */
  async confirmOrderPayment(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Find order with user info
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            }
          }
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // 2. Check if already confirmed
      if (order.paymentStatus === 'CONFIRMED') {
        throw new BadRequestException('Payment already confirmed');
      }

      // 3. Update order status
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'CONFIRMED',
          status: 'PAYMENT_CONFIRMED',
          paidAt: new Date(),
        },
      });

      // 4. Emit domain event for notifications
      this.eventEmitter.emit('order:payment:confirmed', {
        orderId: updatedOrder.id,
        userId: order.userId,
        userEmail: order.user.email,
        total: order.total,
      });

      return {
        success: true,
        data: {
          orderId: updatedOrder.id,
          paymentStatus: updatedOrder.paymentStatus,
          status: updatedOrder.status,
          paidAt: updatedOrder.paidAt,
        },
      };
    });
  }

  /**
   * Get user detail with decrypted shipping address and statistics
   */
  async getUserDetail(userId: string): Promise<UserDetailDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        instagramId: true,
        depositorName: true,
        shippingAddress: true,
        createdAt: true,
        lastLoginAt: true,
        status: true,
        role: true,
        suspendedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Decrypt shipping address if exists
    let shippingAddress: ShippingAddressDto | null = null;
    if (user.shippingAddress) {
      try {
        shippingAddress = this.encryptionService.decryptAddress(user.shippingAddress as any);
      } catch (error) {
        console.error('Failed to decrypt shipping address:', error);
        // Return null if decryption fails
        shippingAddress = null;
      }
    }

    // Calculate user statistics (Epic 8 dependency - placeholder for now)
    const statistics: UserStatisticsDto = {
      totalOrders: 0,
      totalPurchaseAmount: 0,
      averageOrderValue: 0,
      orderFrequency: 0,
    };

    // TODO: Epic 8 - Calculate real statistics from orders
    // const orders = await this.prisma.order.findMany({
    //   where: { userId },
    //   select: { total: true, createdAt: true }
    // });
    // statistics.totalOrders = orders.length;
    // statistics.totalPurchaseAmount = orders.reduce((sum, o) => sum + Number(o.total), 0);
    // statistics.averageOrderValue = statistics.totalOrders > 0
    //   ? statistics.totalPurchaseAmount / statistics.totalOrders
    //   : 0;
    // const monthsSinceRegistration = differenceInMonths(new Date(), user.createdAt);
    // statistics.orderFrequency = monthsSinceRegistration > 0
    //   ? statistics.totalOrders / monthsSinceRegistration
    //   : 0;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      instagramId: user.instagramId,
      depositorName: user.depositorName,
      shippingAddress,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      status: user.status,
      role: user.role,
      suspendedAt: user.suspendedAt,
      statistics,
    };
  }

  /**
   * Update user status (Active/Inactive/Suspended)
   */
  async updateUserStatus(userId: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: any = {
      status: dto.status,
    };

    // If setting to SUSPENDED, set suspendedAt timestamp
    if (dto.status === 'SUSPENDED') {
      updateData.suspendedAt = new Date();
      if (dto.suspensionReason) {
        updateData.suspensionReason = dto.suspensionReason;
      }
    } else {
      // Clear suspension fields if changing from SUSPENDED
      updateData.suspendedAt = null;
      updateData.suspensionReason = null;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // TODO: Epic 12 - Emit audit log event
    // this.eventEmitter.emit('admin:user:status-updated', {
    //   userId,
    //   oldStatus: user.status,
    //   newStatus: dto.status,
    //   adminId: currentAdminId,
    // });

    return {
      success: true,
      data: {
        id: updatedUser.id,
        status: updatedUser.status,
        suspendedAt: updatedUser.suspendedAt,
      },
    };
  }
}
