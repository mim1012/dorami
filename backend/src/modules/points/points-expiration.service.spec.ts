import { Test, TestingModule } from '@nestjs/testing';
import { PointsExpirationService } from './points-expiration.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PointsService } from './points.service';
import { PointsConfigService } from './points-config.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PointTransactionType } from '@prisma/client';
import { PointsExpiringSoonEvent } from '../../common/events/points.events';

describe('PointsExpirationService', () => {
  let service: PointsExpirationService;
  let prismaService: PrismaService;
  let pointsService: PointsService;
  let pointsConfigService: PointsConfigService;
  let eventEmitter: EventEmitter2;

  const mockConfig = {
    pointsEnabled: true,
    pointExpirationEnabled: true,
    pointsPerPurchase: 100,
    pointsMinOrderAmount: 10000,
    pointExpirationMonths: 12,
    pointEarningRate: 1,
    pointMinRedemption: 100,
    pointMaxRedemptionPct: 50,
  };

  const now = new Date('2026-02-14T02:00:00.000Z');

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(now);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsExpirationService,
        {
          provide: PrismaService,
          useValue: {
            pointTransaction: {
              findMany: jest.fn(),
              updateMany: jest.fn(),
            },
            pointBalance: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: PointsService,
          useValue: {
            deductPoints: jest.fn(),
          },
        },
        {
          provide: PointsConfigService,
          useValue: {
            getPointsConfig: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PointsExpirationService>(PointsExpirationService);
    prismaService = module.get<PrismaService>(PrismaService);
    pointsService = module.get<PointsService>(PointsService);
    pointsConfigService = module.get<PointsConfigService>(PointsConfigService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('processExpirations', () => {
    it('should skip when points not enabled', async () => {
      jest.spyOn(pointsConfigService, 'getPointsConfig').mockResolvedValue({
        ...mockConfig,
        pointsEnabled: false,
      });

      await service.processExpirations();

      expect(prismaService.pointTransaction.findMany).not.toHaveBeenCalled();
    });

    it('should skip when expiration not enabled', async () => {
      jest.spyOn(pointsConfigService, 'getPointsConfig').mockResolvedValue({
        ...mockConfig,
        pointExpirationEnabled: false,
      });

      await service.processExpirations();

      expect(prismaService.pointTransaction.findMany).not.toHaveBeenCalled();
    });

    it('should return early when no expired transactions', async () => {
      jest.spyOn(pointsConfigService, 'getPointsConfig').mockResolvedValue(mockConfig);
      jest.spyOn(prismaService.pointTransaction, 'findMany').mockResolvedValueOnce([]);

      await service.processExpirations();

      expect(prismaService.pointTransaction.findMany).toHaveBeenCalledWith({
        where: {
          transactionType: PointTransactionType.EARNED_ORDER,
          expiresAt: { lte: now },
          amount: { gt: 0 },
        },
        include: { balance: true },
      });
      expect(pointsService.deductPoints).not.toHaveBeenCalled();
    });

    it('should deduct points for users with expired transactions', async () => {
      const mockExpiredTransactions = [
        {
          id: 'tx-1',
          balanceId: 'balance-1',
          amount: 500,
          transactionType: PointTransactionType.EARNED_ORDER,
          balanceAfter: 1000,
          orderId: null,
          reason: null,
          expiresAt: new Date('2026-02-13'),
          balance: {
            id: 'balance-1',
            userId: 'user-1',
            currentBalance: 1000,
            lifetimeEarned: 2000,
            lifetimeUsed: 1000,
            lifetimeExpired: 0,
            createdAt: new Date('2025-02-14'),
            updatedAt: new Date('2025-02-14'),
          },
          createdAt: new Date('2025-02-14'),
        },
      ];

      jest.spyOn(pointsConfigService, 'getPointsConfig').mockResolvedValue(mockConfig);
      jest
        .spyOn(prismaService.pointTransaction, 'findMany')
        .mockResolvedValueOnce(mockExpiredTransactions)
        .mockResolvedValueOnce([]);
      jest.spyOn(prismaService.pointBalance, 'findUnique').mockResolvedValue({
        id: 'balance-1',
        userId: 'user-1',
        currentBalance: 1000,
        lifetimeEarned: 2000,
        lifetimeUsed: 1000,
        lifetimeExpired: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      jest.spyOn(pointsService, 'deductPoints').mockResolvedValue(undefined as any);
      jest.spyOn(prismaService.pointTransaction, 'updateMany').mockResolvedValue({ count: 1 });

      await service.processExpirations();

      expect(pointsService.deductPoints).toHaveBeenCalledWith(
        'user-1',
        500,
        PointTransactionType.EXPIRED,
        undefined,
        'Points expired',
      );
      expect(prismaService.pointTransaction.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['tx-1'] } },
        data: { expiresAt: null },
      });
    });

    it("should cap expiration at user's current balance", async () => {
      const mockExpiredTransactions = [
        {
          id: 'tx-1',
          balanceId: 'balance-1',
          amount: 800,
          transactionType: PointTransactionType.EARNED_ORDER,
          balanceAfter: 500,
          orderId: null,
          reason: null,
          expiresAt: new Date('2026-02-13'),
          balance: {
            id: 'balance-1',
            userId: 'user-1',
            currentBalance: 500,
            lifetimeEarned: 1000,
            lifetimeUsed: 500,
            lifetimeExpired: 0,
            createdAt: new Date('2025-02-14'),
            updatedAt: new Date('2025-02-14'),
          },
          createdAt: new Date('2025-02-14'),
        },
      ];

      jest.spyOn(pointsConfigService, 'getPointsConfig').mockResolvedValue(mockConfig);
      jest
        .spyOn(prismaService.pointTransaction, 'findMany')
        .mockResolvedValueOnce(mockExpiredTransactions)
        .mockResolvedValueOnce([]);
      jest.spyOn(prismaService.pointBalance, 'findUnique').mockResolvedValue({
        id: 'balance-1',
        userId: 'user-1',
        currentBalance: 500,
        lifetimeEarned: 1000,
        lifetimeUsed: 500,
        lifetimeExpired: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      jest.spyOn(pointsService, 'deductPoints').mockResolvedValue(undefined as any);

      await service.processExpirations();

      expect(pointsService.deductPoints).toHaveBeenCalledWith(
        'user-1',
        500,
        PointTransactionType.EXPIRED,
        undefined,
        'Points expired',
      );
    });

    it('should skip users with zero balance', async () => {
      const mockExpiredTransactions = [
        {
          id: 'tx-1',
          balanceId: 'balance-1',
          amount: 500,
          transactionType: PointTransactionType.EARNED_ORDER,
          balanceAfter: 0,
          orderId: null,
          reason: null,
          expiresAt: new Date('2026-02-13'),
          balance: {
            id: 'balance-1',
            userId: 'user-1',
            currentBalance: 0,
            lifetimeEarned: 1000,
            lifetimeUsed: 1000,
            lifetimeExpired: 0,
            createdAt: new Date('2025-02-14'),
            updatedAt: new Date('2025-02-14'),
          },
          createdAt: new Date('2025-02-14'),
        },
      ];

      jest.spyOn(pointsConfigService, 'getPointsConfig').mockResolvedValue(mockConfig);
      jest
        .spyOn(prismaService.pointTransaction, 'findMany')
        .mockResolvedValueOnce(mockExpiredTransactions)
        .mockResolvedValueOnce([]);
      jest.spyOn(prismaService.pointBalance, 'findUnique').mockResolvedValue({
        id: 'balance-1',
        userId: 'user-1',
        currentBalance: 0,
        lifetimeEarned: 1000,
        lifetimeUsed: 1000,
        lifetimeExpired: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.processExpirations();

      expect(pointsService.deductPoints).not.toHaveBeenCalled();
    });

    it('should mark processed transactions with expiresAt: null', async () => {
      const mockExpiredTransactions = [
        {
          id: 'tx-1',
          balanceId: 'balance-1',
          amount: 300,
          transactionType: PointTransactionType.EARNED_ORDER,
          balanceAfter: 1000,
          orderId: null,
          reason: null,
          expiresAt: new Date('2026-02-13'),
          balance: {
            id: 'balance-1',
            userId: 'user-1',
            currentBalance: 1000,
            lifetimeEarned: 1500,
            lifetimeUsed: 500,
            lifetimeExpired: 0,
            createdAt: new Date('2025-02-14'),
            updatedAt: new Date('2025-02-14'),
          },
          createdAt: new Date('2025-02-14'),
        },
        {
          id: 'tx-2',
          balanceId: 'balance-1',
          amount: 200,
          transactionType: PointTransactionType.EARNED_ORDER,
          balanceAfter: 1000,
          orderId: null,
          reason: null,
          expiresAt: new Date('2026-02-12'),
          balance: {
            id: 'balance-1',
            userId: 'user-1',
            currentBalance: 1000,
            lifetimeEarned: 1500,
            lifetimeUsed: 500,
            lifetimeExpired: 0,
            createdAt: new Date('2025-02-12'),
            updatedAt: new Date('2025-02-12'),
          },
          createdAt: new Date('2025-02-12'),
        },
      ];

      jest.spyOn(pointsConfigService, 'getPointsConfig').mockResolvedValue(mockConfig);
      jest
        .spyOn(prismaService.pointTransaction, 'findMany')
        .mockResolvedValueOnce(mockExpiredTransactions)
        .mockResolvedValueOnce([]);
      jest.spyOn(prismaService.pointBalance, 'findUnique').mockResolvedValue({
        id: 'balance-1',
        userId: 'user-1',
        currentBalance: 1000,
        lifetimeEarned: 1500,
        lifetimeUsed: 500,
        lifetimeExpired: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      jest.spyOn(pointsService, 'deductPoints').mockResolvedValue(undefined as any);
      jest.spyOn(prismaService.pointTransaction, 'updateMany').mockResolvedValue({ count: 2 });

      await service.processExpirations();

      expect(prismaService.pointTransaction.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['tx-1', 'tx-2'] } },
        data: { expiresAt: null },
      });
    });

    it('should handle per-user errors gracefully', async () => {
      const mockExpiredTransactions = [
        {
          id: 'tx-1',
          balanceId: 'balance-1',
          amount: 500,
          transactionType: PointTransactionType.EARNED_ORDER,
          balanceAfter: 1000,
          orderId: null,
          reason: null,
          expiresAt: new Date('2026-02-13'),
          balance: {
            id: 'balance-1',
            userId: 'user-1',
            currentBalance: 1000,
            lifetimeEarned: 2000,
            lifetimeUsed: 1000,
            lifetimeExpired: 0,
            createdAt: new Date('2025-02-14'),
            updatedAt: new Date('2025-02-14'),
          },
          createdAt: new Date('2025-02-14'),
        },
        {
          id: 'tx-2',
          balanceId: 'balance-2',
          amount: 300,
          transactionType: PointTransactionType.EARNED_ORDER,
          balanceAfter: 500,
          orderId: null,
          reason: null,
          expiresAt: new Date('2026-02-13'),
          balance: {
            id: 'balance-2',
            userId: 'user-2',
            currentBalance: 500,
            lifetimeEarned: 1000,
            lifetimeUsed: 500,
            lifetimeExpired: 0,
            createdAt: new Date('2025-02-14'),
            updatedAt: new Date('2025-02-14'),
          },
          createdAt: new Date('2025-02-14'),
        },
      ];

      jest.spyOn(pointsConfigService, 'getPointsConfig').mockResolvedValue(mockConfig);
      jest
        .spyOn(prismaService.pointTransaction, 'findMany')
        .mockResolvedValueOnce(mockExpiredTransactions)
        .mockResolvedValueOnce([]);
      jest
        .spyOn(prismaService.pointBalance, 'findUnique')
        .mockResolvedValueOnce({
          id: 'balance-1',
          userId: 'user-1',
          currentBalance: 1000,
          lifetimeEarned: 2000,
          lifetimeUsed: 1000,
          lifetimeExpired: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'balance-2',
          userId: 'user-2',
          currentBalance: 500,
          lifetimeEarned: 1000,
          lifetimeUsed: 500,
          lifetimeExpired: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      jest
        .spyOn(pointsService, 'deductPoints')
        .mockRejectedValueOnce(new Error('Deduction failed'))
        .mockResolvedValueOnce({ newBalance: 0 });
      jest.spyOn(prismaService.pointTransaction, 'updateMany').mockResolvedValue({ count: 1 });

      await service.processExpirations();

      expect(pointsService.deductPoints).toHaveBeenCalledTimes(2);
      expect(prismaService.pointTransaction.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['tx-2'] } },
        data: { expiresAt: null },
      });
    });

    it('should call sendExpirationWarnings after processing', async () => {
      const warningDate = new Date('2026-02-21T02:00:00.000Z');

      // Mock an expired transaction that will be processed first
      const mockExpiredTransaction = {
        id: 'tx-expired',
        balanceId: 'balance-3',
        amount: 100,
        transactionType: PointTransactionType.EARNED_ORDER,
        balanceAfter: 900,
        orderId: null,
        reason: null,
        expiresAt: new Date('2026-02-13'),
        balance: {
          id: 'balance-3',
          userId: 'user-3',
          currentBalance: 900,
          lifetimeEarned: 1200,
          lifetimeUsed: 300,
          lifetimeExpired: 0,
          createdAt: new Date('2025-02-13'),
          updatedAt: new Date('2025-02-13'),
        },
        createdAt: new Date('2025-02-13'),
      };

      const mockExpiringTransactions = [
        {
          id: 'tx-3',
          balanceId: 'balance-3',
          amount: 400,
          transactionType: PointTransactionType.EARNED_ORDER,
          balanceAfter: 800,
          orderId: null,
          reason: null,
          expiresAt: new Date('2026-02-20'),
          balance: {
            id: 'balance-3',
            userId: 'user-3',
            currentBalance: 800,
            lifetimeEarned: 1200,
            lifetimeUsed: 400,
            lifetimeExpired: 0,
            createdAt: new Date('2025-02-20'),
            updatedAt: new Date('2025-02-20'),
          },
          createdAt: new Date('2025-02-20'),
        },
      ];

      jest.spyOn(pointsConfigService, 'getPointsConfig').mockResolvedValue(mockConfig);
      jest
        .spyOn(prismaService.pointTransaction, 'findMany')
        .mockResolvedValueOnce([mockExpiredTransaction])
        .mockResolvedValueOnce(mockExpiringTransactions);
      jest.spyOn(prismaService.pointBalance, 'findUnique').mockResolvedValue({
        id: 'balance-3',
        userId: 'user-3',
        currentBalance: 900,
        lifetimeEarned: 1200,
        lifetimeUsed: 300,
        lifetimeExpired: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      jest.spyOn(pointsService, 'deductPoints').mockResolvedValue(undefined as any);
      jest.spyOn(prismaService.pointTransaction, 'updateMany').mockResolvedValue({ count: 1 });

      await service.processExpirations();

      expect(prismaService.pointTransaction.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          transactionType: PointTransactionType.EARNED_ORDER,
          expiresAt: { gt: now, lte: warningDate },
          amount: { gt: 0 },
        },
        include: { balance: true },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'points:expiring-soon',
        expect.any(PointsExpiringSoonEvent),
      );
    });
  });
});
