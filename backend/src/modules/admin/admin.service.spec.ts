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
