import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { InventoryService } from './inventory.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PointsService } from '../points/points.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('OrdersService - createOrderFromCart', () => {
  let service: OrdersService;
  let prismaService: PrismaService;
  let redisService: RedisService;
  let eventEmitter: EventEmitter2;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    depositorName: 'Test Depositor',
    instagramId: '@testuser',
    shippingAddress: {
      fullName: 'Test User',
      address1: '123 Test St',
      city: 'Test City',
      state: 'CA',
      zip: '12345',
      phone: '(123) 456-7890',
    },
  };

  const mockCartItems = [
    {
      id: 'cart-1',
      userId: 'user-123',
      productId: 'product-1',
      productName: 'Test Product 1',
      price: new Decimal(100),
      quantity: 2,
      shippingFee: new Decimal(10),
      color: 'Red',
      size: 'M',
      timerEnabled: true,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      product: {
        id: 'product-1',
        name: 'Test Product 1',
        price: new Decimal(100),
        shippingFee: new Decimal(10),
      },
    },
    {
      id: 'cart-2',
      userId: 'user-123',
      productId: 'product-2',
      productName: 'Test Product 2',
      price: new Decimal(50),
      quantity: 1,
      shippingFee: new Decimal(5),
      color: null,
      size: null,
      timerEnabled: false,
      expiresAt: null,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      product: {
        id: 'product-2',
        name: 'Test Product 2',
        price: new Decimal(50),
        shippingFee: new Decimal(5),
      },
    },
  ];

  const mockOrder = {
    id: 'ORD-20260204-00001',
    userId: 'user-123',
    userEmail: 'test@example.com',
    depositorName: 'Test Depositor',
    instagramId: '@testuser',
    shippingAddress: mockUser.shippingAddress,
    status: 'PENDING_PAYMENT',
    paymentMethod: 'BANK_TRANSFER',
    paymentStatus: 'PENDING',
    shippingStatus: 'PENDING',
    subtotal: new Decimal(250), // (100*2) + (50*1)
    shippingFee: new Decimal(15), // 10 + 5
    total: new Decimal(265), // 250 + 15
    paidAt: null,
    shippedAt: null,
    deliveredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    orderItems: [
      {
        id: 'order-item-1',
        orderId: 'ORD-20260204-00001',
        productId: 'product-1',
        productName: 'Test Product 1',
        price: new Decimal(100),
        quantity: 2,
        shippingFee: new Decimal(10),
        color: 'Red',
        size: 'M',
      },
      {
        id: 'order-item-2',
        orderId: 'ORD-20260204-00001',
        productId: 'product-2',
        productName: 'Test Product 2',
        price: new Decimal(50),
        quantity: 1,
        shippingFee: new Decimal(5),
        color: null,
        size: null,
      },
    ],
  }
