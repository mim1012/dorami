import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { isCaliforniaAddress } from '../../common/utils/address.util';
import { RedisService } from '../../common/redis/redis.service';
import { InventoryService } from './inventory.service';
import {
  CreateOrderDto,
  OrderResponseDto,
  OrderStatus,
  PaymentStatus,
  ShippingStatus,
} from './dto/order.dto';
import {
  OrderNotFoundException,
  BusinessException,
} from '../../common/exceptions/business.exception';
import { Decimal } from '@prisma/client/runtime/library';
import { OrderCreatedEvent, OrderPaidEvent } from '../../common/events/order.events';
import { PointsService } from '../points/points.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PointTransactionType, Order, OrderItem, Prisma } from '@prisma/client';
import { CartStatus } from '@live-commerce/shared-types';

// Type for Order with items (optionally including Product relation)
interface OrderItemWithProduct extends OrderItem {
  Product?: { imageUrl: string | null; name?: string | null } | null;
}

interface OrderWithItems extends Order {
  orderItems: OrderItemWithProduct[];
}

// Type for order totals calculation
interface OrderTotalsInput {
  price: Decimal | number;
  quantity: number;
}

interface OrderTotals {
  subtotal: number;
  totalShippingFee: number;
  total: number;
}

// Type for bank transfer info
export interface BankTransferInfo {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  amount: number;
  depositorName: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly orderExpirationMinutes: number;

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private inventoryService: InventoryService,
    private pointsService: PointsService,
    private notificationsService: NotificationsService,
    private eventEmitter: EventEmitter2,
    private configService: ConfigService,
  ) {
    this.orderExpirationMinutes = this.configService.get<number>('ORDER_EXPIRATION_MINUTES', 10);
  }

  private getDisplayProductName(item: OrderItemWithProduct): string {
    return item.Product?.name?.trim() || item.productName;
  }
