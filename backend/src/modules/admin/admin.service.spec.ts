import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaService;
  let eventEmitter: EventEmitter2;

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
            },
            chatMessage: {
              count: jest.fn(),
            },
            auditLog: {
              findMany: jest.fn(),
            },
            systemConfig: {
              findFirst: jest.fn(),
              create: jest.fn(),
              upsert: jest.fn(),
            },
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
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

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
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

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
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
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
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

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
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
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          order: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        });
      });

      try {
        await service.confirmOrderPayment(orderId);
      } catch (error) {
        // Expected to throw
      }

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should not emit event when payment already confirmed', async () => {
      const confirmedOrder = {
        ...mockOrder,
        paymentStatus: 'CONFIRMED',
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          order: {
            findUnique: jest.fn().mockResolvedValue(confirmedOrder),
          },
        });
      });

      try {
        await service.confirmOrderPayment(orderId);
      } catch (error) {
        // Expected to throw
      }

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const mockFindUnique = jest.fn().mockResolvedValue(mockOrder);
      const mockUpdate = jest.fn().mockRejectedValue(new Error('Database error'));

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
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
});
