import {
  IsEmail,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsObject,
  IsEnum,
  IsArray,
  ArrayMinSize,
  IsNumber,
  IsBoolean,
  IsNotEmpty,
  Matches,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Role, UserStatus, OrderStatus, PaymentStatus, ShippingStatus } from '@prisma/client';
import {
  KAKAO_PHONE_MESSAGE,
  PHONE_PAYLOAD_PATTERN,
} from '../../../common/validators/phone-number.validator';

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
  @Transform(({ value }) => {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [value];
  })
  status?: string[];
}

export class UserListItemDto {
  id!: string;
  email!: string;
  name!: string;
  depositorName!: string | null;
  kakaoPhone!: string | null;
  instagramId!: string | null;
  shippingAddressSummary?: string | null;
  profileCompletedAt!: string | null;
  createdAt!: string;
  lastLoginAt!: string | null;
  lastPurchaseAt?: string | null;
  status!: UserStatus;
  role!: Role;
  totalOrders!: number;
  totalPurchaseAmount!: string;
}

export class UserListResponseDto {
  users!: UserListItemDto[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}

// Dashboard Stats DTOs
export class StatItemDto {
  value!: number;
  formatted!: string;
  trend!: string;
  trendUp!: boolean;
}

export class TopProductDto {
  productId!: string;
  productName!: string;
  totalSold!: number;
}

export class OptionSalesDto {
  option!: string;
  sales!: number;
}

export class DailyRevenueDto {
  date!: string;
  revenue!: number;
  orderCount!: number;
}

export class DashboardStatsDto {
  revenue!: StatItemDto;
  viewers!: StatItemDto;
  orders!: StatItemDto;
  messages!: StatItemDto;
  // Epic 12 Story 12.1: Additional dashboard metrics
  pendingPayments!: { value: number; formatted: string };
  activeLiveStreams!: { value: number; formatted: string };
  topProducts!: TopProductDto[];
  optionSales?: OptionSalesDto[];
  dailyRevenue!: DailyRevenueDto[];
}

// Live Status DTOs
export class LiveStatusDto {
  isLive!: boolean;
  streamId!: string | null;
  streamKey!: string | null;
  title!: string | null;
  duration!: string | null; // HH:MM:SS format
  viewerCount!: number;
  thumbnailUrl!: string | null;
  startedAt!: string | null;
}

// Recent Activities DTOs
export class ActivityLogDto {
  id!: string;
  type!: string;
  message!: string;
  timestamp!: string;
  metadata?: Record<string, unknown>;
}

export class RecentActivitiesDto {
  activities!: ActivityLogDto[];
  total!: number;
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
  text!: string | null;
  fontSize!: number;
  fontFamily!: string;
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
  @IsEnum(['createdAt', 'paidAt', 'total', 'status', 'id'])
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
  @Transform(({ value }) => {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [value];
  })
  orderStatus?: string[];

  // Payment status filter (array)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [value];
  })
  paymentStatus?: string[];

  // Shipping status filter (array)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [value];
  })
  shippingStatus?: string[];

  // Amount range filter
  @IsOptional()
  @Transform(({ value }) => (value ? parseFloat(value) : undefined))
  minAmount?: number;

  @IsOptional()
  @Transform(({ value }) => (value ? parseFloat(value) : undefined))
  maxAmount?: number;

  // StreamKey filter
  @IsOptional()
  @IsString()
  streamKey?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class OrderListItemDto {
  id!: string;
  userId!: string;
  userEmail!: string;
  depositorName!: string;
  instagramId!: string;
  status!: OrderStatus;
  paymentStatus!: PaymentStatus;
  shippingStatus!: ShippingStatus;
  subtotal!: string;
  shippingFee!: string;
  total!: string;
  itemCount!: number;
  createdAt!: string;
  paidAt!: string | null;
  shippedAt!: string | null;
  deliveredAt!: string | null;
  streamKey!: string | null;
  items?: Array<{
    productName: string;
    quantity: number;
    color?: string | null;
    size?: string | null;
  }>;
}

export class OrderListResponseDto {
  orders!: OrderListItemDto[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}

// User Detail DTOs
export class ShippingAddressDto {
  fullName!: string;
  address1!: string;
  address2?: string;
  city!: string;
  state!: string;
  zip!: string;
}

export class UserStatisticsDto {
  totalOrders!: number;
  totalPurchaseAmount!: string;
  averageOrderValue!: number;
  orderFrequency!: number; // orders per month
}

export class UpdateAdminUserAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  address1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address2?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{2}$/, {
    message: 'State must be 2-letter US code',
  })
  state!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{5}(-\d{4})?$/, {
    message: 'ZIP code must be in format 12345 or 12345-6789',
  })
  zip!: string;
}

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEmail()
  @IsNotEmpty()
  email?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  depositorName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^@?[a-zA-Z0-9._]+$/, {
    message: 'Instagram ID must contain only letters, numbers, periods, and underscores',
  })
  @Transform(({ value }: { value: string }) => {
    if (!value) {
      return value;
    }
    return value.startsWith('@') ? value : `@${value}`;
  })
  instagramId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(PHONE_PAYLOAD_PATTERN, {
    message: KAKAO_PHONE_MESSAGE,
  })
  kakaoPhone?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateAdminUserAddressDto)
  shippingAddress?: UpdateAdminUserAddressDto;
}

export class UserDetailDto {
  id!: string;
  email!: string;
  name!: string;
  kakaoPhone?: string;
  instagramId!: string | null;
  depositorName!: string | null;
  shippingAddress!: ShippingAddressDto | null;
  createdAt!: string;
  lastLoginAt!: string | null;
  status!: UserStatus;
  role!: Role;
  suspendedAt!: string | null;
  statistics!: UserStatisticsDto;
}

export class UpdateUserStatusDto {
  @IsString()
  @IsEnum(UserStatus, {
    message: 'status must be one of ACTIVE, INACTIVE, SUSPENDED',
  })
  status!: UserStatus;

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
  @IsString()
  venmoEmail?: string;

  @IsOptional()
  @IsString()
  venmoRecipientName?: string;

  @IsOptional()
  @IsString()
  businessRegistrationNumber?: string;

  @IsOptional()
  @IsString()
  businessAddress?: string;

  @IsOptional()
  @IsString()
  onlineSalesRegistrationNumber?: string;

  @IsOptional()
  @IsBoolean()
  freeShippingEnabled?: boolean;
}

// Shipping Messages DTO
export class UpdateShippingMessagesDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  preparing!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  shipped!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  inTransit!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  delivered!: string;
}

// Home featured products configuration DTO
export class UpdateHomeFeaturedProductsDto {
  @IsArray()
  @IsObject({ each: true })
  items!: Record<string, unknown>[];
}

// Marketing campaigns configuration DTO
export class UpdateMarketingCampaignsDto {
  @IsArray()
  @IsObject({ each: true })
  items!: Record<string, unknown>[];
}

// Payment providers configuration DTO
export class UpdatePaymentProvidersDto {
  @IsArray()
  @IsObject({ each: true })
  items!: Record<string, unknown>[];
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
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}

export class UpdateOrderShippingStatusDto {
  @IsString()
  @IsEnum(['PENDING', 'SHIPPED', 'DELIVERED'])
  shippingStatus!: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;
}

export class BulkUpdateOrderStatusDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  orderIds!: string[];

  @IsString()
  status!: string;
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
