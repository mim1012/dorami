import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsEnum,
  IsArray,
  IsNumber,
  IsBoolean,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class GetUsersQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @IsEnum(['createdAt', 'email', 'name', 'instagramId', 'lastLoginAt'])
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  // Search
  @IsOptional()
  @IsString()
  search?: string;

  // Date range filter
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  // Order count filter
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(0)
  minOrders?: number;

  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(0)
  maxOrders?: number;

  // Purchase amount filter
  @IsOptional()
  @Transform(({ value }) => (value ? parseFloat(value) : undefined))
  minAmount?: number;

  @IsOptional()
  @Transform(({ value }) => (value ? parseFloat(value) : undefined))
  maxAmount?: number;

  // Status filter (array)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  status?: string[];
}

export class UserListItemDto {
  id: string;
  email: string;
  name: string;
  instagramId: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  status: string;
  role: string;
  totalOrders: number;
  totalPurchaseAmount: number;
}

export class UserListResponseDto {
  users: UserListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Dashboard Stats DTOs
export class StatItemDto {
  value: number;
  formatted: string;
  trend: string;
  trendUp: boolean;
}

export class TopProductDto {
  productId: string;
  productName: string;
  totalSold: number;
}

export class DailyRevenueDto {
  date: string;
  revenue: number;
  orderCount: number;
}

export class DashboardStatsDto {
  revenue: StatItemDto;
  viewers: StatItemDto;
  orders: StatItemDto;
  messages: StatItemDto;
  // Epic 12 Story 12.1: Additional dashboard metrics
  pendingPayments: { value: number; formatted: string };
  activeLiveStreams: { value: number; formatted: string };
  topProducts: TopProductDto[];
  dailyRevenue: DailyRevenueDto[];
}

// Live Status DTOs
export class LiveStatusDto {
  isLive: boolean;
  streamId: string | null;
  streamKey: string | null;
  title: string | null;
  duration: string | null; // HH:MM:SS format
  viewerCount: number;
  thumbnailUrl: string | null;
  startedAt: Date | null;
}

// Recent Activities DTOs
export class ActivityLogDto {
  id: string;
  type: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class RecentActivitiesDto {
  activities: ActivityLogDto[];
  total: number;
}

// Notice Configuration DTOs
export class UpdateNoticeDto {
  @IsOptional()
  @IsString()
  noticeText?: string | null;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(24)
  noticeFontSize?: number;

  @IsOptional()
  @IsString()
  noticeFontFamily?: string;
}

export class NoticeDto {
  text: string | null;
  fontSize: number;
  fontFamily: string;
}

// Order Management DTOs
export class GetOrdersQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @IsEnum(['createdAt', 'paidAt', 'total', 'status'])
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  // Search by order ID, user email, depositor name, instagram ID
  @IsOptional()
  @IsString()
  search?: string;

  // Date range filter (for createdAt)
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  // Order status filter (array)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  orderStatus?: string[];

  // Payment status filter (array)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  paymentStatus?: string[];

  // Shipping status filter (array)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  shippingStatus?: string[];

  // Amount range filter
  @IsOptional()
  @Transform(({ value }) => (value ? parseFloat(value) : undefined))
  minAmount?: number;

  @IsOptional()
  @Transform(({ value }) => (value ? parseFloat(value) : undefined))
  maxAmount?: number;
}

export class OrderListItemDto {
  id: string;
  userId: string;
  userEmail: string;
  depositorName: string;
  instagramId: string;
  status: string;
  paymentStatus: string;
  shippingStatus: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  itemCount: number;
  createdAt: Date;
  paidAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
}

export class OrderListResponseDto {
  orders: OrderListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// User Detail DTOs
export class ShippingAddressDto {
  fullName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

export class UserStatisticsDto {
  totalOrders: number;
  totalPurchaseAmount: number;
  averageOrderValue: number;
  orderFrequency: number; // orders per month
}

export class UserDetailDto {
  id: string;
  email: string;
  name: string;
  instagramId: string | null;
  depositorName: string | null;
  shippingAddress: ShippingAddressDto | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  status: string;
  role: string;
  suspendedAt: Date | null;
  statistics: UserStatisticsDto;
}

export class UpdateUserStatusDto {
  @IsString()
  @IsEnum(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
  status: string;

  @IsOptional()
  @IsString()
  suspensionReason?: string;
}

// System Settings DTO
export class UpdateSystemSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7200)
  defaultCartTimerMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultShippingFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  caShippingFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  freeShippingThreshold?: number;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  bankAccountHolder?: string;

  @IsOptional()
  @IsBoolean()
  emailNotificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  alimtalkEnabled?: boolean;

  @IsOptional()
  @IsString()
  solapiApiKey?: string;

  @IsOptional()
  @IsString()
  solapiApiSecret?: string;

  @IsOptional()
  @IsString()
  kakaoChannelId?: string;

  @IsOptional()
  @IsString()
  zelleEmail?: string;

  @IsOptional()
  @IsString()
  zelleRecipientName?: string;

  @IsOptional()
  @IsBoolean()
  freeShippingEnabled?: boolean;
}

// Shipping Messages DTO
export class UpdateShippingMessagesDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  preparing: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  shipped: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  inTransit: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  delivered: string;
}

// Notification Template DTO
export class UpdateNotificationTemplateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  template?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  kakaoTemplateCode?: string;
}

export class UpdateOrderStatusDto {
  @IsString()
  @IsEnum(['PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'])
  status: string;
}

export class UpdateOrderShippingStatusDto {
  @IsString()
  @IsEnum(['PENDING', 'SHIPPED', 'DELIVERED'])
  shippingStatus: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;
}

export interface BulkShippingNotificationItem {
  orderId: string;
  trackingNumber: string;
}

export interface BulkShippingNotificationResult {
  total: number;
  successful: number;
  failed: number;
  results: {
    orderId: string;
    success: boolean;
    error?: string;
  }[];
}
