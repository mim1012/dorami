/**
 * Shared TypeScript Type Definitions
 * Live Commerce Platform - Frontend & Backend
 *
 * These types match the Prisma schema and API contract
 * Use this package in both frontend and backend for type safety
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum StreamStatus {
  PENDING = 'PENDING',
  LIVE = 'LIVE',
  OFFLINE = 'OFFLINE',
}

export enum ModerationAction {
  DELETE_MESSAGE = 'DELETE_MESSAGE',
  MUTE = 'MUTE',
  BAN = 'BAN',
}

export enum ProductStatus {
  AVAILABLE = 'AVAILABLE',
  SOLD_OUT = 'SOLD_OUT',
}

export enum CartStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  COMPLETED = 'COMPLETED',
}

export enum ReservationStatus {
  WAITING = 'WAITING',
  PROMOTED = 'PROMOTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum PaymentMethod {
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

export enum ShippingStatus {
  PENDING = 'PENDING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
}

export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum SettlementStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
}

// Epic 13: Reward Points
export enum PointTransactionType {
  EARNED_ORDER = 'EARNED_ORDER',
  USED_ORDER = 'USED_ORDER',
  REFUND_CANCELLED = 'REFUND_CANCELLED',
  MANUAL_ADD = 'MANUAL_ADD',
  MANUAL_SUBTRACT = 'MANUAL_SUBTRACT',
  EXPIRED = 'EXPIRED',
}

// ============================================================================
// BASE TYPES
// ============================================================================

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp?: string;
  path?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: Pagination;
}

// ============================================================================
// ENTITY TYPES
// ============================================================================

export interface User {
  id: string;
  email: string;
  kakaoId: string;
  name: string;
  role: Role;
  status: UserStatus;
  depositorName?: string;
  instagramId?: string;
  shippingAddress?: ShippingAddress;
  createdAt: string;
  lastLoginAt?: string;
  updatedAt: string;
}

export interface LiveStream {
  id: string;
  streamKey: string;
  userId: string;
  status: StreamStatus;
  startedAt?: string;
  endedAt?: string;
  expiresAt: string;
  createdAt: string;
  rtmpUrl?: string;
  playbackUrl?: string;
}

export interface LiveStreamWithProducts extends LiveStream {
  products: Product[];
}

export interface ChatMessage {
  id: string;
  streamKey: string;
  userId: string;
  user?: {
    id: string;
    name: string;
    instagramId?: string;
  };
  content: string;
  timestamp: string;
  isDeleted: boolean;
}

export interface ModerationLog {
  id: string;
  adminId: string;
  action: ModerationAction;
  targetId: string;
  reason?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  streamKey: string;
  name: string;
  price: number;
  stock: number;
  colorOptions: string[];
  sizeOptions: string[];
  shippingFee: number;
  freeShippingMessage?: string;
  timerEnabled: boolean;
  timerDuration: number;
  imageUrl?: string;
  isNew?: boolean;
  discountRate?: number;
  originalPrice?: number;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Cart {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  price: string; // Decimal as string
  quantity: number;
  color?: string;
  size?: string;
  shippingFee: string; // Decimal as string
  timerEnabled: boolean;
  expiresAt?: string;
  status: CartStatus;
  createdAt: string;
  updatedAt: string;
  product?: {
    imageUrl?: string;
    status: ProductStatus;
  };
}

export interface CartSummary {
  items: Cart[];
  summary: {
    subtotal: string;
    totalShippingFee: string;
    total: string;
    itemCount: number;
  };
}

export interface Reservation {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  quantity: number;
  reservationNumber: number;
  status: ReservationStatus;
  promotedAt?: string;
  expiresAt?: string;
  createdAt: string;
  product?: {
    imageUrl?: string;
    price: string;
    status: ProductStatus;
  };
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  price: string; // Decimal as string
  quantity: number;
  color?: string;
  size?: string;
  shippingFee: string; // Decimal as string
}

export interface Order {
  id: string; // ORD-YYYYMMDD-XXXXX format
  userId: string;
  userEmail: string;
  depositorName: string;
  shippingAddress: ShippingAddress;
  instagramId: string;
  subtotal: string; // Decimal as string
  shippingFee: string; // Decimal as string
  total: string; // Decimal as string
  pointsEarned: number;
  pointsUsed: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  shippingStatus: ShippingStatus;
  status: OrderStatus;
  paidAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
  orderItems: OrderItem[];
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: string;
  template: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  entity: string;
  entityId: string;
  changes: {
    before: Record<string, any>;
    after: Record<string, any>;
  };
  createdAt: string;
}

export interface SystemConfig {
  id: string;
  key: string;
  value: any;
  createdAt: string;
  updatedAt: string;
}

export interface Settlement {
  id: string;
  sellerId: string;
  periodStart: string;
  periodEnd: string;
  totalSales: string; // Decimal as string
  commission: string; // Decimal as string
  settlementAmount: string; // Decimal as string
  status: SettlementStatus;
  createdAt: string;
  updatedAt: string;
}

// Epic 13: Reward Points Entities
export interface PointBalance {
  id: string;
  userId: string;
  currentBalance: number;
  lifetimeEarned: number;
  lifetimeUsed: number;
  lifetimeExpired: number;
  createdAt: string;
  updatedAt: string;
}

export interface PointTransaction {
  id: string;
  balanceId: string;
  transactionType: PointTransactionType;
  amount: number;
  balanceAfter: number;
  orderId?: string;
  reason?: string;
  expiresAt?: string;
  createdAt: string;
}

// ============================================================================
// REQUEST/RESPONSE DTOs
// ============================================================================

// Auth DTOs
export interface KakaoCallbackRequest {
  code: string;
  redirectUri: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

// User DTOs
export interface UpdateUserProfileRequest {
  name?: string;
  depositorName?: string;
  instagramId?: string;
  shippingAddress?: ShippingAddress;
}

export interface UpdateUserStatusRequest {
  status: UserStatus;
  reason?: string;
}

// LiveStream DTOs
export interface CreateLiveStreamRequest {
  expiresAt: string; // ISO 8601
}

export interface UpdateStreamStatusRequest {
  status: 'LIVE' | 'OFFLINE';
}

// Chat DTOs (WebSocket)
export interface JoinStreamEvent {
  streamKey: string;
  userId: string;
}

export interface SendMessageEvent {
  streamKey: string;
  content: string;
}

export interface DeleteMessageRequest {
  reason?: string;
}

// Product DTOs
export interface CreateProductRequest {
  streamKey: string;
  name: string;
  price: number;
  quantity: number;
  colorOptions: string[];
  sizeOptions: string[];
  shippingFee: number;
  freeShippingMessage?: string;
  timerEnabled: boolean;
  timerDuration?: number;
  imageUrl?: string;
}

export interface UpdateProductRequest {
  name?: string;
  price?: number;
  quantity?: number;
  colorOptions?: string[];
  sizeOptions?: string[];
  shippingFee?: number;
  freeShippingMessage?: string;
  timerEnabled?: boolean;
  timerDuration?: number;
  imageUrl?: string;
  status?: ProductStatus;
}

export interface ListProductsQuery {
  streamKey?: string;
  status?: ProductStatus;
  page?: number;
  limit?: number;
}

// Cart DTOs
export interface AddToCartRequest {
  productId: string;
  quantity: number;
  color?: string;
  size?: string;
}

export interface UpdateCartItemRequest {
  quantity?: number;
  color?: string;
  size?: string;
}

// Reservation DTOs
export interface CreateReservationRequest {
  productId: string;
  quantity: number;
}

export interface ListReservationsQuery {
  status?: ReservationStatus;
}

// Order DTOs
export interface CreateOrderRequest {
  cartItemIds: string[];
  depositorName: string;
  instagramId: string;
}

export interface UpdatePaymentStatusRequest {
  paymentStatus: 'CONFIRMED' | 'FAILED';
}

export interface UpdateShippingStatusRequest {
  shippingStatus: 'SHIPPED' | 'DELIVERED';
}

export interface ListOrdersQuery {
  status?: OrderStatus;
  page?: number;
  limit?: number;
}

// Notification DTOs
export interface CreateNotificationTemplateRequest {
  name: string;
  type: string;
  template: string;
}

export interface SendNotificationRequest {
  templateId: string;
  userId: string;
  variables: Record<string, string>;
}

// Admin DTOs
export interface ListAuditLogsQuery {
  adminId?: string;
  entity?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface ListModerationLogsQuery {
  adminId?: string;
  action?: ModerationAction;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// System Config DTOs
export interface SetSystemConfigRequest {
  value: any;
}

// Epic 13: Reward Points DTOs
export interface PointBalanceResponse {
  currentBalance: number;
  lifetimeEarned: number;
  lifetimeUsed: number;
  lifetimeExpired: number;
}

export interface PointTransactionHistoryQuery {
  page?: number;
  limit?: number;
  transactionType?: PointTransactionType;
  startDate?: string;
  endDate?: string;
}

export interface PointsConfigResponse {
  pointsEnabled: boolean;
  pointEarningRate: number;
  pointMinRedemption: number;
  pointMaxRedemptionPct: number;
  pointExpirationEnabled: boolean;
  pointExpirationMonths: number;
}

export interface UpdatePointsConfigRequest {
  pointsEnabled?: boolean;
  pointEarningRate?: number;
  pointMinRedemption?: number;
  pointMaxRedemptionPct?: number;
  pointExpirationEnabled?: boolean;
  pointExpirationMonths?: number;
}

export interface AdjustPointsRequest {
  type: 'add' | 'subtract';
  amount: number;
  reason: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INSUFFICIENT_STOCK'
  | 'INSUFFICIENT_POINTS'
  | 'CART_EXPIRED'
  | 'PRODUCT_SOLD_OUT'
  | 'INVALID_OPTION'
  | 'KAKAO_AUTH_FAILED'
  | 'INVALID_CODE'
  | 'INTERNAL_ERROR';

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isApiError(obj: any): obj is ApiError {
  return obj && typeof obj.code === 'string' && typeof obj.message === 'string';
}

export function isSuccessResponse<T>(
  response: ApiResponse<T>,
): response is ApiResponse<T> & { success: true; data: T } {
  return response.success === true && response.data !== undefined;
}

export function isErrorResponse(
  response: ApiResponse<any>,
): response is ApiResponse<any> & { success: false; error: ApiError } {
  return response.success === false && response.error !== undefined;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

// ============================================================================
// CONSTANTS
// ============================================================================

export const ORDER_ID_PREFIX = 'ORD-';
export const ORDER_ID_REGEX = /^ORD-\d{8}-\d{5}$/;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const DEFAULT_TIMER_DURATION = 10; // minutes

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate order ID format
 */
