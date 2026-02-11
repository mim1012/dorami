import { Test, TestingModule } from '@nestjs/testing';
import { PointsService } from './points.service';
import { PointsConfigService } from './points-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PointTransactionType } from '@prisma/client';

describe('PointsService', () => {
  let service: PointsService;

  // Transaction mock — the callback receives the same mockPrisma object
  const mockTx = {
    pointBalance: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    pointTransaction: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockPrisma = {
    ...mockTx,
    $transaction: jest.fn((cb: any) => cb(mockTx)),
  };

  const mockPointsConfig = {
    getPointsConfig: jest.fn(),
  };

  const mockBalance = {
    id: 'balance-1',
    userId: 'user-123',
    currentBalance: 5000,
    lifetimeEarned: 10000,
    lifetimeUsed: 3000,
    lifetimeExpired: 2000,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PointsConfigService, useValue: mockPointsConfig },
      ],
    }).compile();

    service = module.get<PointsService>(PointsService);

    jest.clearAllMocks();
  });

  describe('getBalance', () => {
    it('should return existing balance', async () => {
      mockTx.pointBalance.findUnique.mockResolvedValue(mockBalance);

      const result = await service.getBalance('user-123');

      expect(result.currentBalance).toBe(5000);
      expect(result.lifetimeEarned).toBe(10000);
      expect(result.lifetimeUsed).toBe(3000);
      expect(result.lifetimeExpired).toBe(2000);
    });

    it('should create balance if not exists', async () => {
      mockTx.pointBalance.findUnique.mockResolvedValue(null);
      mockTx.pointBalance.create.mockResolvedValue({
        ...mockBalance,
        currentBalance: 0,
        lifetimeEarned: 0,
        lifetimeUsed: 0,
        lifetimeExpired: 0,
      });

      const result = await service.getBalance('new-user');

      expect(result.currentBalance).toBe(0);
      expect(mockTx.pointBalance.create).toHaveBeenCalled();
    });
  });

  describe('addPoints', () => {
    it('should add points and record transaction', async () => {
      mockTx.pointBalance.findUnique.mockResolvedValue(mockBalance);
      mockTx.pointBalance.update.mockResolvedValue({
        ...mockBalance,
        currentBalance: 6000,
        lifetimeEarned: 11000,
      });
      mockTx.pointTransaction.create.mockResolvedValue({});

      const result = await service.addPoints(
        'user-123',
        1000,
        PointTransactionType.EARNED_ORDER,
        'ORD-001',
      );

      expect(result.newBalance).toBe(6000);
      expect(mockTx.pointBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentBalance: 6000,
            lifetimeEarned: 11000,
          }),
        }),
      );
      expect(mockTx.pointTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 1000,
            balanceAfter: 6000,
            transactionType: PointTransactionType.EARNED_ORDER,
          }),
        }),
      );
    });

    it('should create balance if not exists when adding points', async () => {
      mockTx.pointBalance.findUnique.mockResolvedValue(null);
      mockTx.pointBalance.create.mockResolvedValue({
        id: 'new-balance',
        userId: 'new-user',
        currentBalance: 0,
        lifetimeEarned: 0,
        lifetimeUsed: 0,
        lifetimeExpired: 0,
      });
      mockTx.pointBalance.update.mockResolvedValue({ currentBalance: 500 });
      mockTx.pointTransaction.create.mockResolvedValue({});

      const result = await service.addPoints(
        'new-user',
        500,
        PointTransactionType.MANUAL_ADD,
        undefined,
        'Welcome bonus',
      );

      expect(result.newBalance).toBe(500);
    });
  });

  describe('deductPoints', () => {
    it('should deduct points and update lifetimeUsed for USED_ORDER', async () => {
      mockTx.pointBalance.findUnique.mockResolvedValue(mockBalance);
      mockTx.pointBalance.update.mockResolvedValue({
        ...mockBalance,
        currentBalance: 3000,
        lifetimeUsed: 5000,
      });
      mockTx.pointTransaction.create.mockResolvedValue({});

      const result = await service.deductPoints(
        'user-123',
        2000,
        PointTransactionType.USED_ORDER,
        'ORD-002',
      );

      expect(result.newBalance).toBe(3000);
      expect(mockTx.pointBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentBalance: 3000,
            lifetimeUsed: 5000, // 3000 + 2000
          }),
        }),
      );
      expect(mockTx.pointTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: -2000, // negative for deduction
          }),
        }),
      );
    });

    it('should update lifetimeExpired for EXPIRED type', async () => {
      mockTx.pointBalance.findUnique.mockResolvedValue(mockBalance);
      mockTx.pointBalance.update.mockResolvedValue({});
      mockTx.pointTransaction.create.mockResolvedValue({});

      await service.deductPoints('user-123', 1000, PointTransactionType.EXPIRED);

      expect(mockTx.pointBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lifetimeExpired: 3000, // 2000 + 1000
          }),
        }),
      );
    });

    it('should throw INSUFFICIENT_POINTS when balance too low', async () => {
      mockTx.pointBalance.findUnique.mockResolvedValue(mockBalance); // balance: 5000

      await expect(
        service.deductPoints('user-123', 10000, PointTransactionType.USED_ORDER),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('validateRedemption', () => {
    const defaultConfig = {
      pointsEnabled: true,
      pointEarningRate: 1,
      pointMinRedemption: 100,
      pointMaxRedemptionPct: 50,
      pointExpirationEnabled: true,
      pointExpirationMonths: 12,
    };

    it('should pass validation for valid redemption', async () => {
      mockPointsConfig.getPointsConfig.mockResolvedValue(defaultConfig);
      mockPrisma.pointBalance.findUnique.mockResolvedValue({ currentBalance: 5000 });

      await expect(service.validateRedemption('user-123', 2000, 10000)).resolves.not.toThrow();
    });

    it('should throw POINTS_DISABLED when system disabled', async () => {
      mockPointsConfig.getPointsConfig.mockResolvedValue({
        ...defaultConfig,
        pointsEnabled: false,
      });

      await expect(service.validateRedemption('user-123', 1000, 10000)).rejects.toThrow(
        BusinessException,
      );
    });

    it('should throw POINTS_BELOW_MINIMUM when below min redemption', async () => {
      mockPointsConfig.getPointsConfig.mockResolvedValue(defaultConfig);

      await expect(
        service.validateRedemption('user-123', 50, 10000), // min is 100
      ).rejects.toThrow(BusinessException);
    });

    it('should throw POINTS_EXCEED_MAX when exceeding max percentage', async () => {
      mockPointsConfig.getPointsConfig.mockResolvedValue(defaultConfig); // max 50%

      await expect(
        service.validateRedemption('user-123', 6000, 10000), // 6000 > 50% of 10000
      ).rejects.toThrow(BusinessException);
    });

    it('should throw INSUFFICIENT_POINTS when balance too low', async () => {
      mockPointsConfig.getPointsConfig.mockResolvedValue(defaultConfig);
      mockPrisma.pointBalance.findUnique.mockResolvedValue({ currentBalance: 500 });

      await expect(service.validateRedemption('user-123', 1000, 10000)).rejects.toThrow(
        BusinessException,
      );
    });

    it('should throw INSUFFICIENT_POINTS when no balance record', async () => {
      mockPointsConfig.getPointsConfig.mockResolvedValue(defaultConfig);
      mockPrisma.pointBalance.findUnique.mockResolvedValue(null);

      await expect(service.validateRedemption('user-123', 1000, 10000)).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('getTransactionHistory', () => {
    it('should return paginated transaction history', async () => {
      mockPrisma.pointBalance.findUnique.mockResolvedValue({ id: 'balance-1' });
      mockPrisma.pointTransaction.count.mockResolvedValue(25);
      mockPrisma.pointTransaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          transactionType: PointTransactionType.EARNED_ORDER,
          amount: 500,
          balanceAfter: 5500,
          orderId: 'ORD-001',
          reason: null,
          expiresAt: null,
          createdAt: new Date(),
        },
      ]);

      const result = await service.getTransactionHistory('user-123', {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.totalPages).toBe(2);
    });

    it('should return empty when no balance', async () => {
      mockPrisma.pointBalance.findUnique.mockResolvedValue(null);

      const result = await service.getTransactionHistory('new-user', {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });
});
