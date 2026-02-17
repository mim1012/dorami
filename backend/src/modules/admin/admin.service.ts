import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  GetUsersQueryDto,
  UserListResponseDto,
  UserListItemDto,
  DashboardStatsDto,
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
  UpdateSystemSettingsDto,
} from './dto/admin.dto';

import { UserStatus, OrderStatus, PaymentStatus, ShippingStatus } from '@prisma/client';

// Type definitions for admin service
interface WhereClause {
  OR?: Record<string, { contains: string; mode: string }>[];
  createdAt?: { gte?: Date; lte?: Date };
  status?: { in: UserStatus[] };
}

interface OrderWhereClause {
  OR?: Record<string, { contains: string; mode: string }>[];
  createdAt?: { gte?: Date; lte?: Date };
  status?: { in: OrderStatus[] };
  paymentStatus?: { in: PaymentStatus[] };
  shippingStatus?: { in: ShippingStatus[] };
  total?: { gte?: number; lte?: number };
}

interface SystemConfigUpdateData {
  noticeText?: string | null;
  noticeFontSize?: number;
  noticeFontFamily?: string;
}

interface UserStatusUpdateData {
  status: UserStatus;
  suspendedAt?: Date | null;
  suspensionReason?: string | null;
}

interface AuditLogWhereClause {
  createdAt?: { gte?: Date; lte?: Date };
  action?: string;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private encryptionService: EncryptionService,
    private notificationsService: NotificationsService,
    private redisService: RedisService,
  ) {}

  async getUserList(query: GetUsersQueryDto): Promise<UserListResponseDto> {
    const { page, limit, sortBy, sortOrder, search, dateFrom, dateTo, status } = query;

    const skip = (page - 1) * limit;

    // Build where clause for filters
    const where: WhereClause = {};

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
      where.status = { in: status as UserStatus[] };
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
      page,
      limit,
      sortBy,
      sortOrder,
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
    const where: OrderWhereClause = {};

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
        const startDate = new Date(dateFrom);
        startDate.setHours(0, 0, 0, 0); // Start of day
        where.createdAt.gte = startDate;
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999); // End of day
        where.createdAt.lte = endDate;
      }
    }

    // Order status filter
    if (orderStatus && orderStatus.length > 0) {
      where.status = { in: orderStatus as OrderStatus[] };
    }

    // Payment status filter
    if (paymentStatus && paymentStatus.length > 0) {
      where.paymentStatus = { in: paymentStatus as PaymentStatus[] };
    }

    // Shipping status filter
    if (shippingStatus && shippingStatus.length > 0) {
      where.shippingStatus = { in: shippingStatus as ShippingStatus[] };
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

  async exportOrdersCsv(query: GetOrdersQueryDto): Promise<string> {
    // Reuse the same filter logic from getOrderList but without pagination
    const {
      sortBy,
      sortOrder,
      search,
      dateFrom,
      dateTo,
      orderStatus,
      paymentStatus,
      shippingStatus,
      minAmount,
      maxAmount,
    } = query;

    const where: OrderWhereClause = {};

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { userEmail: { contains: search, mode: 'insensitive' } },
        { depositorName: { contains: search, mode: 'insensitive' } },
        { instagramId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    if (orderStatus && orderStatus.length > 0) {
      where.status = { in: orderStatus as OrderStatus[] };
    }
    if (paymentStatus && paymentStatus.length > 0) {
      where.paymentStatus = { in: paymentStatus as PaymentStatus[] };
    }
    if (shippingStatus && shippingStatus.length > 0) {
      where.shippingStatus = { in: shippingStatus as ShippingStatus[] };
    }
    if (minAmount !== undefined || maxAmount !== undefined) {
      where.total = {};
      if (minAmount !== undefined) {
        where.total.gte = minAmount;
      }
      if (maxAmount !== undefined) {
        where.total.lte = maxAmount;
      }
    }

    const MAX_EXPORT_ROWS = 10000;

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      take: MAX_EXPORT_ROWS,
    });

    // Log warning if max rows reached
    if (orders.length === MAX_EXPORT_ROWS) {
      this.logger.warn(
        `CSV export reached maximum row limit (${MAX_EXPORT_ROWS}). Results may be truncated.`,
        'ExportOrdersCsv',
      );
    }

    const Papa = await import('papaparse');

    const csvData = orders.map((order) => ({
      주문번호: order.id,
      고객이메일: order.userEmail,
      입금자명: order.depositorName,
      인스타그램ID: order.instagramId,
      주문상태: order.status,
      결제상태: order.paymentStatus,
      배송상태: order.shippingStatus,
      소계: Number(order.subtotal),
      배송비: Number(order.shippingFee),
      합계: Number(order.total),
      주문일: order.createdAt.toISOString(),
      결제일: order.paidAt ? order.paidAt.toISOString() : '',
    }));

    return Papa.unparse(csvData);
  }

  async getDashboardStats(): Promise<DashboardStatsDto> {
    const now = new Date();

    // Epic 12 Story 12.1: Last 7 days vs previous 7 days
    const last7DaysStart = new Date(now);
    last7DaysStart.setDate(last7DaysStart.getDate() - 7);
    last7DaysStart.setHours(0, 0, 0, 0);

    const previous7DaysStart = new Date(last7DaysStart);
    previous7DaysStart.setDate(previous7DaysStart.getDate() - 7);

    // 1. Total Orders (last 7 days vs previous 7 days)
    const last7DaysOrders = await this.prisma.order.count({
      where: { createdAt: { gte: last7DaysStart } },
    });

    const previous7DaysOrders = await this.prisma.order.count({
      where: { createdAt: { gte: previous7DaysStart, lt: last7DaysStart } },
    });

    const ordersTrend = this.calculateTrend(last7DaysOrders, previous7DaysOrders);

    // 2. Total Revenue (last 7 days)
    const last7DaysRevenue = await this.prisma.order.aggregate({
      where: {
        createdAt: { gte: last7DaysStart },
        paymentStatus: 'CONFIRMED',
      },
      _sum: { total: true },
    });

    const previous7DaysRevenue = await this.prisma.order.aggregate({
      where: {
        createdAt: { gte: previous7DaysStart, lt: last7DaysStart },
        paymentStatus: 'CONFIRMED',
      },
      _sum: { total: true },
    });

    const revenueLast7Days = Number(last7DaysRevenue._sum.total || 0);
    const revenuePrevious7Days = Number(previous7DaysRevenue._sum.total || 0);
    const revenueTrend = this.calculateTrend(revenueLast7Days, revenuePrevious7Days);

    // 3. Pending Payments count
    const pendingPayments = await this.prisma.order.count({
      where: { paymentStatus: 'PENDING' },
    });

    // 4. Active Live Streams count
    const activeLiveStreams = await this.prisma.liveStream.count({
      where: { status: 'LIVE' },
    });

    // 5. Top 5 Selling Products
    const topProducts = await this.prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      where: { productId: { not: null } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });

    // Chat Messages Stats (kept for compatibility)
    const last7DaysMessages = await this.prisma.chatMessage.count({
      where: {
        timestamp: { gte: last7DaysStart },
        isDeleted: false,
      },
    });

    const previous7DaysMessages = await this.prisma.chatMessage.count({
      where: {
        timestamp: { gte: previous7DaysStart, lt: last7DaysStart },
        isDeleted: false,
      },
    });

    const messagesTrend = this.calculateTrend(last7DaysMessages, previous7DaysMessages);

    // 6. Daily revenue aggregation (last 7 days)
    const dailyRevenueMap = new Map<
      string,
      { date: string; revenue: number; orderCount: number }
    >();

    const last7DaysConfirmedOrders = await this.prisma.order.findMany({
      where: {
        paymentStatus: 'CONFIRMED',
        paidAt: { gte: last7DaysStart },
      },
      select: { paidAt: true, total: true },
      orderBy: { paidAt: 'asc' },
    });

    last7DaysConfirmedOrders.forEach((order) => {
      const dateKey = order.paidAt.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!dailyRevenueMap.has(dateKey)) {
        dailyRevenueMap.set(dateKey, { date: dateKey, revenue: 0, orderCount: 0 });
      }

      const day = dailyRevenueMap.get(dateKey);
      day.revenue += Number(order.total);
      day.orderCount += 1;
    });

    const dailyRevenue = Array.from(dailyRevenueMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    return {
      revenue: {
        value: revenueLast7Days,
        formatted: `$${this.formatNumber(revenueLast7Days)}`,
        trend: revenueTrend.formatted,
        trendUp: revenueTrend.isUp,
      },
      orders: {
        value: last7DaysOrders,
        formatted: this.formatNumber(last7DaysOrders),
        trend: ordersTrend.formatted,
        trendUp: ordersTrend.isUp,
      },
      pendingPayments: {
        value: pendingPayments,
        formatted: this.formatNumber(pendingPayments),
      },
      activeLiveStreams: {
        value: activeLiveStreams,
        formatted: this.formatNumber(activeLiveStreams),
      },
      topProducts: topProducts.map((p) => ({
        productId: p.productId,
        productName: p.productName,
        totalSold: p._sum.quantity || 0,
      })),
      messages: {
        value: last7DaysMessages,
        formatted: this.formatNumber(last7DaysMessages),
        trend: messagesTrend.formatted,
        trendUp: messagesTrend.isUp,
      },
      dailyRevenue,
      // Legacy field for backward compatibility
      viewers: {
        value: 0,
        formatted: '0',
        trend: '+0%',
        trendUp: true,
      },
    };
  }

  async getRecentActivities(limit = 10): Promise<RecentActivitiesDto> {
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
   * Get system settings (cart timer, bank info, shipping fee, notifications)
   */
  async getSystemSettings() {
    const config = await this.prisma.systemConfig.upsert({
      where: { id: 'system' },
      update: {},
      create: { id: 'system' },
    });
    return {
      defaultCartTimerMinutes: config.defaultCartTimerMinutes,
      defaultShippingFee: parseFloat(config.defaultShippingFee.toString()),
      bankName: config.bankName,
      bankAccountNumber: config.bankAccountNumber,
      bankAccountHolder: config.bankAccountHolder,
      emailNotificationsEnabled: config.emailNotificationsEnabled,
    };
  }

  /**
   * Update system settings (cart timer, bank info, shipping fee, notifications)
   */
  async updateSystemSettings(dto: UpdateSystemSettingsDto) {
    const updateData: Record<string, any> = {};
    if (dto.defaultCartTimerMinutes !== undefined) {
      updateData.defaultCartTimerMinutes = dto.defaultCartTimerMinutes;
    }
    if (dto.defaultShippingFee !== undefined) {
      updateData.defaultShippingFee = dto.defaultShippingFee;
    }
    if (dto.bankName !== undefined) {
      updateData.bankName = dto.bankName;
    }
    if (dto.bankAccountNumber !== undefined) {
      updateData.bankAccountNumber = dto.bankAccountNumber;
    }
    if (dto.bankAccountHolder !== undefined) {
      updateData.bankAccountHolder = dto.bankAccountHolder;
    }
    if (dto.emailNotificationsEnabled !== undefined) {
      updateData.emailNotificationsEnabled = dto.emailNotificationsEnabled;
    }

    const config = await this.prisma.systemConfig.upsert({
      where: { id: 'system' },
      update: updateData,
      create: {
        id: 'system',
        ...updateData,
      },
    });

    return {
      defaultCartTimerMinutes: config.defaultCartTimerMinutes,
      defaultShippingFee: parseFloat(config.defaultShippingFee.toString()),
      bankName: config.bankName,
      bankAccountNumber: config.bankAccountNumber,
      bankAccountHolder: config.bankAccountHolder,
      emailNotificationsEnabled: config.emailNotificationsEnabled,
    };
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
    const updateData: SystemConfigUpdateData = {};
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

    // Broadcast notice update via EventEmitter (handled by AdminNotificationHandler)
    this.eventEmitter.emit('admin:notice:updated', result);

    return result;
  }

  /**
   * Get shipping message templates
   */
  async getShippingMessages() {
    let config = await this.prisma.systemConfig.findFirst({
      where: { id: 'system' },
    });

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

    const defaultMessages = {
      preparing: '{customerName}님, 주문번호 {orderId}의 상품을 준비 중입니다.',
      shipped:
        '{customerName}님, 주문번호 {orderId}의 상품이 발송되었습니다. 운송장번호: {trackingNumber}',
      inTransit:
        '{customerName}님, 주문번호 {orderId}의 상품이 배송 중입니다. 운송장번호: {trackingNumber}',
      delivered: '{customerName}님, 주문번호 {orderId}의 상품이 배송 완료되었습니다.',
    };

    return (config.shippingMessages as Record<string, string>) || defaultMessages;
  }

  /**
   * Update shipping message templates
   */
  async updateShippingMessages(messages: Record<string, string>) {
    const config = await this.prisma.systemConfig.upsert({
      where: { id: 'system' },
      update: { shippingMessages: messages },
      create: {
        id: 'system',
        noticeText: null,
        noticeFontSize: 14,
        noticeFontFamily: 'Pretendard',
        shippingMessages: messages,
      },
    });

    return config.shippingMessages as Record<string, string>;
  }

  /**
   * Epic 8 Story 8.4: Get order detail (admin only)
   */
  async getOrderDetail(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            Product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            instagramId: true,
            depositorName: true,
            shippingAddress: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Decrypt shipping address
    let shippingAddress: ShippingAddressDto | null = null;
    if (order.user.shippingAddress) {
      try {
        shippingAddress = this.encryptionService.decryptAddress(
          order.user.shippingAddress as string,
        );
      } catch (error) {
        this.logger.error(
          'Failed to decrypt shipping address',
          error instanceof Error ? error.stack : String(error),
        );
        shippingAddress = null;
      }
    }

    return {
      id: order.id,
      userId: order.userId,
      userEmail: order.userEmail,
      depositorName: order.depositorName,
      instagramId: order.instagramId,
      shippingAddress,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      shippingStatus: order.shippingStatus,
      subtotal: Number(order.subtotal),
      shippingFee: Number(order.shippingFee),
      total: Number(order.total),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      items: order.orderItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productImage: item.Product?.imageUrl,
        quantity: item.quantity,
        price: Number(item.price),
        shippingFee: Number(item.shippingFee),
        color: item.color,
        size: item.size,
      })),
      customer: {
        id: order.user.id,
        email: order.user.email,
        name: order.user.name,
        instagramId: order.user.instagramId,
        depositorName: order.user.depositorName,
      },
    };
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
            },
          },
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
   * Update order status (admin only)
   */
  async updateOrderStatus(orderId: string, status: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === 'CANCELLED') {
      throw new BadRequestException('취소된 주문의 상태는 변경할 수 없습니다');
    }

    const data: any = { status };

    // Sync related fields based on status
    if (status === 'SHIPPED') {
      data.shippingStatus = 'SHIPPED';
      data.shippedAt = order.shippedAt || new Date();
    } else if (status === 'DELIVERED') {
      data.shippingStatus = 'DELIVERED';
      data.deliveredAt = order.deliveredAt || new Date();
    } else if (status === 'PAYMENT_CONFIRMED') {
      data.paymentStatus = 'CONFIRMED';
      data.paidAt = order.paidAt || new Date();
    } else if (status === 'CANCELLED') {
      data.paymentStatus = 'FAILED';

      // Restore stock for each order item
      for (const item of order.orderItems) {
        if (item.productId) {
          await this.prisma.product.update({
            where: { id: item.productId },
            data: {
              quantity: { increment: item.quantity },
              status: 'AVAILABLE',
            },
          });
        }
      }
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data,
    });

    // Emit cancellation event for point refund + notifications
    if (status === 'CANCELLED') {
      this.eventEmitter.emit('order:cancelled', { orderId });
    }

    return {
      success: true,
      data: {
        orderId: updated.id,
        status: updated.status,
        paymentStatus: updated.paymentStatus,
        shippingStatus: updated.shippingStatus,
      },
    };
  }

  /**
   * Update order shipping status (admin only)
   */
  async updateOrderShippingStatus(
    orderId: string,
    shippingStatus: string,
    trackingNumber?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const data: any = { shippingStatus };

    if (shippingStatus === 'SHIPPED') {
      data.shippedAt = order.shippedAt || new Date();
      data.status = 'SHIPPED';
      if (trackingNumber) {
        data.trackingNumber = trackingNumber;
      }
    } else if (shippingStatus === 'DELIVERED') {
      data.deliveredAt = order.deliveredAt || new Date();
      data.status = 'DELIVERED';
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data,
    });

    return {
      success: true,
      data: {
        orderId: updated.id,
        status: updated.status,
        shippingStatus: updated.shippingStatus,
        shippedAt: updated.shippedAt,
        deliveredAt: updated.deliveredAt,
      },
    };
  }

  /**
   * Send payment reminder notification to customer
   */
  async sendPaymentReminder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        total: true,
        depositorName: true,
        paymentStatus: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.paymentStatus !== 'PENDING') {
      throw new BadRequestException('Payment reminder can only be sent for pending payments');
    }

    await this.notificationsService.sendPaymentReminderNotification(
      order.userId,
      order.id,
      Number(order.total),
      order.depositorName,
    );

    return {
      success: true,
      message: 'Payment reminder sent successfully',
    };
  }

  /**
   * Send bulk shipping notifications from CSV data
   */
  async sendBulkShippingNotifications(items: { orderId: string; trackingNumber: string }[]) {
    const results = [];
    let successful = 0;
    let failed = 0;

    for (const item of items) {
      try {
        const order = await this.prisma.order.findUnique({
          where: { id: item.orderId },
          select: {
            id: true,
            userId: true,
            paymentStatus: true,
          },
        });

        if (!order) {
          results.push({
            orderId: item.orderId,
            success: false,
            error: 'Order not found',
          });
          failed++;
          continue;
        }

        if (order.paymentStatus !== 'CONFIRMED') {
          results.push({
            orderId: item.orderId,
            success: false,
            error: 'Payment not confirmed',
          });
          failed++;
          continue;
        }

        await this.notificationsService.sendShippingNotification(
          order.userId,
          order.id,
          item.trackingNumber,
        );

        results.push({
          orderId: item.orderId,
          success: true,
        });
        successful++;
      } catch (error) {
        results.push({
          orderId: item.orderId,
          success: false,
          error: error.message || 'Failed to send notification',
        });
        failed++;
      }
    }

    return {
      total: items.length,
      successful,
      failed,
      results,
    };
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
        shippingAddress = this.encryptionService.decryptAddress(user.shippingAddress as string);
      } catch (error) {
        this.logger.error(
          'Failed to decrypt shipping address',
          error instanceof Error ? error.stack : String(error),
        );
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

    const updateData: UserStatusUpdateData = {
      status: dto.status as UserStatus,
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

    // Set/clear Redis suspended flag for WebSocket auth check
    try {
      if (dto.status === 'SUSPENDED') {
        await this.redisService.set(`suspended:${userId}`, '1');
        // Also blacklist all existing tokens for this user
        await this.redisService.set(`blacklist:${userId}`, '1', 86400 * 30); // 30 days
      } else {
        await this.redisService.del(`suspended:${userId}`);
        await this.redisService.del(`blacklist:${userId}`);
      }
    } catch {
      // Redis unavailable — DB status check in JWT strategy still works
    }

    return {
      success: true,
      data: {
        id: updatedUser.id,
        status: updatedUser.status,
        suspendedAt: updatedUser.suspendedAt,
      },
    };
  }

  /**
   * Get all notification templates
   */
  async getNotificationTemplates() {
    const templates = await this.prisma.notificationTemplate.findMany({
      orderBy: { name: 'asc' },
    });

    return templates;
  }

  /**
   * Update notification template
   */
  async updateNotificationTemplate(id: string, template: string) {
    const existingTemplate = await this.prisma.notificationTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      throw new NotFoundException('Notification template not found');
    }

    const updated = await this.prisma.notificationTemplate.update({
      where: { id },
      data: { template },
    });

    return {
      success: true,
      data: updated,
    };
  }

  /**
   * Generate settlement report with daily aggregation
   */
  async getSettlementReport(fromDate: string, toDate: string) {
    // Validate date parameters
    if (!fromDate || !toDate) {
      throw new BadRequestException('fromDate and toDate are required');
    }

    // Parse dates as UTC to avoid timezone issues
    const from = new Date(fromDate + 'T00:00:00.000Z');
    const to = new Date(toDate + 'T23:59:59.999Z');

    // Check if dates are valid
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new BadRequestException('Invalid date format. Please use YYYY-MM-DD format');
    }

    // Get all confirmed payment orders in date range
    const orders = await this.prisma.order.findMany({
      where: {
        paymentStatus: 'CONFIRMED',
        paidAt: {
          gte: from,
          lte: to,
        },
      },
      select: {
        id: true,
        userId: true,
        userEmail: true,
        instagramId: true,
        total: true,
        shippingFee: true,
        createdAt: true,
        paidAt: true,
      },
      orderBy: {
        paidAt: 'desc',
      },
    });

    // Calculate summary
    const summary = {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, order) => sum + Number(order.total), 0),
      avgOrderValue:
        orders.length > 0
          ? orders.reduce((sum, order) => sum + Number(order.total), 0) / orders.length
          : 0,
      totalShippingFee: orders.reduce((sum, order) => sum + Number(order.shippingFee), 0),
    };

    // Daily aggregation for chart
    const dailyRevenue = new Map<string, { date: string; revenue: number; orderCount: number }>();

    orders.forEach((order) => {
      const dateKey = order.paidAt.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!dailyRevenue.has(dateKey)) {
        dailyRevenue.set(dateKey, {
          date: dateKey,
          revenue: 0,
          orderCount: 0,
        });
      }

      const day = dailyRevenue.get(dateKey);
      day.revenue += Number(order.total);
      day.orderCount += 1;
    });

    // Convert map to sorted array
    const dailyData = Array.from(dailyRevenue.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    return {
      summary,
      orders: orders.map((order) => ({
        orderId: order.id,
        orderDate: order.createdAt.toISOString(),
        customerId: order.instagramId || order.userEmail,
        total: Number(order.total),
        paidAt: order.paidAt.toISOString(),
      })),
      dailyRevenue: dailyData,
      dateRange: {
        from: fromDate,
        to: toDate,
      },
    };
  }

  /**
   * Get audit logs with filters
   * Epic 12 Story 12.3
   */
  async getAuditLogs(fromDate?: string, toDate?: string, action?: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const where: AuditLogWhereClause = {};

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        const fromDateObj = new Date(fromDate);
        if (isNaN(fromDateObj.getTime())) {
          throw new BadRequestException('Invalid from date format');
        }
        where.createdAt.gte = fromDateObj;
      }
      if (toDate) {
        const toDateObj = new Date(toDate);
        if (isNaN(toDateObj.getTime())) {
          throw new BadRequestException('Invalid to date format');
        }
        toDateObj.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDateObj;
      }
    }

    if (action) {
      where.action = action;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          admin: {
            select: { email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs.map((log) => ({
        id: log.id,
        timestamp: log.createdAt.toISOString(),
        adminEmail: log.admin?.email || 'Unknown',
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        changes: log.changes,
      })),
      meta: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      },
    };
  }
}