export function isValidOrderId(orderId: string): boolean {
  return ORDER_ID_REGEX.test(orderId);
}

/**
 * Generate order ID
 * Format: ORD-YYYYMMDD-XXXXX
 */
export function generateOrderId(sequence: number): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const seqStr = sequence.toString().padStart(5, '0');
  return `${ORDER_ID_PREFIX}${dateStr}-${seqStr}`;
}

/**
 * Parse decimal string to number (safe)
 */
export function parseDecimal(value: string): number {
  return parseFloat(value);
}

/**
 * Format number as decimal string
 */
export function formatDecimal(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

/**
 * Calculate cart total
 */
export function calculateCartTotal(items: Cart[]): {
  subtotal: string;
  totalShippingFee: string;
  total: string;
} {
  let subtotal = 0;
  let totalShippingFee = 0;

  items.forEach((item) => {
    subtotal += parseDecimal(item.price) * item.quantity;
    totalShippingFee += parseDecimal(item.shippingFee);
  });

  return {
    subtotal: formatDecimal(subtotal),
    totalShippingFee: formatDecimal(totalShippingFee),
    total: formatDecimal(subtotal + totalShippingFee),
  };
}

/**
 * Check if cart item is expired
 */
export function isCartExpired(cart: Cart): boolean {
  if (!cart.timerEnabled || !cart.expiresAt) {
    return false;
  }
  return new Date(cart.expiresAt) < new Date();
}

/**
 * Check if reservation is expired
 */
export function isReservationExpired(reservation: Reservation): boolean {
  if (!reservation.expiresAt) {
    return false;
  }
  return new Date(reservation.expiresAt) < new Date();
}

// ============================================================================
// WEBSOCKET EVENTS
// ============================================================================

export * from './events';
