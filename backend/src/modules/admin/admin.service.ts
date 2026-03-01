import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AlimtalkService } from './alimtalk.service';
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
  UpdateHomeFeaturedProductsDto,
  UpdateMarketingCampaignsDto,
  UpdatePaymentProvidersDto,
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
  userId?: string;
  total?: { gte?: number; lte?: number };
  orderItems?: Record<string, unknown>;
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

type AdminConfigItem = Record<string, unknown>;
type AdminConfigItems = AdminConfigItem[];

type ConfigSection = 'homeFeaturedProducts' | 'marketingCampaigns' | 'paymentProviders';

const CONFIG_KEYS_BY_SECTION: Record<ConfigSection, string> = {
  homeFeaturedProducts: 'homeFeaturedProducts',
  marketingCampaigns: 'marketingCampaigns',
  paymentProviders: 'paymentProviders',
};

const CONFIG_DEFAULTS: Record<ConfigSection, AdminConfigItem> = {
  homeFeaturedProducts: {
    productName: '',
    originalPrice: 0,
    livePrice: 0,
    host: '패션 라이브',
    stock: 0,
    sold: 0,
    isVisible: true,
    imageUrl: '',
    description: '',
  },
  marketingCampaigns: {
    title: '',
    description: '',
    status: 'active',
    channel: 'Instagram',
    campaignType: '이벤트',
    targetProduct: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    discountType: '퍼센트',
    discountValue: 0,
  },
  paymentProviders: {
    provider: 'Stripe',
    accountName: '',
    accountId: '',
    currency: 'USD',
    status: 'active',
    note: '',
  },
};

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private encryptionService: EncryptionService,
    private notificationsService: NotificationsService,
    private alimtalkService: AlimtalkService,
    private redisService: RedisService,
  ) {}

  private getSystemConfigDefaults(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: 'system',
      noticeText: null,
      noticeFontSize: 14,
      noticeFontFamily: 'Pretendard',
      ...overrides,
    };
  }

  private async getSystemConfigOrCreate() {
    const config = await this.prisma.systemConfig.findFirst({
      where: { id: 'system' },
    });

    if (config) {
      return config;
    }

    return this.prisma.systemConfig.create({
      data: this.getSystemConfigDefaults(),
    });
  }

  private resolveConfigItemId(value: unknown, fallback: string): string {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return String(value);
    }
    return fallback;
  }

  private normalizeConfigItems(raw: unknown, section: ConfigSection, itemDefaults: AdminConfigItem) {
    if (!Array.isArray(raw)) {
      return [] as AdminConfigItems;
    }

    return raw.map((item, index) => {
      const base =
        item && typeof item === 'object' && !Array.isArray(item) ? (item as AdminConfigItem) : {};
      const id = this.resolveConfigItemId(base.id, `${section}-${index + 1}`);
      return {
        ...itemDefaults,
        ...base,
        id,
      };
    });
  }

  private async updateConfigSection(section: ConfigSection, items: AdminConfigItems, itemDefaults: AdminConfigItem) {
    const normalizedItems = this.normalizeConfigItems(items, section, itemDefaults);
    const updateData: Record<string, AdminConfigItems> = {};
    const createData: Record<string, AdminConfigItems | unknown> = this.getSystemConfigDefaults();

    const config = await this.prisma.systemConfig.upsert({
      where: { id: 'system' },
      update: (() => {
        updateData[CONFIG_KEYS_BY_SECTION[section]] = normalizedItems;
        return updateData as unknown as Record<string, AdminConfigItems>;
      })(),
      create: (() => {
        createData[CONFIG_KEYS_BY_SECTION[section]] = normalizedItems;
        return createData as unknown as Record<string, unknown>;
      })(),
    });

    return this.normalizeConfigItems(
      (config as unknown as Record<string, unknown>)[CONFIG_KEYS_BY_SECTION[section]],
      section,
      itemDefaults,
    );
  }

  private parseShippingAddress(addressValue: unknown): Record<string, unknown> | null {
    if (!addressValue) {
      return null;
    }

    if (typeof addressValue === 'string') {
      try {
        const decrypted = this.encryptionService.decryptAddress(addressValue);
        return decrypted as unknown as Record<string, unknown>;
      } catch {
        try {
          const parsed = JSON.parse(addressValue);
          return parsed as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }

    if (typeof addressValue === 'object' && !Array.isArray(addressValue)) {
      return addressValue as Record<string, unknown>;
    }

    return null;
  }

  private normalizeShippingAddress(addressValue: unknown): ShippingAddressDto | null {
    const value = this.parseShippingAddress(addressValue);
    if (!value) {
      return null;
    }

    const toText = (entry: unknown): string => (typeof entry === 'string' ? entry.trim() : '');

    const fullName = toText(value.fullName) || toText(value.name);
    const address1 = toText(value.address1) || toText(value.street);
    const address2 = toText(value.address2);
    const city = toText(value.city) || toText(value.town);
    const state = toText(value.state) || toText(value.region);
    const zip = toText(value.zip) || toText(value.zipCode) || toText(value.postalCode);
    const phone = toText(value.phone);

    if (!fullName && !address1 && !address2 && !city && !state && !zip && !phone) {
      return null;
    }

    return {
      fullName,
      address1,
      address2: address2 || undefined,
      city,
      state,
      zip,
      phone,
    } as ShippingAddressDto;
  }

  private formatShippingAddressSummary(addressValue: unknown): string {
    const normalized = this.normalizeShippingAddress(addressValue);
    if (!normalized) {
      return '-';
    }

    const lines = [
      normalized.fullName || normalized.address1,
      normalized.address2,
      [normalized.city, normalized.state, normalized.zip].filter(Boolean).join(' ').trim(),
    ]
      .map((line) => String(line).trim())
      .filter(Boolean);

    return lines.length > 0 ? lines.join(' / ') : '-';
  }

  async getUserList(query: GetUsersQueryDto): Promise<UserListResponseDto> {
    const { sortOrder, search, dateFrom, dateTo, status } = query;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';

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

    // Get count and page rows together for better throughput
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        } as Record<string, string>,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          instagramId: true,
          shippingAddress: true,
          createdAt: true,
          lastLoginAt: true,
          status: true,
          role: true,
        },
      }),
    ]);

    // Batch fetch order stats for all users in this page
    const userIds = users.map((u) => u.id);
    const orderStats = await this.prisma.order.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, paymentStatus: 'CONFIRMED' },
      _count: { id: true },
      _sum: { total: true },
      _max: { createdAt: true },
    });
    const statsMap = new Map(orderStats.map((s) => [s.userId, s]));

    // Map users to DTOs with order stats
    const userDtos: UserListItemDto[] = users.map((user) => ({
      id: user.id,
      email: user.email ?? '',
      name: user.name,
      phone: user.phone,
      instagramId: user.instagramId,
      shippingAddressSummary: this.formatShippingAddressSummary(user.shippingAddress),
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      status: user.status,
      role: user.role,
      totalOrders: statsMap.get(user.id)?._count.id ?? 0,
      totalPurchaseAmount: String(statsMap.get(user.id)?._sum.total ?? 0),
      lastPurchaseAt: statsMap.get(user.id)?._max.createdAt?.toISOString() ?? null,
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
      sortOrder,
      search,
      dateFrom,
      dateTo,
      orderStatus,
      paymentStatus,
      shippingStatus,
      userId,
      minAmount,
      maxAmount,
      streamKey,
    } = query;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';

    const skip = (page - 1) * limit;

    // Build where clause for filters
    const where: OrderWhereClause = {};
    const allowedOrderStatuses: OrderStatus[] = [
      'PENDING_PAYMENT',
      'PAYMENT_CONFIRMED',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
    ];

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
      where.status = {
        in: orderStatus.filter((status) =>
          allowedOrderStatuses.includes(status as OrderStatus),
        ) as OrderStatus[],
      };
    } else {
      where.status = { in: allowedOrderStatuses };
    }

    // Payment status filter
    if (paymentStatus && paymentStatus.length > 0) {
      where.paymentStatus = { in: paymentStatus as PaymentStatus[] };
    }

    // Shipping status filter
    if (shippingStatus && shippingStatus.length > 0) {
      where.shippingStatus = { in: shippingStatus as ShippingStatus[] };
    }

    if (userId) {
      where.userId = userId;
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

    // StreamKey filter (index-friendly with pre-filtered product list)
    const noStreamMatch = await this.applyStreamKeyFilter(where, streamKey);
    if (noStreamMatch) {
      return {
        orders: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    // Get count and page rows together for better throughput
    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        } as Record<string, string>,
        include: {
          orderItems: {
            select: {
              productId: true,
              productName: true,
              price: true,
              quantity: true,
              color: true,
              size: true,
              Product: {
                select: {
                  streamKey: true,
                },
              },
            },
          },
        },
      }),
    ]);

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
      subtotal: String(order.subtotal),
      shippingFee: String(order.shippingFee),
      total: String(order.total),
      itemCount: order.orderItems.length,
      createdAt: order.createdAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
      shippedAt: order.shippedAt?.toISOString() ?? null,
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
      streamKey: order.orderItems[0]?.Product?.streamKey ?? null,
      items: order.orderItems.map((item) => ({
        productName: item.productName,
        price: String(item.price),
        quantity: item.quantity,
        color: item.color,
        size: item.size,
      })),
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
      sortOrder,
      search,
      dateFrom,
      dateTo,
      orderStatus,
      paymentStatus,
      shippingStatus,
      userId,
      minAmount,
      maxAmount,
      streamKey,
    } = query;
    const sortBy = query.sortBy ?? 'createdAt';
    const allowedOrderStatuses: OrderStatus[] = [
      'PENDING_PAYMENT',
      'PAYMENT_CONFIRMED',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
    ];

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
      const filteredOrderStatus = orderStatus.filter((status) =>
        allowedOrderStatuses.includes(status as OrderStatus),
      );

      where.status = {
        in:
          filteredOrderStatus.length > 0
            ? (filteredOrderStatus as OrderStatus[])
            : ['PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
      };
    } else {
      where.status = { in: allowedOrderStatuses };
    }
    if (paymentStatus && paymentStatus.length > 0) {
      where.paymentStatus = { in: paymentStatus as PaymentStatus[] };
    }
    if (shippingStatus && shippingStatus.length > 0) {
      where.shippingStatus = { in: shippingStatus as ShippingStatus[] };
    }

    if (userId) {
      where.userId = userId;
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

    const noStreamMatch = await this.applyStreamKeyFilter(where, streamKey);
    if (noStreamMatch) {
      const Papa = await import('papaparse');
      return Papa.unparse([]);
    }

    const MAX_EXPORT_ROWS = 10000;

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { [sortBy]: sortOrder } as Record<string, string>,
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

    const ORDER_STATUS_KO: Record<string, string> = {
      PENDING_PAYMENT: '결제대기',
      PAYMENT_CONFIRMED: '결제완료',
      SHIPPED: '배송중',
      DELIVERED: '배송완료',
      CANCELLED: '취소',
    };
    const PAYMENT_STATUS_KO: Record<string, string> = {
      PENDING: '대기',
      CONFIRMED: '완료',
      FAILED: '실패',
      REFUNDED: '환불',
    };
    const SHIPPING_STATUS_KO: Record<string, string> = {
      PENDING: '준비중',
      SHIPPED: '배송중',
      DELIVERED: '배송완료',
    };

    const toKST = (date: Date) =>
      date
        .toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
        .replace(/\. /g, '-')
        .replace('.', '')
        .replace(',', '');

    const csvData = orders.map((order) => ({
      주문번호: order.id,
      고객이메일: order.userEmail,
      입금자명: order.depositorName,
      인스타그램ID: order.instagramId,
      주문상태: ORDER_STATUS_KO[order.status] ?? order.status,
      결제상태: PAYMENT_STATUS_KO[order.paymentStatus] ?? order.paymentStatus,
      배송상태: SHIPPING_STATUS_KO[order.shippingStatus] ?? order.shippingStatus,
      소계: Number(order.subtotal),
      배송비: Number(order.shippingFee),
      합계: Number(order.total),
      주문일: toKST(order.createdAt),
      결제일: order.paidAt ? toKST(order.paidAt) : '',
    }));

    return Papa.unparse(csvData, { newline: '\r\n' });
  }

  async exportOrdersExcel(query: GetOrdersQueryDto): Promise<Buffer> {
    const {
      sortOrder,
      search,
      dateFrom,
      dateTo,
      orderStatus,
      paymentStatus,
      shippingStatus,
      userId,
      minAmount,
      maxAmount,
      streamKey,
    } = query;
    const sortBy = query.sortBy ?? 'createdAt';
    const allowedOrderStatuses: OrderStatus[] = [
      'PENDING_PAYMENT',
      'PAYMENT_CONFIRMED',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
    ];

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
      const filteredOrderStatus = orderStatus.filter((status) =>
        allowedOrderStatuses.includes(status as OrderStatus),
      );

      where.status = {
        in:
          filteredOrderStatus.length > 0
            ? (filteredOrderStatus as OrderStatus[])
            : ['PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
      };
    } else {
      where.status = { in: allowedOrderStatuses };
    }
    if (paymentStatus && paymentStatus.length > 0) {
      where.paymentStatus = { in: paymentStatus as PaymentStatus[] };
    }
    if (shippingStatus && shippingStatus.length > 0) {
      where.shippingStatus = { in: shippingStatus as ShippingStatus[] };
    }

    if (userId) {
      where.userId = userId;
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

    const noStreamMatch = await this.applyStreamKeyFilter(where, streamKey);

    const MAX_EXPORT_ROWS = 10000;
    const orders = noStreamMatch
      ? []
      : await this.prisma.order.findMany({
          where,
          orderBy: { [sortBy]: sortOrder } as Record<string, string>,
          take: MAX_EXPORT_ROWS,
          include: {
            orderItems: true,
            user: { select: { phone: true } },
          },
        });

    const ORDER_STATUS_KO: Record<string, string> = {
      PENDING_PAYMENT: '입금대기',
      PAYMENT_CONFIRMED: '결제완료',
      SHIPPED: '배송중',
      DELIVERED: '배송완료',
      CANCELLED: '취소',
    };

    const toKST = (date: Date) =>
      date.toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('주문 목록');

    sheet.columns = [
      { header: '주문번호', key: 'id', width: 28 },
      { header: '이메일', key: 'userEmail', width: 28 },
      { header: '인스타그램ID', key: 'instagramId', width: 18 },
      { header: '입금자명', key: 'depositorName', width: 14 },
      { header: '전화번호', key: 'phone', width: 16 },
      { header: '주문상태', key: 'status', width: 12 },
      { header: '상품명', key: 'productName', width: 30 },
      { header: '색상', key: 'color', width: 12 },
      { header: '사이즈', key: 'size', width: 10 },
      { header: '배송지', key: 'shippingAddress', width: 40 },
      { header: '소계', key: 'subtotal', width: 12 },
      { header: '배송비', key: 'shippingFee', width: 10 },
      { header: '합계', key: 'total', width: 12 },
      { header: '주문일', key: 'createdAt', width: 22 },
      { header: '결제일', key: 'paidAt', width: 22 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF1493' },
    };
    headerRow.alignment = { horizontal: 'center' };

    orders.forEach((order) => {
      // 배송지 정보 추출
      let shippingAddressStr = '-';
      shippingAddressStr = this.formatShippingAddressSummary(order.shippingAddress);

      const phone = order.user.phone ?? '-';
      const baseRow = {
        id: order.id,
        userEmail: order.userEmail,
        instagramId: order.instagramId?.replace(/^@/, ''),
        depositorName: order.depositorName,
        phone,
        status: ORDER_STATUS_KO[order.status] ?? order.status,
        shippingAddress: shippingAddressStr,
        subtotal: Number(order.subtotal),
        shippingFee: Number(order.shippingFee),
        total: Number(order.total),
        createdAt: toKST(order.createdAt),
        paidAt: order.paidAt ? toKST(order.paidAt) : '',
      };

      if (order.orderItems && order.orderItems.length > 0) {
        order.orderItems.forEach((item) => {
          sheet.addRow({
            ...baseRow,
            productName: item.productName,
            color: item.color ?? '-',
            size: item.size ?? '-',
          });
        });
      } else {
        sheet.addRow({
          ...baseRow,
          productName: '-',
          color: '-',
          size: '-',
        });
      }
    });

    const moneyFmt = '#,##0';
    sheet.getColumn('subtotal').numFmt = moneyFmt;
    sheet.getColumn('shippingFee').numFmt = moneyFmt;
    sheet.getColumn('total').numFmt = moneyFmt;

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async applyStreamKeyFilter(
    where: OrderWhereClause,
    streamKey?: string,
  ): Promise<boolean> {
    if (!streamKey) {
      return false;
    }

    const normalizedStreamKey = streamKey.trim();
    if (!normalizedStreamKey) {
      return true;
    }

    const streamProducts = await this.prisma.product.findMany({
      where: { streamKey: { equals: normalizedStreamKey, mode: 'insensitive' } },
      select: { id: true },
    });

    if (streamProducts.length === 0) {
      return true;
    }

    where.orderItems = {
      some: {
        productId: {
          in: streamProducts.map((item) => item.id),
        },
      },
    };

    return false;
  }

  async getDashboardStats(): Promise<DashboardStatsDto> {
    const now = new Date();

    // Epic 12 Story 12.1: Last 7 days vs previous 7 days
    const last7DaysStart = new Date(now);
    last7DaysStart.setDate(last7DaysStart.getDate() - 7);
    last7DaysStart.setHours(0, 0, 0, 0);

    const previous7DaysStart = new Date(last7DaysStart);
    previous7DaysStart.setDate(previous7DaysStart.getDate() - 7);

    const [
      last7DaysOrders,
      previous7DaysOrders,
      last7DaysRevenue,
      previous7DaysRevenue,
      pendingPayments,
      activeLiveStreams,
      topProducts,
      optionSales,
      last7DaysMessages,
      previous7DaysMessages,
      last7DaysConfirmedOrders,
    ] = await Promise.all([
      this.prisma.order.count({
        where: { paidAt: { gte: last7DaysStart }, paymentStatus: 'CONFIRMED' },
      }),
      this.prisma.order.count({
        where: {
          paidAt: { gte: previous7DaysStart, lt: last7DaysStart },
          paymentStatus: 'CONFIRMED',
        },
      }),
      this.prisma.order.aggregate({
        where: {
          paidAt: { gte: last7DaysStart },
          paymentStatus: 'CONFIRMED',
        },
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: {
          paidAt: { gte: previous7DaysStart, lt: last7DaysStart },
          paymentStatus: 'CONFIRMED',
        },
        _sum: { total: true },
      }),
      this.prisma.order.count({
        where: { paymentStatus: 'PENDING' },
      }),
      this.prisma.liveStream.count({
        where: { status: 'LIVE' },
      }),
      this.prisma.orderItem.groupBy({
        by: ['productId', 'productName'],
        where: { productId: { not: null }, order: { paymentStatus: 'CONFIRMED' } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      this.prisma.orderItem.groupBy({
        by: ['productName', 'color', 'size'],
        where: { productId: { not: null }, order: { paymentStatus: 'CONFIRMED' } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 8,
      }),
      this.prisma.chatMessage.count({
        where: {
          timestamp: { gte: last7DaysStart },
          isDeleted: false,
        },
      }),
      this.prisma.chatMessage.count({
        where: {
          timestamp: { gte: previous7DaysStart, lt: last7DaysStart },
          isDeleted: false,
        },
      }),
      this.prisma.order.findMany({
        where: {
          paymentStatus: 'CONFIRMED',
          paidAt: { gte: last7DaysStart },
        },
        select: { paidAt: true, total: true },
        orderBy: { paidAt: 'asc' },
      }),
    ]);

    const ordersTrend = this.calculateTrend(last7DaysOrders, previous7DaysOrders);
    const revenueLast7Days = Number(last7DaysRevenue._sum.total ?? 0);
    const revenuePrevious7Days = Number(previous7DaysRevenue._sum.total ?? 0);
    const revenueTrend = this.calculateTrend(revenueLast7Days, revenuePrevious7Days);

    const messagesTrend = this.calculateTrend(last7DaysMessages, previous7DaysMessages);

    const dailyRevenueMap = new Map<
      string,
      { date: string; revenue: number; orderCount: number }
    >();

    last7DaysConfirmedOrders.forEach((order) => {
      if (!order.paidAt) {
        return;
      }
      const dateKey = order.paidAt.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!dailyRevenueMap.has(dateKey)) {
        dailyRevenueMap.set(dateKey, { date: dateKey, revenue: 0, orderCount: 0 });
      }

      const day = dailyRevenueMap.get(dateKey)!;
      day.revenue += Number(order.total);
      day.orderCount += 1;
    });

    const dailyRevenue = Array.from(dailyRevenueMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    return {
      revenue: {
        value: revenueLast7Days,
        formatted: this.formatCurrency(revenueLast7Days),
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
        productId: p.productId ?? '',
        productName: p.productName,
        totalSold: p._sum.quantity ?? 0,
      })),
      optionSales: optionSales.map((item) => {
        const parts: string[] = [];
        if (item.productName) {
          parts.push(item.productName);
        }
        if (item.color) {
          parts.push(item.color);
        }
        if (item.size) {
          parts.push(item.size);
        }

        return {
          option: parts.length > 0 ? parts.join(' / ') : '옵션 미지정',
          sales: item._sum.quantity ?? 0,
        };
      }),
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
      timestamp: log.createdAt.toISOString(),
      metadata: log.changes as Record<string, unknown>,
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

  private formatCurrency(num: number): string {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(num);
  }

  private formatActivityMessage(action: string, entity: string): string {
    const actionMap: Record<string, string> = {
      CREATE: 'created',
      UPDATE: 'updated',
      DELETE: 'deleted',
    };

    const verb = actionMap[action] ?? action.toLowerCase();
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
      caShippingFee:
        config.caShippingFee !== null && config.caShippingFee !== undefined
          ? parseFloat(config.caShippingFee.toString())
          : 8,
      freeShippingThreshold:
        config.freeShippingThreshold !== null && config.freeShippingThreshold !== undefined
          ? parseFloat(config.freeShippingThreshold.toString())
          : 150,
      bankName: config.bankName,
      bankAccountNumber: config.bankAccountNumber,
      bankAccountHolder: config.bankAccountHolder,
      zelleEmail: config.zelleEmail,
      zelleRecipientName: config.zelleRecipientName,
      freeShippingEnabled: config.freeShippingEnabled,
      emailNotificationsEnabled: config.emailNotificationsEnabled,
      alimtalkEnabled: config.alimtalkEnabled,
      solapiApiKey: config.solapiApiKey,
      solapiApiSecret: config.solapiApiSecret ? '••••••••' : '',
      kakaoChannelId: config.kakaoChannelId,
    };
  }

  /**
   * Update system settings (cart timer, bank info, shipping fee, notifications)
   */
  async updateSystemSettings(dto: UpdateSystemSettingsDto) {
    const updateData: Record<string, unknown> = {};
    if (dto.defaultCartTimerMinutes !== undefined) {
      updateData.defaultCartTimerMinutes = dto.defaultCartTimerMinutes;
    }
    if (dto.defaultShippingFee !== undefined) {
      updateData.defaultShippingFee = dto.defaultShippingFee;
    }
    if (dto.caShippingFee !== undefined) {
      updateData.caShippingFee = dto.caShippingFee;
    }
    if (dto.freeShippingThreshold !== undefined) {
      updateData.freeShippingThreshold = dto.freeShippingThreshold;
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
    if (dto.alimtalkEnabled !== undefined) {
      updateData.alimtalkEnabled = dto.alimtalkEnabled;
    }
    if (dto.solapiApiKey !== undefined) {
      updateData.solapiApiKey = dto.solapiApiKey;
    }
    if (dto.solapiApiSecret !== undefined && dto.solapiApiSecret !== '••••••••') {
      updateData.solapiApiSecret = dto.solapiApiSecret;
    }
    if (dto.kakaoChannelId !== undefined) {
      updateData.kakaoChannelId = dto.kakaoChannelId;
    }
    if (dto.zelleEmail !== undefined) {
      updateData.zelleEmail = dto.zelleEmail;
    }
    if (dto.zelleRecipientName !== undefined) {
      updateData.zelleRecipientName = dto.zelleRecipientName;
    }
    if (dto.freeShippingEnabled !== undefined) {
      updateData.freeShippingEnabled = dto.freeShippingEnabled;
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
      caShippingFee:
        config.caShippingFee !== null && config.caShippingFee !== undefined
          ? parseFloat(config.caShippingFee.toString())
          : 8,
      freeShippingThreshold:
        config.freeShippingThreshold !== null && config.freeShippingThreshold !== undefined
          ? parseFloat(config.freeShippingThreshold.toString())
          : 150,
      bankName: config.bankName,
      bankAccountNumber: config.bankAccountNumber,
      bankAccountHolder: config.bankAccountHolder,
      zelleEmail: config.zelleEmail,
      zelleRecipientName: config.zelleRecipientName,
      freeShippingEnabled: config.freeShippingEnabled,
      emailNotificationsEnabled: config.emailNotificationsEnabled,
      alimtalkEnabled: config.alimtalkEnabled,
      solapiApiKey: config.solapiApiKey,
      solapiApiSecret: config.solapiApiSecret ? '••••••••' : '',
      kakaoChannelId: config.kakaoChannelId,
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

    return (config.shippingMessages as Record<string, string>) ?? defaultMessages;
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

  async getHomeFeaturedProducts() {
    const config = await this.getSystemConfigOrCreate();
    return this.normalizeConfigItems(
      config.homeFeaturedProducts,
      'homeFeaturedProducts',
      CONFIG_DEFAULTS.homeFeaturedProducts,
    );
  }

  async updateHomeFeaturedProducts(dto: UpdateHomeFeaturedProductsDto) {
    return this.updateConfigSection(
      'homeFeaturedProducts',
      dto.items,
      CONFIG_DEFAULTS.homeFeaturedProducts,
    );
  }

  async getMarketingCampaigns() {
    const config = await this.getSystemConfigOrCreate();
    return this.normalizeConfigItems(
      config.marketingCampaigns,
      'marketingCampaigns',
      CONFIG_DEFAULTS.marketingCampaigns,
    );
  }

  async updateMarketingCampaigns(dto: UpdateMarketingCampaignsDto) {
    return this.updateConfigSection(
      'marketingCampaigns',
      dto.items,
      CONFIG_DEFAULTS.marketingCampaigns,
    );
  }

  async getPaymentProviders() {
    const config = await this.getSystemConfigOrCreate();
    return this.normalizeConfigItems(
      config.paymentProviders,
      'paymentProviders',
      CONFIG_DEFAULTS.paymentProviders,
    );
  }

  async updatePaymentProviders(dto: UpdatePaymentProvidersDto) {
    return this.updateConfigSection(
      'paymentProviders',
      dto.items,
      CONFIG_DEFAULTS.paymentProviders,
    );
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

    const shippingAddress = this.normalizeShippingAddress(order.user.shippingAddress);

    return {
      id: order.id,
      userId: order.userId,
      userEmail: order.userEmail,
      depositorName: order.depositorName,
      instagramId: order.instagramId,
      shippingAddress,
      status: order.status,
      paymentStatus: order.paymentStatus,
      shippingStatus: order.shippingStatus,
      subtotal: String(order.subtotal),
      shippingFee: String(order.shippingFee),
      total: String(order.total),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
      shippedAt: order.shippedAt?.toISOString() ?? null,
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
      items: order.orderItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productImage: item.Product?.imageUrl,
        quantity: item.quantity,
        price: String(item.price),
        shippingFee: String(item.shippingFee),
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
          paidAt: updatedOrder.paidAt?.toISOString() ?? null,
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

    if (
      !['PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(
        status,
      )
    ) {
      throw new BadRequestException('지원하지 않는 주문 상태입니다');
    }

    if (order.status === 'CANCELLED' && status !== 'CANCELLED') {
      throw new BadRequestException('취소된 주문의 상태는 변경할 수 없습니다');
    }

    const data: Record<string, unknown> = { status };

    // Sync related fields based on status
    if (status === 'PENDING_PAYMENT') {
      data.status = 'PENDING_PAYMENT';
      data.paymentStatus = 'PENDING';
      data.paidAt = null;
      data.shippingStatus = 'PENDING';
      data.shippedAt = null;
      data.deliveredAt = null;
    } else if (status === 'PAYMENT_CONFIRMED') {
      data.paymentStatus = 'CONFIRMED';
      data.paidAt = order.paidAt ?? new Date();
      data.shippingStatus = order.shippingStatus === 'DELIVERED' ? 'DELIVERED' : 'PENDING';
    } else if (status === 'SHIPPED') {
      data.status = 'SHIPPED';
      data.paymentStatus = 'CONFIRMED';
      data.paidAt = order.paidAt ?? new Date();
      data.shippingStatus = 'SHIPPED';
      data.shippedAt = order.shippedAt ?? new Date();
    } else if (status === 'DELIVERED') {
      data.status = 'DELIVERED';
      data.paymentStatus = 'CONFIRMED';
      data.paidAt = order.paidAt ?? new Date();
      data.shippingStatus = 'DELIVERED';
      data.shippedAt = order.shippedAt ?? order.paidAt ?? new Date();
      data.deliveredAt = order.deliveredAt ?? new Date();
    } else if (status === 'CANCELLED') {
      data.paymentStatus = 'FAILED';
      data.paidAt = order.paidAt;
      data.shippingStatus = order.shippingStatus === 'DELIVERED' ? 'DELIVERED' : 'SHIPPED';

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

    const data: Record<string, unknown> = { shippingStatus };

    if (shippingStatus === 'SHIPPED') {
      data.shippedAt = order.shippedAt ?? new Date();
      data.status = 'SHIPPED';
      if (trackingNumber) {
        data.trackingNumber = trackingNumber;
      }
    } else if (shippingStatus === 'DELIVERED') {
      data.deliveredAt = order.deliveredAt ?? new Date();
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
        trackingNumber: updated.trackingNumber,
        shippedAt: updated.shippedAt?.toISOString() ?? null,
        deliveredAt: updated.deliveredAt?.toISOString() ?? null,
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

    // Send alimtalk if user has phone number, otherwise fall back to web push
    const user = await this.prisma.user.findUnique({
      where: { id: order.userId },
      select: { phone: true },
    });

    if (user?.phone) {
      await this.alimtalkService.sendPaymentReminderAlimtalk(
        user.phone,
        order.id,
        Number(order.total),
      );
    } else {
      await this.notificationsService.sendPaymentReminderNotification(
        order.userId,
        order.id,
        Number(order.total),
        order.depositorName,
      );
    }

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
          error:
            (error instanceof Error ? error.message : String(error)) ??
            'Failed to send notification',
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

    const shippingAddress = this.normalizeShippingAddress(user.shippingAddress);

    const userOrders = await this.prisma.order.findMany({
      where: { userId, paymentStatus: 'CONFIRMED' },
      select: { total: true, createdAt: true },
    });
    const totalOrders = userOrders.length;
    const totalPurchaseAmount = userOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const averageOrderValue = totalOrders > 0 ? totalPurchaseAmount / totalOrders : 0;
    const monthsSinceRegistration = Math.max(
      1,
      Math.floor((Date.now() - user.createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000)),
    );
    const orderFrequency = totalOrders / monthsSinceRegistration;
    const statistics: UserStatisticsDto = {
      totalOrders,
      totalPurchaseAmount: String(totalPurchaseAmount),
      averageOrderValue,
      orderFrequency,
    };

    return {
      id: user.id,
      email: user.email ?? '',
      name: user.name,
      instagramId: user.instagramId,
      depositorName: user.depositorName,
      shippingAddress,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      status: user.status,
      role: user.role,
      suspendedAt: user.suspendedAt?.toISOString() ?? null,
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
        suspendedAt: updatedUser.suspendedAt?.toISOString() ?? null,
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
  async updateNotificationTemplate(id: string, template?: string, kakaoTemplateCode?: string) {
    const existingTemplate = await this.prisma.notificationTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      throw new NotFoundException('Notification template not found');
    }

    const updateData: { template?: string; kakaoTemplateCode?: string } = {};
    if (template !== undefined) {
      updateData.template = template;
    }
    if (kakaoTemplateCode !== undefined) {
      updateData.kakaoTemplateCode = kakaoTemplateCode;
    }

    const updated = await this.prisma.notificationTemplate.update({
      where: { id },
      data: updateData,
    });

    return {
      success: true,
      data: updated,
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
        adminEmail: log.admin?.email ?? 'Unknown',
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
