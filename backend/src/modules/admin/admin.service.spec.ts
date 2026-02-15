import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EncryptionService } from '../../common/services/encryption.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaService;
  let eventEmitter: EventEmitter2;
  let encryptionService: EncryptionService;

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
              update: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              aggregate: jest.fn(),
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
            },
            liveStream: {
              count: jest.fn(),
            },
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            decryptAddress: jest.fn(),
            encryptAddress: jest.fn(),
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
      expect(result.users[0].totalPurchaseAmount).toBe(0); // Epic 8 placeholder
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
        instagramId: '@user_one',
        createdAt: expect.any(Date),
        lastLoginAt: expect.any(Date),
        status: 'ACTIVE',
        role: 'USER',
        totalOrders: 0,
        totalPurchaseAmount: 0,
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
    const mockUser = {
      id: userId,
      email: 'test@example.com',
      name: 'Test User',
      instagramId: '@testuser',
      depositorName: 'Test Depositor',
      shippingAddress: 'encrypted-address',
      createdAt: new Date('2026-01-15'),
      lastLoginAt: new Date('2026-01-30'),
      status: 'ACTIVE',
      role: 'USER',
      suspendedAt: null,
    };

    const mockDecryptedAddress = {
      fullName: 'John Doe',
      address1: '123 Main St',
      address2: 'Apt 4B',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
      phone: '(310) 555-0123',
    };

    it('should return user detail with decrypted address', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(encryptionService, 'decryptAddress').mockReturnValue(mockDecryptedAddress);

      const result = await service.getUserDetail(userId);

      expect(result.id).toBe(userId);
      expect(result.email).toBe('test@example.com');
      expect(result.shippingAddress).toEqual(mockDecryptedAddress);
      expect(result.statistics.totalOrders).toBe(0);
      expect(encryptionService.decryptAddress).toHaveBeenCalledWith('encrypted-address');
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(service.getUserDetail(userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle null shipping address', async () => {
      const userWithoutAddress = { ...mockUser, shippingAddress: null };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(userWithoutAddress as any);

      const result = await service.getUserDetail(userId);

      expect(result.shippingAddress).toBeNull();
    });

    it('should handle decryption error gracefully', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(encryptionService, 'decryptAddress').mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = await service.getUserDetail(userId);

      expect(result.shippingAddress).toBeNull();
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
        status: 'SUSPENDED',
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
        status: 'ACTIVE',
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('ACTIVE');
      expect(result.data.suspendedAt).toBeNull();
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(
        service.updateUserStatus(userId, { status: 'SUSPENDED' }),
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

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any, _options?: any) => {
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

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any, _options?: any) => {
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
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any, _options?: any) => {
        return callback({
          order: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        });
      });

      await expect(service.confirmOrderPayment(orderId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.confirmOrderPayment(orderId)).rejects.toThrow(
        'Order not found',
      );
    });

    it('should throw BadRequestException when payment already confirmed', async () => {
      const confirmedOrder = {
        ...mockOrder,
        paymentStatus: 'CONFIRMED',
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any, _options?: any) => {
        return callback({
          order: {
            findUnique: jest.fn().mockResolvedValue(confirmedOrder),
          },
        });
      });

      await expect(service.confirmOrderPayment(orderId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.confirmOrderPayment(orderId)).rejects.toThrow(
        'Payment already confirmed',
      );
    });

    it('should not emit event when order not found', async () => {
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any, _options?: any) => {
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

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any, _options?: any) => {
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

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any, _options?: any) => {
        return callback({
          order: {
            findUnique: mockFindUnique,
            update: mockUpdate,
          },
        });
      });

      await expect(service.confirmOrderPayment(orderId)).rejects.toThrow(
        'Database error',
      );

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
      jest.spyOn(prisma.order, 'count')
        .mockResolvedValueOnce(25) // last 7 days
        .mockResolvedValueOnce(20) // previous 7 days
        .mockResolvedValueOnce(5); // pending payments

      // Mock revenue aggregates
      jest.spyOn(prisma.order, 'aggregate')
        .mockResolvedValueOnce({ _sum: { total: 500000 } } as any) // last 7 days
        .mockResolvedValueOnce({ _sum: { total: 400000 } } as any); // previous 7 days

      // Mock active live streams count
      jest.spyOn(prisma.liveStream, 'count').mockResolvedValue(2);

      // Mock top products
      // @ts-expect-error - Complex Prisma groupBy type
      jest.spyOn(prisma.orderItem, 'groupBy').mockResolvedValue([
        { productId: 'p1', productName: 'Product 1', _sum: { quantity: 50 } },
        { productId: 'p2', productName: 'Product 2', _sum: { quantity: 40 } },
        { productId: 'p3', productName: 'Product 3', _sum: { quantity: 30 } },
      ]);

      // Mock chat message counts
      jest.spyOn(prisma.chatMessage, 'count')
        .mockResolvedValueOnce(150) // last 7 days
        .mockResolvedValueOnce(120); // previous 7 days

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
      jest.spyOn(prisma.order, 'count')
        .mockResolvedValueOnce(30) // last 7 days
        .mockResolvedValueOnce(20); // previous 7 days

      jest.spyOn(prisma.order, 'aggregate')
        .mockResolvedValueOnce({ _sum: { total: 600000 } } as any)
        .mockResolvedValueOnce({ _sum: { total: 400000 } } as any);

      jest.spyOn(prisma.order, 'count').mockResolvedValueOnce(30).mockResolvedValueOnce(20).mockResolvedValueOnce(0);
      jest.spyOn(prisma.liveStream, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.orderItem, 'groupBy').mockResolvedValue([] as any);
      jest.spyOn(prisma.chatMessage, 'count').mockResolvedValueOnce(100).mockResolvedValueOnce(100);

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
});
