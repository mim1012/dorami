import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ReservationService } from './reservation.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ReservationService', () => {
  let service: ReservationService;
  let prisma: PrismaService;
  let eventEmitter: EventEmitter2;

  const mockProduct = {
    id: 'product-1',
    name: 'Test Product',
    price: 10000,
    quantity: 5,
    status: 'AVAILABLE',
    timerEnabled: true,
    timerDuration: 10,
  };

  const mockReservation = {
    id: 'reservation-1',
    userId: 'user-1',
    productId: 'product-1',
    productName: 'Test Product',
    quantity: 1,
    reservationNumber: 1,
    status: 'WAITING',
    promotedAt: null,
    expiresAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
            product: {
              findUnique: jest.fn(),
            },
            reservation: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
              aggregate: jest.fn(),
              updateMany: jest.fn(),
            },
            cart: {
              aggregate: jest.fn(),
              updateMany: jest.fn(),
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
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'RESERVATION_PROMOTION_TIMER_MINUTES') {
                return 10;
              }
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ReservationService>(ReservationService);
    prisma = module.get<PrismaService>(PrismaService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createReservation', () => {
    it('should create a reservation when stock is insufficient', async () => {
      const createDto = { productId: 'product-1', quantity: 1 };

      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(mockProduct as any);
      jest.spyOn(prisma.cart, 'aggregate').mockResolvedValue({ _sum: { quantity: 5 } } as any);
      jest
        .spyOn(prisma.reservation, 'aggregate')
        .mockResolvedValue({ _sum: { quantity: 0 } } as any);
      jest.spyOn(prisma.reservation, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.reservation, 'count').mockResolvedValue(0);

      // Mock $transaction to execute the callback with a mocked transaction context
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          reservation: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockReservation),
          },
        });
      });

      const result = await service.createReservation('user-1', createDto);

      expect(result).toBeDefined();
      expect(result.status).toBe('WAITING');
      expect(result.reservationNumber).toBe(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith('reservation:created', expect.any(Object));
    });

    it('should throw BadRequestException when stock is available', async () => {
      const createDto = { productId: 'product-1', quantity: 1 };

      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(mockProduct as any);
      jest.spyOn(prisma.cart, 'aggregate').mockResolvedValue({ _sum: { quantity: 2 } } as any);
      jest
        .spyOn(prisma.reservation, 'aggregate')
        .mockResolvedValue({ _sum: { quantity: 0 } } as any);

      await expect(service.createReservation('user-1', createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when already reserved', async () => {
      const createDto = { productId: 'product-1', quantity: 1 };

      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(mockProduct as any);
      jest.spyOn(prisma.cart, 'aggregate').mockResolvedValue({ _sum: { quantity: 5 } } as any);
      jest
        .spyOn(prisma.reservation, 'aggregate')
        .mockResolvedValue({ _sum: { quantity: 0 } } as any);
      jest.spyOn(prisma.reservation, 'findFirst').mockResolvedValue(mockReservation as any);

      await expect(service.createReservation('user-1', createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when product not found', async () => {
      const createDto = { productId: 'product-1', quantity: 1 };

      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(null);

      await expect(service.createReservation('user-1', createDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('promoteNextInQueue', () => {
    it('should promote next waiting reservation', async () => {
      const waitingReservation = {
        ...mockReservation,
        status: 'WAITING',
      };

      jest.spyOn(prisma.reservation, 'findFirst').mockResolvedValue(waitingReservation as any);
      jest.spyOn(prisma.reservation, 'update').mockResolvedValue({
        ...waitingReservation,
        status: 'PROMOTED',
        promotedAt: new Date(),
        expiresAt: new Date(),
      } as any);

      await service.promoteNextInQueue('product-1');

      expect(prisma.reservation.update).toHaveBeenCalledWith({
        where: { id: waitingReservation.id },
        data: expect.objectContaining({
          status: 'PROMOTED',
          promotedAt: expect.any(Date),
          expiresAt: expect.any(Date),
        }),
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith('reservation:promoted', expect.any(Object));
    });

    it('should not promote when no waiting reservations', async () => {
      jest.spyOn(prisma.reservation, 'findFirst').mockResolvedValue(null);

      await service.promoteNextInQueue('product-1');

      expect(prisma.reservation.update).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('expirePromotedReservations', () => {
    it('should expire and re-promote when timer expires and next person exists', async () => {
      const expiredReservation = {
        ...mockReservation,
        status: 'PROMOTED',
        promotedAt: new Date(Date.now() - 11 * 60 * 1000), // 11 minutes ago
        expiresAt: new Date(Date.now() - 1 * 60 * 1000), // 1 minute ago
      };

      const nextReservation = {
        ...mockReservation,
        id: 'reservation-2',
        reservationNumber: 2,
        status: 'WAITING',
      };

      jest.spyOn(prisma.reservation, 'findMany').mockResolvedValue([expiredReservation] as any);
      jest.spyOn(prisma.reservation, 'update').mockResolvedValueOnce({
        ...expiredReservation,
        status: 'EXPIRED',
      } as any);
      jest.spyOn(prisma.reservation, 'findFirst').mockResolvedValueOnce(nextReservation as any); // Next in queue
      jest.spyOn(prisma.reservation, 'update').mockResolvedValueOnce({
        ...nextReservation,
        status: 'PROMOTED',
      } as any);

      await service.expirePromotedReservations();

      expect(prisma.reservation.update).toHaveBeenCalledWith({
        where: { id: expiredReservation.id },
        data: { status: 'EXPIRED' },
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith('reservation:promoted', expect.any(Object));
    });

    it('should not expire when no promoted reservations expired', async () => {
      jest.spyOn(prisma.reservation, 'findMany').mockResolvedValue([]);

      await service.expirePromotedReservations();

      expect(prisma.reservation.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('cancelReservation', () => {
    it('should cancel waiting reservation without promotion', async () => {
      jest.spyOn(prisma.reservation, 'findFirst').mockResolvedValue(mockReservation as any);
      jest.spyOn(prisma.reservation, 'update').mockResolvedValue({
        ...mockReservation,
        status: 'CANCELLED',
      } as any);

      await service.cancelReservation('user-1', 'reservation-1');

      expect(prisma.reservation.update).toHaveBeenCalledWith({
        where: { id: 'reservation-1' },
        data: { status: 'CANCELLED' },
      });
    });

    it('should cancel promoted reservation and trigger promotion', async () => {
      const promotedReservation = {
        ...mockReservation,
        status: 'PROMOTED',
        promotedAt: new Date(),
        expiresAt: new Date(),
      };

      const nextReservation = {
        ...mockReservation,
        id: 'reservation-2',
        reservationNumber: 2,
        status: 'WAITING',
      };

      jest.spyOn(prisma.reservation, 'findFirst').mockResolvedValueOnce(promotedReservation as any);
      jest.spyOn(prisma.reservation, 'update').mockResolvedValueOnce({
        ...promotedReservation,
        status: 'CANCELLED',
      } as any);
      jest.spyOn(prisma.reservation, 'findFirst').mockResolvedValueOnce(nextReservation as any); // Next in queue
      jest.spyOn(prisma.reservation, 'update').mockResolvedValueOnce({
        ...nextReservation,
        status: 'PROMOTED',
      } as any);

      await service.cancelReservation('user-1', 'reservation-1');

      expect(prisma.reservation.update).toHaveBeenCalledWith({
        where: { id: 'reservation-1' },
        data: { status: 'CANCELLED' },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('reservation:promoted', expect.any(Object));
    });

    it('should throw NotFoundException when reservation not found', async () => {
      jest.spyOn(prisma.reservation, 'findFirst').mockResolvedValue(null);

      await expect(service.cancelReservation('user-1', 'reservation-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserReservations', () => {
    it('should return user reservations with queue positions', async () => {
      const reservations = [
        { ...mockReservation, reservationNumber: 3, status: 'WAITING' },
        {
          ...mockReservation,
          id: 'reservation-2',
          reservationNumber: 1,
          status: 'PROMOTED',
          promotedAt: new Date(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      ];

      jest.spyOn(prisma.reservation, 'findMany').mockResolvedValue(reservations as any);
      jest.spyOn(prisma.reservation, 'count').mockResolvedValue(2); // 2 people ahead in queue

      const result = await service.getUserReservations('user-1');

      expect(result.reservations).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.waitingCount).toBe(1);
      expect(result.promotedCount).toBe(1);
    });
  });

  describe('getQueuePosition', () => {
    it('should calculate correct queue position for waiting reservation', async () => {
      jest.spyOn(prisma.reservation, 'count').mockResolvedValue(3); // 3 people ahead

      const position = await (service as any).getQueuePosition('product-1', 5);

      expect(position).toBe(4); // Position starts at 1, so 3 ahead = position 4
      expect(prisma.reservation.count).toHaveBeenCalledWith({
        where: {
          productId: 'product-1',
          status: 'WAITING',
          reservationNumber: {
            lt: 5,
          },
        },
      });
    });

    it('should return 1 when first in queue', async () => {
      jest.spyOn(prisma.reservation, 'count').mockResolvedValue(0); // No one ahead

      const position = await (service as any).getQueuePosition('product-1', 1);

      expect(position).toBe(1); // Position starts at 1
    });
  });
});
