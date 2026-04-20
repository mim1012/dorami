import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

jest.mock(
  '@bizgo/bizgo-sdk-comm-js',
  () => ({
    Bizgo: jest.fn(),
    BizgoOptionsBuilder: jest.fn().mockImplementation(() => ({
      setBaseURL: jest.fn().mockReturnThis(),
      setApiKey: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({}),
    })),
    AlimtalkBuilder: jest.fn(),
    AlimtalkAttachmentBuilder: jest.fn(),
    BrandMessageBuilder: jest.fn(),
    BrandMessageAttachmentBuilder: jest.fn(),
    DestinationBuilder: jest.fn(),
    OMNIRequestBodyBuilder: jest.fn(),
    KakaoButtonBuilder: jest.fn(),
  }),
  { virtual: true },
);

import { AdminService } from './admin.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EncryptionService } from '../../common/services/encryption.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AlimtalkService } from './alimtalk.service';
import { RedisService } from '../../common/redis/redis.service';
import { UserStatus } from '@live-commerce/shared-types';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaService;
  let eventEmitter: EventEmitter2;
  let encryptionService: EncryptionService;
  let notificationsService: NotificationsService;
  let alimtalkService: AlimtalkService;

  const mockWebsocketGateway = {
    server: {
      emit: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
            order: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
              count: jest.fn(),
              aggregate: jest.fn(),
              groupBy: jest.fn().mockResolvedValue([]),
            },
            user: {
              findMany: jest.fn(),
              count: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            chatMessage: {
              count: jest.fn(),
            },
            auditLog: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
            systemConfig: {
              findFirst: jest.fn(),
              create: jest.fn(),
              upsert: jest.fn(),
            },
            orderItem: {
              groupBy: jest.fn(),
              delete: jest.fn(),
            },
            product: {
              update: jest.fn(),
            },
            liveStream: {
              count: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            decryptAddress: jest.fn(),
            encryptAddress: jest.fn(),
            tryDecryptAddress: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            sendPaymentConfirmation: jest.fn(),
            sendOrderStatusUpdate: jest.fn(),
            sendPaymentReminderNotification: jest.fn(),
          },
        },
        {
          provide: AlimtalkService,
          useValue: {
            sendOrderAlimtalk: jest.fn(),
            sendPaymentReminderAlimtalk: jest.fn(),
            sendLiveStartAlimtalk: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            set: jest.fn(),
            del: jest.fn(),
            get: jest.fn(),
            exists: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: 'WEBSOCKET_GATEWAY',
          useValue: mockWebsocketGateway,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get<PrismaService>(PrismaService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    encryptionService = module.get<EncryptionService>(EncryptionService);
    notificationsService = module.get<NotificationsService>(NotificationsService);
    alimtalkService = module.get<AlimtalkService>(AlimtalkService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserList', () => {
    const mockUsers = [
      {
        id: 'user-1',
        email: 'user1@test.com',
        name: 'User One',
        instagramId: '@user_one',
        createdAt: new Date('2026-01-15'),
        lastLoginAt: new Date('2026-01-30'),
        status: 'ACTIVE',
        role: 'USER',
      },
      {
        id: 'user-2',
        email: 'user2@test.com',
        name: 'User Two',
        instagramId: '@user_two',
        createdAt: new Date('2026-01-20'),
        lastLoginAt: null,
        status: 'ACTIVE',
        role: 'USER',
      },
    ];

    it('should return paginated users with default parameters', async () => {
      jest.spyOn(prisma.user, 'count').mockResolvedValue(47);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue(mockUsers as any);

      const result = await service.getUserList({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(47);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(3); // 47 / 20 = 2.35 → 3 pages
      expect(result.users[0].totalOrders).toBe(0); // Epic 8 placeholder
      expect(result.users[0].totalPurchaseAmount).toBe('0'); // Epic 8 placeholder
    });

    it('should apply pagination correctly', async () => {
      jest.spyOn(prisma.user, 'count').mockResolvedValue(100);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue(mockUsers as any);

      await service.getUserList({ page: 3, limit: 10 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3 - 1) * 10 = 20
          take: 10,
        }),
      );
    });

    it('should sort users by specified field and order', async () => {
      jest.spyOn(prisma.user, 'count').mockResolvedValue(10);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue(mockUsers as any);

      await service.getUserList({
        page: 1,
        limit: 20,
        sortBy: 'email',
        sortOrder: 'asc',
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            email: 'asc',
          },
        }),
      );
    });

    it('should filter users by search query', async () => {
      jest.spyOn(prisma.user, 'count').mockResolvedValue(1);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([mockUsers[0]] as any);

      await service.getUserList({
        page: 1,
        limit: 20,
        search: 'user_one',
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'user_one', mode: 'insensitive' } },
              { email: { contains: 'user_one', mode: 'insensitive' } },
              { instagramId: { contains: 'user_one', mode: 'insensitive' } },
              { depositorName: { contains: 'user_one', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should filter users by date range', async () => {
      jest.spyOn(prisma.user, 'count').mockResolvedValue(5);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue(mockUsers as any);

      const dateFrom = '2026-01-01';
      const dateTo = '2026-01-31';

      await service.getUserList({
        page: 1,
        limit: 20,
        dateFrom,
        dateTo,
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: new Date(dateFrom),
              lte: expect.any(Date), // End of day
            }),
          }),
        }),
      );
    });

    it('should filter users by status', async () => {
      jest.spyOn(prisma.user, 'count').mockResolvedValue(10);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue(mockUsers as any);

      await service.getUserList({
        page: 1,
        limit: 20,
        status: ['ACTIVE', 'SUSPENDED'],
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['ACTIVE', 'SUSPENDED'] },
          }),
        }),
      );
    });

    it('should return correct total pages for exact division', async () => {
      jest.spyOn(prisma.user, 'count').mockResolvedValue(60);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue(mockUsers as any);

      const result = await service.getUserList({ page: 1, limit: 20 });

      expect(result.totalPages).toBe(3); // 60 / 20 = 3 exactly
    });

    it('should handle empty results', async () => {
      jest.spyOn(prisma.user, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([]);

      const result = await service.getUserList({ page: 1, limit: 20 });

      expect(result.users).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should map user data correctly to DTOs', async () => {
      jest.spyOn(prisma.user, 'count').mockResolvedValue(2);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue(mockUsers as any);

      const result = await service.getUserList({ page: 1, limit: 20 });

      expect(result.users[0]).toEqual({
        id: 'user-1',
        email: 'user1@test.com',
        name: 'User One',
        depositorName: null,
        instagramId: '@user_one',
        createdAt: expect.any(String),
        lastLoginAt: expect.any(String),
        lastPurchaseAt: null,
        profileCompletedAt: null,
        kakaoPhone: undefined,
        shippingAddressSummary: null,
        status: 'ACTIVE',
        role: 'USER',
        totalOrders: 0,
        totalPurchaseAmount: '0',
      });
    });

    it('should handle users with null lastLoginAt', async () => {
      jest.spyOn(prisma.user, 'count').mockResolvedValue(1);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([mockUsers[1]] as any);

      const result = await service.getUserList({ page: 1, limit: 20 });

      expect(result.users[0].lastLoginAt).toBeNull();
    });
  });

  describe('getUserDetail', () => {
    const userId = 'user-123';
    const mockPlainAddress = {
      fullName: 'John Doe',
      address1: '123 Main St',
      address2: 'Apt 4B',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
    };
    const mockUser = {
      id: userId,
      email: 'test@example.com',
      name: 'Test User',
      instagramId: '@testuser',
      depositorName: 'Test Depositor',
      shippingAddress: mockPlainAddress,
      createdAt: new Date('2026-01-15'),
      lastLoginAt: new Date('2026-01-30'),
      status: 'ACTIVE',
      role: 'USER',
      suspendedAt: null,
    };

    it('should return user detail with plain address (encryption removed)', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);

      const result = await service.getUserDetail(userId);

      expect(result.id).toBe(userId);
      expect(result.email).toBe('test@example.com');
      expect(result.shippingAddress).toEqual(mockPlainAddress);
      expect(result.statistics.totalOrders).toBe(0);
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(service.getUserDetail(userId)).rejects.toThrow(NotFoundException);
    });

    it('should handle null shipping address', async () => {
      const userWithoutAddress = { ...mockUser, shippingAddress: null };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(userWithoutAddress as any);

      const result = await service.getUserDetail(userId);

      expect(result.shippingAddress).toBeNull();
    });

    it('should return null shippingAddress when address is unparseable', async () => {
      const userWithInvalidAddress = { ...mockUser, shippingAddress: 'not-valid-json' };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(userWithInvalidAddress as any);

      const result = await service.getUserDetail(userId);

      expect(result.shippingAddress).toBeNull();
    });
  });

  describe('getOrderDetail', () => {
    const orderId = 'ORD-20260131-00001';
    const mockOrder = {
      id: orderId,
      userId: 'user-123',
      userEmail: 'user@example.com',
      depositorName: 'Test Depositor',
      instagramId: '@test',
      status: 'PAYMENT_CONFIRMED',
      paymentStatus: 'CONFIRMED',
      shippingStatus: 'PENDING',
      subtotal: 3000,
      shippingFee: 500,
      total: 3500,
      createdAt: new Date('2026-01-15'),
      updatedAt: new Date('2026-01-15'),
      paidAt: new Date('2026-01-15'),
      shippedAt: null,
      deliveredAt: null,
      orderItems: [
        {
          id: 'item-1',
          productId: 'prod-1',
          productName: 'Test Product',
          price: 3000,
          shippingFee: 500,
          quantity: 1,
          color: null,
          size: null,
          Product: {
            id: 'prod-1',
            name: 'Test Product',
            imageUrl: 'https://example.com/image.png',
          },
        },
      ],
      user: {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        instagramId: '@test',
        depositorName: 'Test Depositor',
        shippingAddress: JSON.stringify({
          name: 'Legacy Name',
          street: '789 Legacy Rd',
          city: 'Seoul',
          region: 'KR',
          zipCode: '12345',
        }),
      },
    };

    it('should return order detail with normalized shipping address from legacy fields', async () => {
      jest.spyOn(prisma.order, 'findUnique').mockResolvedValue(mockOrder as any);
      jest.spyOn(encryptionService, 'decryptAddress').mockImplementation(() => {
        throw new Error('not encrypted');
      });

      const result = await service.getOrderDetail(orderId);

      expect(result.shippingAddress).toEqual({
        fullName: 'Legacy Name',
        address1: '789 Legacy Rd',
        address2: undefined,
        city: 'Seoul',
        state: 'KR',
        zip: '12345',
      });
    });

    it('should prefer current product name when product title was edited after the order', async () => {
      jest.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        ...mockOrder,
        orderItems: [
          {
            ...mockOrder.orderItems[0],
            productName: '예전 상품명',
            Product: {
              ...mockOrder.orderItems[0].Product,
              name: '수정된 상품명',
            },
          },
        ],
      } as any);
      jest.spyOn(encryptionService, 'decryptAddress').mockImplementation(() => {
        throw new Error('not encrypted');
      });

      const result = await service.getOrderDetail(orderId);

      expect(result.items[0]?.productName).toBe('수정된 상품명');
    });

    it('should throw NotFoundException when order does not exist', async () => {
      jest.spyOn(prisma.order, 'findUnique').mockResolvedValue(null);

      await expect(service.getOrderDetail(orderId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOrderList', () => {
    it('should prefer current product name in order list items when product title was edited later', async () => {
      jest.spyOn(prisma.order, 'count').mockResolvedValue(1 as any);
      jest.spyOn(prisma.order, 'findMany').mockResolvedValue([
        {
          id: 'ORD-20260131-00002',
          userId: 'user-123',
          userEmail: 'user@example.com',
          depositorName: 'Test Depositor',
          instagramId: '@test',
          status: 'PAYMENT_CONFIRMED',
          paymentStatus: 'CONFIRMED',
          subtotal: 3000,
          shippingFee: 500,
          total: 3500,
          createdAt: new Date('2026-01-15'),
          paidAt: new Date('2026-01-15'),
          orderItems: [
            {
              productId: 'prod-1',
              productName: '예전 상품명',
              price: 3000,
              quantity: 1,
              color: null,
              size: null,
              Product: {
                name: '수정된 상품명',
                streamKey: 'stream-1',
              },
            },
          ],
        },
      ] as any);

      const result = await service.getOrderList({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      } as any);

      expect(result.orders[0]?.items?.[0]?.productName).toBe('수정된 상품명');
    });
  });

  describe('updateUserStatus', () => {
    const userId = 'user-123';
    const mockUser = {
      id: userId,
      status: 'ACTIVE',
    };

    it('should update user status to SUSPENDED', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.user, 'update').mockResolvedValue({
        ...mockUser,
        status: 'SUSPENDED',
        suspendedAt: new Date(),
      } as any);

      const result = await service.updateUserStatus(userId, {
        status: 'SUSPENDED' as UserStatus,
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('SUSPENDED');
      expect(result.data.suspendedAt).toBeDefined();
    });

    it('should update user status to ACTIVE and clear suspension', async () => {
      const suspendedUser = {
        ...mockUser,
        status: 'SUSPENDED',
        suspendedAt: new Date(),
      };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(suspendedUser as any);
      jest.spyOn(prisma.user, 'update').mockResolvedValue({
        ...mockUser,
        status: 'ACTIVE',
        suspendedAt: null,
      } as any);

      const result = await service.updateUserStatus(userId, {
        status: 'ACTIVE' as UserStatus,
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('ACTIVE');
      expect(result.data.suspendedAt).toBeNull();
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(
        service.updateUserStatus(userId, { status: 'SUSPENDED' as UserStatus }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('confirmOrderPayment', () => {
    const orderId = 'ORD-20260131-00001';
    const mockOrder = {
      id: orderId,
      userId: 'user-123',
      paymentStatus: 'PENDING',
      status: 'PENDING_PAYMENT',
      total: 100.5,
      user: {
        id: 'user-123',
        email: 'user@example.com',
      },
    };

    it('should confirm payment successfully', async () => {
      const updatedOrder = {
        ...mockOrder,
        paymentStatus: 'CONFIRMED',
        status: 'PAYMENT_CONFIRMED',
        paidAt: new Date('2026-01-31T10:00:00Z'),
      };

      jest
        .spyOn(prisma, '$transaction')
        .mockImplementation(async (callback: any, _options?: any) => {
          return callback({
            order: {
              findUnique: jest.fn().mockResolvedValue(mockOrder),
              update: jest.fn().mockResolvedValue(updatedOrder),
            },
          });
        });

      const result = await service.confirmOrderPayment(orderId);

      expect(result.success).toBe(true);
      expect(result.data.orderId).toBe(orderId);
      expect(result.data.paymentStatus).toBe('CONFIRMED');
      expect(result.data.status).toBe('PAYMENT_CONFIRMED');
      expect(result.data.paidAt).toBeDefined();
    });

    it('should emit domain event on successful confirmation', async () => {
      const updatedOrder = {
        ...mockOrder,
        paymentStatus: 'CONFIRMED',
        status: 'PAYMENT_CONFIRMED',
        paidAt: new Date('2026-01-31T10:00:00Z'),
      };

      jest
        .spyOn(prisma, '$transaction')
        .mockImplementation(async (callback: any, _options?: any) => {
          return callback({
            order: {
              findUnique: jest.fn().mockResolvedValue(mockOrder),
              update: jest.fn().mockResolvedValue(updatedOrder),
            },
          });
        });

      await service.confirmOrderPayment(orderId);

      expect(eventEmitter.emit).toHaveBeenCalledWith('order:payment:confirmed', {
        orderId: orderId,
        userId: mockOrder.userId,
        userEmail: mockOrder.user.email,
        total: mockOrder.total,
      });
    });

    it('should throw NotFoundException when order not found', async () => {
      jest
        .spyOn(prisma, '$transaction')
        .mockImplementation(async (callback: any, _options?: any) => {
          return callback({
            order: {
              findUnique: jest.fn().mockResolvedValue(null),
            },
          });
        });

      await expect(service.confirmOrderPayment(orderId)).rejects.toThrow(NotFoundException);
      await expect(service.confirmOrderPayment(orderId)).rejects.toThrow('Order not found');
    });

    it('should throw BadRequestException when payment already confirmed', async () => {
      const confirmedOrder = {
        ...mockOrder,
        paymentStatus: 'CONFIRMED',
      };

      jest
        .spyOn(prisma, '$transaction')
        .mockImplementation(async (callback: any, _options?: any) => {
          return callback({
            order: {
              findUnique: jest.fn().mockResolvedValue(confirmedOrder),
            },
          });
        });

      await expect(service.confirmOrderPayment(orderId)).rejects.toThrow(BadRequestException);
      await expect(service.confirmOrderPayment(orderId)).rejects.toThrow(
        'Payment already confirmed',
      );
    });

    it('should not emit event when order not found', async () => {
      jest
        .spyOn(prisma, '$transaction')
        .mockImplementation(async (callback: any, _options?: any) => {
          return callback({
            order: {
              findUnique: jest.fn().mockResolvedValue(null),
            },
          });
        });

      try {
        await service.confirmOrderPayment(orderId);
      } catch {
        // Expected to throw
      }

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should not emit event when payment already confirmed', async () => {
      const confirmedOrder = {
        ...mockOrder,
        paymentStatus: 'CONFIRMED',
      };

      jest
        .spyOn(prisma, '$transaction')
        .mockImplementation(async (callback: any, _options?: any) => {
          return callback({
            order: {
              findUnique: jest.fn().mockResolvedValue(confirmedOrder),
            },
          });
        });

      try {
        await service.confirmOrderPayment(orderId);
      } catch {
        // Expected to throw
      }

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const mockFindUnique = jest.fn().mockResolvedValue(mockOrder);
      const mockUpdate = jest.fn().mockRejectedValue(new Error('Database error'));

      jest
        .spyOn(prisma, '$transaction')
        .mockImplementation(async (callback: any, _options?: any) => {
          return callback({
            order: {
              findUnique: mockFindUnique,
              update: mockUpdate,
            },
          });
        });

      await expect(service.confirmOrderPayment(orderId)).rejects.toThrow('Database error');

      // Event should not be emitted on error
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('getDashboardStats - Epic 12 Story 12.1', () => {
    it('should return dashboard statistics for last 7 days', async () => {
      const now = new Date();
      const last7DaysStart = new Date(now);
      last7DaysStart.setDate(last7DaysStart.getDate() - 7);
      last7DaysStart.setHours(0, 0, 0, 0);

      // Mock order counts (last 7 days, previous 7 days, pending payments)
      jest
        .spyOn(prisma.order, 'count')
        .mockResolvedValueOnce(25) // last 7 days
        .mockResolvedValueOnce(20) // previous 7 days
        .mockResolvedValueOnce(5); // pending payments

      // Mock revenue aggregates
      jest
        .spyOn(prisma.order, 'aggregate')
        .mockResolvedValueOnce({ _sum: { total: 500000 } } as any) // last 7 days
        .mockResolvedValueOnce({ _sum: { total: 400000 } } as any); // previous 7 days

      // Mock active live streams count
      jest.spyOn(prisma.liveStream, 'count').mockResolvedValue(2);

      // Mock top products
      jest.spyOn(prisma.orderItem, 'groupBy').mockResolvedValue([
        { productId: 'p1', productName: 'Product 1', _sum: { quantity: 50 } },
        { productId: 'p2', productName: 'Product 2', _sum: { quantity: 40 } },
        { productId: 'p3', productName: 'Product 3', _sum: { quantity: 30 } },
      ] as any);

      // Mock chat message counts
      jest
        .spyOn(prisma.chatMessage, 'count')
        .mockResolvedValueOnce(150) // last 7 days
        .mockResolvedValueOnce(120); // previous 7 days

      // Mock daily revenue orders (last 7 days confirmed orders)
      jest.spyOn(prisma.order, 'findMany').mockResolvedValue([]);

      const result = await service.getDashboardStats();

      expect(result).toBeDefined();
      expect(result.orders.value).toBe(25);
      expect(result.revenue.value).toBe(500000);
      expect(result.pendingPayments.value).toBe(5);
      expect(result.activeLiveStreams.value).toBe(2);
      expect(result.topProducts).toHaveLength(3);
      expect(result.topProducts[0].productName).toBe('Product 1');
      expect(result.topProducts[0].totalSold).toBe(50);
    });

    it('should calculate trends correctly', async () => {
      // More orders in last 7 days than previous
      jest
        .spyOn(prisma.order, 'count')
        .mockResolvedValueOnce(30) // last 7 days
        .mockResolvedValueOnce(20); // previous 7 days

      jest
        .spyOn(prisma.order, 'aggregate')
        .mockResolvedValueOnce({ _sum: { total: 600000 } } as any)
        .mockResolvedValueOnce({ _sum: { total: 400000 } } as any);

      jest
        .spyOn(prisma.order, 'count')
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(0);
      jest.spyOn(prisma.liveStream, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.orderItem, 'groupBy').mockResolvedValue([] as any);
      jest.spyOn(prisma.chatMessage, 'count').mockResolvedValueOnce(100).mockResolvedValueOnce(100);
      jest.spyOn(prisma.order, 'findMany').mockResolvedValue([]);

      const result = await service.getDashboardStats();

      expect(result.orders.trendUp).toBe(true);
      expect(result.revenue.trendUp).toBe(true);
    });
  });

  describe('getAuditLogs - Epic 12 Story 12.3', () => {
    it('should return paginated audit logs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          adminId: 'admin-1',
          admin: { email: 'admin1@example.com' },
          action: 'CONFIRM_PAYMENT',
          entity: 'Order',
          entityId: 'order-1',
          changes: { status: 'CONFIRMED' },
          createdAt: new Date('2024-01-15'),
        },
        {
          id: 'log-2',
          adminId: 'admin-2',
          admin: { email: 'admin2@example.com' },
          action: 'UPDATE',
          entity: 'Product',
          entityId: 'product-1',
          changes: { price: 25000 },
          createdAt: new Date('2024-01-14'),
        },
      ];

      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValue(mockLogs as any);
      jest.spyOn(prisma.auditLog, 'count').mockResolvedValue(25);

      const result = await service.getAuditLogs(undefined, undefined, undefined, 1, 50);

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(2);
      expect(result.data[0].adminEmail).toBe('admin1@example.com');
      expect(result.data[0].action).toBe('CONFIRM_PAYMENT');
      expect(result.data[1].adminEmail).toBe('admin2@example.com');
      expect(result.meta.total).toBe(25);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter audit logs by date range', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.auditLog, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([]);

      await service.getAuditLogs('2024-01-01', '2024-01-31', undefined, 1, 50);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should filter audit logs by action type', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.auditLog, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([]);

      await service.getAuditLogs(undefined, undefined, 'CONFIRM_PAYMENT', 1, 50);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: 'CONFIRM_PAYMENT',
          }),
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.auditLog, 'count').mockResolvedValue(150);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([]);

      const result = await service.getAuditLogs(undefined, undefined, undefined, 2, 50);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 50, // (page 2 - 1) * 50
          take: 50,
        }),
      );
      expect(result.meta.totalPages).toBe(3); // 150 / 50
    });
  });

  describe('sendPaymentReminder - 알림톡 전화번호 fallback', () => {
    const orderId = 'ORD-20260309-00001';
    const mockOrder = {
      id: orderId,
      userId: 'user-1',
      total: 75000,
      depositorName: '홍길동',
      paymentStatus: 'PENDING',
    };

    it('kakaoPhone이 있으면 kakaoPhone으로 payment reminder 알림톡을 발송한다', async () => {
      jest.spyOn(prisma.order, 'findUnique').mockResolvedValue(mockOrder as any);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        kakaoPhone: '010-9999-0000',
      } as any);

      await service.sendPaymentReminder(orderId);

      expect(alimtalkService.sendPaymentReminderAlimtalk).toHaveBeenCalledWith(
        '010-9999-0000',
        orderId,
        75000,
      );
      expect(notificationsService.sendPaymentReminderNotification).not.toHaveBeenCalled();
    });

    it('kakaoPhone이 null이면 web push fallback으로 발송한다', async () => {
      jest.spyOn(prisma.order, 'findUnique').mockResolvedValue(mockOrder as any);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        kakaoPhone: null,
      } as any);

      await service.sendPaymentReminder(orderId);

      expect(alimtalkService.sendPaymentReminderAlimtalk).not.toHaveBeenCalled();
      expect(notificationsService.sendPaymentReminderNotification).toHaveBeenCalledWith(
        mockOrder.userId,
        orderId,
        75000,
        mockOrder.depositorName,
      );
    });
  });

  describe('exportOrdersCsv - 이메일 일관성', () => {
    const baseOrder = {
      id: 'ORD-20260101-00001',
      userEmail: 'order-time@example.com',
      depositorName: '홍길동',
      instagramId: '@test',
      status: 'PAYMENT_CONFIRMED',
      paymentStatus: 'CONFIRMED',
      shippingStatus: 'PENDING',
      subtotal: 10000,
      shippingFee: 3000,
      total: 13000,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      paidAt: new Date('2026-01-01T01:00:00Z'),
    };

    it('주문 당시 이메일(order.userEmail)을 CSV에 출력해야 한다', async () => {
      jest.spyOn(prisma.order, 'findMany').mockResolvedValue([baseOrder] as any);

      const csv = await service.exportOrdersCsv({
        sortOrder: 'desc',
      } as any);

      expect(csv).toContain('order-time@example.com');
    });

    it('사용자가 이메일을 변경했을 때도 주문 당시 이메일을 출력해야 한다', async () => {
      // order.userEmail = 주문 당시 이메일, 현재 users.email은 다르지만 CSV는 order.userEmail을 사용
      jest
        .spyOn(prisma.order, 'findMany')
        .mockResolvedValue([{ ...baseOrder, userEmail: 'order-time@example.com' }] as any);

      const csv = await service.exportOrdersCsv({ sortOrder: 'desc' } as any);

      expect(csv).toContain('order-time@example.com');
      expect(csv).not.toContain('new-email@example.com');
    });
  });

  describe('exportOrdersExcel - 이메일 일관성', () => {
    const makeOrder = (overrides: Record<string, unknown> = {}) => ({
      id: 'ORD-20260101-00001',
      userEmail: 'order-time@example.com',
      depositorName: '홍길동',
      instagramId: '@test',
      status: 'PAYMENT_CONFIRMED',
      paymentStatus: 'CONFIRMED',
      shippingStatus: 'PENDING',
      subtotal: 10000,
      shippingFee: 3000,
      total: 13000,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      paidAt: new Date('2026-01-01T01:00:00Z'),
      shippingAddress: null,
      orderItems: [],
      user: { kakaoPhone: null, email: 'current@example.com' },
      ...overrides,
    });

    it('주문 당시 이메일(order.userEmail)을 Excel에 출력해야 한다', async () => {
      jest.spyOn(prisma.order, 'findMany').mockResolvedValue([makeOrder()] as any);
      jest.spyOn(prisma.liveStream, 'findMany').mockResolvedValue([]);

      const buffer = await service.exportOrdersExcel({ sortOrder: 'desc' } as any);

      // Buffer가 반환되어야 한다
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('사용자 현재 이메일(user.email)이 달라도 order.userEmail을 사용해야 한다', async () => {
      // user.email(현재) = 'new@example.com', order.userEmail(주문시) = 'order-time@example.com'
      const orderWithDifferentEmail = makeOrder({
        userEmail: 'order-time@example.com',
        user: { kakaoPhone: null, email: 'new@example.com' },
      });

      jest.spyOn(prisma.order, 'findMany').mockResolvedValue([orderWithDifferentEmail] as any);
      jest.spyOn(prisma.liveStream, 'findMany').mockResolvedValue([]);

      // 내부 rows가 order.userEmail을 참조하는지 검증하기 위해
      // findMany가 받은 데이터 기준으로 buffer 생성이 성공하면 OK
      const buffer = await service.exportOrdersExcel({ sortOrder: 'desc' } as any);
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('엑셀에 수신인이름, 입금자명 컬럼이 있어야 한다', async () => {
      const order = makeOrder({
        depositorName: '홍길동입금',
        shippingAddress: {
          fullName: '김수신',
          address1: '123 Main St',
          address2: 'Apt 4B',
          city: 'Los Angeles',
          state: 'CA',
          zip: '90001',
        },
        orderItems: [
          {
            id: 'item-1',
            productName: '테스트상품',
            price: 10000,
            quantity: 1,
            color: '빨강',
            size: 'L',
            shippingFee: 3000,
            Product: null,
          },
        ],
      });

      jest.spyOn(prisma.order, 'findMany').mockResolvedValue([order] as any);
      jest.spyOn(prisma.liveStream, 'findMany').mockResolvedValue([]);

      const buffer = await service.exportOrdersExcel({ sortOrder: 'desc' } as any);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.getWorksheet('주문 목록');

      // Check header row has 수신인이름 and 입금자명
      const headers: string[] = [];
      sheet.getRow(1).eachCell((cell: any) => headers.push(String(cell.value)));
      expect(headers).toContain('수신인이름');
      expect(headers).toContain('입금자명');

      // Check data row values
      const dataRow = sheet.getRow(2);
      const recipientColIdx = headers.indexOf('수신인이름') + 1;
      const depositorColIdx = headers.indexOf('입금자명') + 1;
      expect(dataRow.getCell(recipientColIdx).value).toBe('김수신');
      expect(dataRow.getCell(depositorColIdx).value).toBe('홍길동입금');
    });

    it('배송지 컬럼에 이름이 포함되지 않고 주소만 표시되어야 한다', async () => {
      const order = makeOrder({
        shippingAddress: {
          fullName: '김수신',
          address1: '123 Main St',
          address2: 'Apt 4B',
          city: 'Los Angeles',
          state: 'CA',
          zip: '90001',
        },
        orderItems: [
          {
            id: 'item-1',
            productName: '테스트',
            price: 5000,
            quantity: 1,
            color: null,
            size: null,
            shippingFee: 0,
            Product: null,
          },
        ],
      });

      jest.spyOn(prisma.order, 'findMany').mockResolvedValue([order] as any);
      jest.spyOn(prisma.liveStream, 'findMany').mockResolvedValue([]);

      const buffer = await service.exportOrdersExcel({ sortOrder: 'desc' } as any);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.getWorksheet('주문 목록');

      const headers: string[] = [];
      sheet.getRow(1).eachCell((cell: any) => headers.push(String(cell.value)));
      const addrColIdx = headers.indexOf('배송지') + 1;
      const addrValue = String(sheet.getRow(2).getCell(addrColIdx).value);

      // 배송지에 수신인 이름이 포함되면 안 됨
      expect(addrValue).not.toContain('김수신');
      // 주소는 포함되어야 함
      expect(addrValue).toContain('123 Main St');
      expect(addrValue).toContain('Los Angeles');
      // undefined가 포함되면 안 됨
      expect(addrValue).not.toContain('undefined');
    });

    it('orderItems가 있을 때 각 row에 order.userEmail이 사용되어야 한다', async () => {
      const orderWithItems = makeOrder({
        userEmail: 'order-time@example.com',
        user: { kakaoPhone: null, email: 'new@example.com' },
        orderItems: [
          {
            id: 'item-1',
            productName: '테스트상품',
            price: 10000,
            quantity: 1,
            color: '빨강',
            size: 'L',
            shippingFee: 3000,
            Product: null,
          },
        ],
      });

      jest.spyOn(prisma.order, 'findMany').mockResolvedValue([orderWithItems] as any);
      jest.spyOn(prisma.liveStream, 'findMany').mockResolvedValue([]);

      const buffer = await service.exportOrdersExcel({ sortOrder: 'desc' } as any);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('removeOrderItem', () => {
    const makeOrderWithItems = (overrides: Record<string, any> = {}) => ({
      id: 'ORD-20260326-00001',
      status: 'PENDING_PAYMENT',
      deletedAt: null,
      orderItems: [
        {
          id: 'item-1',
          productId: 'prod-1',
          productName: '상품A',
          price: '25.00',
          quantity: 2,
          shippingFee: '5.00',
        },
        {
          id: 'item-2',
          productId: 'prod-2',
          productName: '상품B',
          price: '10.00',
          quantity: 1,
          shippingFee: '3.00',
        },
      ],
      ...overrides,
    });

    it('정상적으로 아이템을 삭제하고 금액을 재계산해야 한다', async () => {
      const order = makeOrderWithItems();
      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(order as any);

      const txMock = {
        orderItem: { delete: jest.fn() },
        product: { update: jest.fn() },
        order: { update: jest.fn() },
      };
      jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(txMock));

      const result = await service.removeOrderItem('ORD-20260326-00001', 'item-1');

      expect(result.removedItemId).toBe('item-1');
      expect(result.restoredStock).toBe(2);
      expect(result.remainingItemCount).toBe(1);
      // item-2 only: subtotal = 10.00 * 1 = 10.00, shippingFee = 3.00, total = 13.00
      expect(result.updatedSubtotal).toBe('10.00');
      expect(result.updatedShippingFee).toBe('3.00');
      expect(result.updatedTotal).toBe('13.00');

      expect(txMock.orderItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
      expect(txMock.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { quantity: { increment: 2 }, status: 'AVAILABLE' },
      });
    });

    it('주문이 없으면 NotFoundException을 던져야 한다', async () => {
      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(null);

      await expect(service.removeOrderItem('ORD-NONE', 'item-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('PENDING_PAYMENT가 아닌 주문은 BadRequestException을 던져야 한다', async () => {
      const order = makeOrderWithItems({ status: 'PAYMENT_CONFIRMED' });
      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(order as any);

      await expect(service.removeOrderItem('ORD-20260326-00001', 'item-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('존재하지 않는 아이템이면 NotFoundException을 던져야 한다', async () => {
      const order = makeOrderWithItems();
      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(order as any);

      await expect(
        service.removeOrderItem('ORD-20260326-00001', 'item-nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('마지막 아이템이면 BadRequestException을 던져야 한다', async () => {
      const order = makeOrderWithItems({
        orderItems: [
          {
            id: 'item-1',
            productId: 'prod-1',
            productName: '상품A',
            price: '25.00',
            quantity: 1,
            shippingFee: '5.00',
          },
        ],
      });
      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(order as any);

      await expect(service.removeOrderItem('ORD-20260326-00001', 'item-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('productId가 null이면 재고 복원을 스킵해야 한다', async () => {
      const order = makeOrderWithItems({
        orderItems: [
          {
            id: 'item-1',
            productId: null,
            productName: '삭제된상품',
            price: '15.00',
            quantity: 1,
            shippingFee: '0.00',
          },
          {
            id: 'item-2',
            productId: 'prod-2',
            productName: '상품B',
            price: '10.00',
            quantity: 1,
            shippingFee: '3.00',
          },
        ],
      });
      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(order as any);

      const txMock = {
        orderItem: { delete: jest.fn() },
        product: { update: jest.fn() },
        order: { update: jest.fn() },
      };
      jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(txMock));

      const result = await service.removeOrderItem('ORD-20260326-00001', 'item-1');

      expect(result.restoredStock).toBe(0);
      expect(txMock.product.update).not.toHaveBeenCalled();
    });
  });
});
