import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ExcelJS from 'exceljs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
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
  UpdateAdminUserDto,
  UserDetailDto,
  UpdateUserStatusDto,
  ShippingAddressDto,
  UserStatisticsDto,
  UpdateSystemSettingsDto,
  UpdateHomeFeaturedProductsDto,
  UpdateMarketingCampaignsDto,
  UpdatePaymentProvidersDto,
} from './dto/admin.dto';

import { Prisma, UserStatus, OrderStatus, PaymentStatus, ShippingStatus } from '@prisma/client';

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
  userId?: string;
  total?: { gte?: number; lte?: number };
  orderItems?: Record<string, unknown>;
  deletedAt?: null | { not: null };
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
    private notificationsService: NotificationsService,
    private alimtalkService: AlimtalkService,
    private redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  private getDisplayProductName(item: { productName: string; Product?: { name?: string | null } | null }) {
    return item.Product?.name?.trim() || item.productName;
  }
