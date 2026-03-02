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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
            user: {
              findUnique: jest.fn(),
            },
            cart: {
              findMany: jest.fn(),
              updateMany: jest.fn(),
            },
            order: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            product: {
              findUnique: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
            },
            liveStream: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            systemConfig: {
              findFirst: jest.fn().mockResolvedValue({
                defaultShippingFee: 10,
                caShippingFee: 8,
                freeShippingEnabled: false,
                freeShippingThreshold: 150,
              }),
            },
          },
        },
        {
          provide: RedisService,
          useValue: {
            set: jest.fn(),
            del: jest.fn(),
            incr: jest.fn().mockResolvedValue(1),
            expire: jest.fn(),
          },
        },
        {
          provide: InventoryService,
          useValue: {
            batchDecreaseStock: jest.fn(),
            batchDecreaseStockTx: jest.fn().mockResolvedValue(undefined),
            restoreStock: jest.fn(),
          },
        },
        {
          provide: PointsService,
          useValue: {
            createTransaction: jest.fn(),
            getUserPoints: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            sendNotification: jest.fn(),
            createNotification: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(10),
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            decryptAddress: jest.fn((v) => v),
            encryptAddress: jest.fn((v) => v),
          },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prismaService = module.get<PrismaService>(PrismaService);
    redisService = module.get<RedisService>(RedisService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful Order Creation', () => {
    it('should create order from cart with all fields correctly populated', async () => {
      // Arrange
      const mockTransaction = jest.fn(async (callback) => {
        const tx = {
          user: { findUnique: jest.fn().mockResolvedValue(mockUser) },
          cart: {
            findMany: jest.fn().mockResolvedValue(mockCartItems),
            updateMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          order: { create: jest.fn().mockResolvedValue(mockOrder) },
        };
        return callback(tx);
      });
      prismaService.$transaction = mockTransaction as any;
      jest.spyOn(redisService, 'incr').mockResolvedValue(1);

      // Act
      const result = await service.createOrderFromCart('user-123');

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toMatch(/^ORD-\d{8}-\d{5}$/);
      expect(result.userId).toBe('user-123');
      expect(result.status).toBe('PENDING_PAYMENT');
      expect(result.total).toBe('265');
      expect(result.items).toHaveLength(2);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('should calculate totals correctly (subtotal + shipping)', async () => {
      // Arrange
      const mockTransaction = jest.fn(async (callback) => {
        const tx = {
          user: { findUnique: jest.fn().mockResolvedValue(mockUser) },
          cart: {
            findMany: jest.fn().mockResolvedValue(mockCartItems),
            updateMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          order: { create: jest.fn().mockResolvedValue(mockOrder) },
        };
        return callback(tx);
      });
      prismaService.$transaction = mockTransaction as any;

      // Act
      const result = await service.createOrderFromCart('user-123');

      // Assert
      expect(result.subtotal).toBe('250'); // (100*2) + (50*1)
      expect(result.shippingFee).toBe('15'); // 10 + 5
      expect(result.total).toBe('265'); // 250 + 15
    });

    it('should update cart items status to COMPLETED', async () => {
      // Arrange
      let updateManyCalled = false;
      const mockTransaction = jest.fn(async (callback) => {
        const tx = {
          user: { findUnique: jest.fn().mockResolvedValue(mockUser) },
          cart: {
            findMany: jest.fn().mockResolvedValue(mockCartItems),
            updateMany: jest.fn().mockImplementation(async (args) => {
              updateManyCalled = true;
              expect(args.where.userId).toBe('user-123');
              expect(args.where.status).toBe('ACTIVE');
              expect(args.data.status).toBe('COMPLETED');
              return { count: 2 };
            }),
          },
          order: { create: jest.fn().mockResolvedValue(mockOrder) },
        };
        return callback(tx);
      });
      prismaService.$transaction = mockTransaction as any;

      // Act
      await service.createOrderFromCart('user-123');

      // Assert
      expect(updateManyCalled).toBe(true);
    });

    it('should emit order:created domain event with correct payload', async () => {
      // Arrange
      const mockTransaction = jest.fn(async (callback) => {
        const tx = {
          user: { findUnique: jest.fn().mockResolvedValue(mockUser) },
          cart: {
            findMany: jest.fn().mockResolvedValue(mockCartItems),
            updateMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          order: { create: jest.fn().mockResolvedValue(mockOrder) },
        };
        return callback(tx);
      });
      prismaService.$transaction = mockTransaction as any;

      // Act
      await service.createOrderFromCart('user-123');

      // Assert
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'order:created',
        expect.objectContaining({
          orderId: expect.stringMatching(/^ORD-\d{8}-\d{5}$/),
          userId: 'user-123',
          totalAmount: 265,
          items: expect.arrayContaining([
            expect.objectContaining({
              productId: 'product-1',
              quantity: 2,
              priceAtPurchase: 100,
            }),
            expect.objectContaining({
              productId: 'product-2',
              quantity: 1,
              priceAtPurchase: 50,
            }),
          ]),
        }),
      );
    });

    it('should generate unique order ID in ORD-YYYYMMDD-XXXXX format', async () => {
      // Arrange
      const mockTransaction = jest.fn(async (callback) => {
        const tx = {
          user: { findUnique: jest.fn().mockResolvedValue(mockUser) },
          cart: {
            findMany: jest.fn().mockResolvedValue(mockCartItems),
            updateMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          order: { create: jest.fn().mockResolvedValue(mockOrder) },
        };
        return callback(tx);
      });
      prismaService.$transaction = mockTransaction as any;

      // Mock Redis incr to return sequential numbers
      jest.spyOn(redisService, 'incr').mockResolvedValue(123);

      // Act
      const result = await service.createOrderFromCart('user-123');

      // Assert
      expect(result.id).toMatch(/^ORD-\d{8}-\d{5}$/);
      const parts = result.id.split('-');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('ORD');
      expect(parts[1]).toHaveLength(8); // YYYYMMDD
      expect(parts[2]).toHaveLength(5); // Sequential number padded
    });
  });

  describe('Error Handling', () => {
    it('should throw BusinessException when user not found', async () => {
      // Arrange
      const mockTransaction = jest.fn(async (callback) => {
        const tx = {
          user: { findUnique: jest.fn().mockResolvedValue(null) },
        };
        return callback(tx);
      });
      prismaService.$transaction = mockTransaction as any;

      // Act & Assert
      await expect(service.createOrderFromCart('invalid-user')).rejects.toThrow(BusinessException);
      await expect(service.createOrderFromCart('invalid-user')).rejects.toThrow('USER_NOT_FOUND');
    });

    it('should throw BusinessException when cart is empty', async () => {
      // Arrange
      const mockTransaction = jest.fn(async (callback) => {
        const tx = {
          user: { findUnique: jest.fn().mockResolvedValue(mockUser) },
          cart: {
            findMany: jest.fn().mockResolvedValue([]), // Empty cart
          },
        };
        return callback(tx);
      });
      prismaService.$transaction = mockTransaction as any;

      // Act & Assert
      await expect(service.createOrderFromCart('user-123')).rejects.toThrow(BusinessException);
      await expect(service.createOrderFromCart('user-123')).rejects.toThrow('CART_EMPTY');
    });

    it('should throw BusinessException when cart items are expired', async () => {
      // Arrange
      const expiredCartItems = [
        {
          ...mockCartItems[0],
          timerEnabled: true,
          expiresAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        },
      ];

      const mockTransaction = jest.fn(async (callback) => {
        const tx = {
          user: { findUnique: jest.fn().mockResolvedValue(mockUser) },
          cart: {
            findMany: jest.fn().mockResolvedValue(expiredCartItems),
          },
        };
        return callback(tx);
      });
      prismaService.$transaction = mockTransaction as any;

      // Act & Assert
      await expect(service.createOrderFromCart('user-123')).rejects.toThrow(BusinessException);
      await expect(service.createOrderFromCart('user-123')).rejects.toThrow('CART_ITEMS_EXPIRED');
    });

    it('should rollback transaction on database error', async () => {
      // Arrange
      const mockTransaction = jest.fn(async (callback) => {
        const tx = {
          user: { findUnique: jest.fn().mockResolvedValue(mockUser) },
          cart: {
            findMany: jest.fn().mockResolvedValue(mockCartItems),
            updateMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          order: {
            create: jest.fn().mockRejectedValue(new Error('Database error')),
          },
        };
        return callback(tx);
      });
      prismaService.$transaction = mockTransaction as any;

      // Act & Assert
      await expect(service.createOrderFromCart('user-123')).rejects.toThrow('Database error');

      // Verify transaction was attempted
      expect(mockTransaction).toHaveBeenCalledTimes(1);

      // Verify event was NOT emitted (because transaction failed)
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should not emit event when order creation fails', async () => {
      // Arrange
      const mockTransaction = jest.fn(async (callback) => {
        const tx = {
          user: { findUnique: jest.fn().mockResolvedValue(mockUser) },
          cart: {
            findMany: jest.fn().mockResolvedValue(mockCartItems),
          },
          order: {
            create: jest.fn().mockRejectedValue(new Error('Create failed')),
          },
        };
        return callback(tx);
      });
      prismaService.$transaction = mockTransaction as any;

      // Act & Assert
      await expect(service.createOrderFromCart('user-123')).rejects.toThrow();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('Transaction Atomicity', () => {
    it('should execute all operations within a single transaction', async () => {
      // Arrange
      const mockTransaction = jest.fn(async (callback) => {
        const tx = {
          user: { findUnique: jest.fn().mockResolvedValue(mockUser) },
          cart: {
            findMany: jest.fn().mockResolvedValue(mockCartItems),
            updateMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          order: { create: jest.fn().mockResolvedValue(mockOrder) },
        };
        return callback(tx);
      });
      prismaService.$transaction = mockTransaction as any;

      // Act
      await service.createOrderFromCart('user-123');

      // Assert
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function), expect.any(Object));
    });
  });
});
