import { Test, TestingModule } from '@nestjs/testing';
import { PointsService } from './points.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PointsConfigService } from './points-config.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PointTransactionType } from '@prisma/client';

describe('PointsService', () => {
  let service: PointsService;
  let prismaService: PrismaService;
  let pointsConfigService: PointsConfigService;

  const mockBalance = {
    id: 'balance-1',
    userId: 'user-1',
    currentBalance: 5000,
    lifetimeEarned: 10000,
    lifetimeUsed: 3000,
    lifetimeExpired: 2000,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPointsConfig = {
    pointsEnabled: true,
    pointEarningRate: 3,
    pointMinRedemption: 1000,
    pointMaxRedemptionPct: 50,
    pointExpirationEnabled: true,
    pointExpirationMonths: 12,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
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
          },
        },
        {
          provide: PointsConfigService,
          useValue: {
            getPointsConfig: jest.fn().mockResolvedValue(mockPointsConfig),
          },
        },
      ],
    }).compile();

    service = module.get<PointsService>(PointsService);
    prismaService = module.get<PrismaService>(PrismaService);
    pointsConfigService = module.get<PointsConfigService>(PointsConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getBalance', () => {
    it('should return existing balance', async () => {
      (prismaService.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          pointBalance: {
            findUnique: jest.fn().mockResolvedValue(mockBalance),
            create: jest.fn(),
          },
        };
        return cb(tx);
      });

      const result = await service.getBalance('user-1');

      expect(result.currentBalance).toBe(5000);
      expect(result.lifetimeEarned).toBe(10000);
      expect(result.lifetimeUsed).toBe(3000);
      expect(result.lifetimeExpired).toBe(2000);
    });

    it('should create new balance if not exists', async () => {
      const newBalance = {
        ...mockBalance,
        currentBalance: 0,
        lifetimeEarned: 0,
        lifetimeUsed: 0,
        lifetimeExpired: 0,
      };
      (prismaService.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          pointBalance: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(newBalance),
          },
        };
        return cb(tx);
      });

      const result = await service.getBalance('user-1');

      expect(result.currentBalance).toBe(0);
    });
  });

  describe('addPoints', () => {
    it('should add points and update lifetime earned', async () => {
      (prismaService.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          pointBalance: {
            findUnique: jest.fn().mockResolvedValue(mockBalance),
            create: jest.fn(),
            update: jest.fn(),
          },
          pointTransaction: {
            create: jest.fn(),
          },
        };
        return cb(tx);
      });

      const result = await service.addPoints(
        'user-1',
        1000,
        PointTransactionType.EARNED_ORDER,
        'order-1',
        'Order reward',
      );

      expect(result.newBalance).toBe(6000); // 5000 + 1000
    });

    it('should create balance if user has no balance record', async () => {
      const newBalance = {
        ...mockBalance,
        currentBalance: 0,
        lifetimeEarned: 0,
        lifetimeUsed: 0,
        lifetimeExpired: 0,
      };
      (prismaService.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          pointBalance: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(newBalance),
            update: jest.fn(),
          },
          pointTransaction: {
            create: jest.fn(),
          },
        };
        return cb(tx);
      });

      const result = await service.addPoints('user-1', 500, PointTransactionType.EARNED_ORDER);

      expect(result.newBalance).toBe(500);
    });
  });

  describe('deductPoints', () => {
    it('should deduct points when sufficient balance', async () => {
      (prismaService.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          pointBalance: {
            findUnique: jest.fn().mockResolvedValue(mockBalance),
            create: jest.fn(),
            update: jest.fn(),
          },
          pointTransaction: {
            create: jest.fn(),
          },
        };
        return cb(tx);
      });

      const result = await service.deductPoints(
        'user-1',
        2000,
        PointTransactionType.USED_ORDER,
        'order-1',
      );

      expect(result.newBalance).toBe(3000); // 5000 - 2000
    });

    it('should throw BusinessException when insufficient balance', async () => {
      (prismaService.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          pointBalance: {
            findUnique: jest.fn().mockResolvedValue(mockBalance),
            create: jest.fn(),
          },
        };
        return cb(tx);
      });

      await expect(
        service.deductPoints('user-1', 10000, PointTransactionType.USED_ORDER),
      ).rejects.toThrow(BusinessException);
    });

    it('should update lifetimeUsed for USED_ORDER type', async () => {
      let updateData: any;
      (prismaService.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          pointBalance: {
            findUnique: jest.fn().mockResolvedValue(mockBalance),
            create: jest.fn(),
            update: jest.fn().mockImplementation((args) => {
              updateData = args.data;
            }),
          },
          pointTransaction: {
            create: jest.fn(),
          },
        };
        return cb(tx);
      });

      await service.deductPoints('user-1', 1000, PointTransactionType.USED_ORDER);

      expect(updateData.lifetimeUsed).toBe(4000); // 3000 + 1000
    });

    it('should update lifetimeExpired for EXPIRED type', async () => {
      let updateData: any;
      (prismaService.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          pointBalance: {
            findUnique: jest.fn().mockResolvedValue(mockBalance),
            create: jest.fn(),
            update: jest.fn().mockImplementation((args) => {
              updateData = args.data;
            }),
          },
          pointTransaction: {
            create: jest.fn(),
          },
        };
        return cb(tx);
      });

      await service.deductPoints('user-1', 1000, PointTransactionType.EXPIRED);

      expect(updateData.lifetimeExpired).toBe(3000); // 2000 + 1000
    });

    it('should create transaction record with negative amount', async () => {
      let txCreateArgs: any;
      (prismaService.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          pointBalance: {
            findUnique: jest.fn().mockResolvedValue(mockBalance),
            create: jest.fn(),
            update: jest.fn(),
          },
          pointTransaction: {
            create: jest.fn().mockImplementation((args) => {
              txCreateArgs = args.data;
            }),
          },
        };
        return cb(tx);
      });

      await service.deductPoints('user-1', 2000, PointTransactionType.USED_ORDER, 'order-1');

      expect(txCreateArgs.amount).toBe(-2000);
      expect(txCreateArgs.balanceAfter).toBe(3000);
      expect(txCreateArgs.orderId).toBe('order-1');
    });
  });

  describe('validateRedemption', () => {
    it('should pass when redemption is valid', async () => {
      jest.spyOn(prismaService.pointBalance, 'findUnique').mockResolvedValue(mockBalance as any);

      await expect(service.validateRedemption('user-1', 2000, 10000)).resolves.toBeUndefined();
    });

    it('should throw when points system is disabled', async () => {
      jest.spyOn(pointsConfigService, 'getPointsConfig').mockResolvedValue({
        ...mockPointsConfig,
        pointsEnabled: false,
      });

      await expect(service.validateRedemption('user-1', 1000, 10000)).rejects.toThrow(
        BusinessException,
      );
    });

    it('should throw when below minimum redemption', async () => {
      await expect(
        service.validateRedemption('user-1', 500, 10000), // min is 1000
      ).rejects.toThrow(BusinessException);
    });

    it('should throw when exceeding max redemption percentage', async () => {
      jest.spyOn(prismaService.pointBalance, 'findUnique').mockResolvedValue(mockBalance as any);

      await expect(
        service.validateRedemption('user-1', 5000, 8000), // 50% of 8000 = 4000 max
      ).rejects.toThrow(BusinessException);
    });

    it('should throw when insufficient balance', async () => {
      jest.spyOn(prismaService.pointBalance, 'findUnique').mockResolvedValue({
        ...mockBalance,
        currentBalance: 500,
      } as any);

      await expect(service.validateRedemption('user-1', 1000, 10000)).rejects.toThrow(
        BusinessException,
      );
    });

    it('should throw when user has no balance record', async () => {
      jest.spyOn(prismaService.pointBalance, 'findUnique').mockResolvedValue(null);

      await expect(service.validateRedemption('user-1', 1000, 10000)).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('getTransactionHistory', () => {
    it('should return empty when user has no balance', async () => {
      jest.spyOn(prismaService.pointBalance, 'findUnique').mockResolvedValue(null);

      const result = await service.getTransactionHistory('user-1', { page: 1, limit: 20 });

      expect(result.items).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should return paginated transactions', async () => {
      jest.spyOn(prismaService.pointBalance, 'findUnique').mockResolvedValue(mockBalance as any);
      jest.spyOn(prismaService.pointTransaction, 'count').mockResolvedValue(25);
      jest.spyOn(prismaService.pointTransaction, 'findMany').mockResolvedValue([
        {
          id: 'tx-1',
          transactionType: PointTransactionType.EARNED_ORDER,
          amount: 1000,
          balanceAfter: 6000,
          orderId: 'order-1',
          reason: null,
          expiresAt: null,
          createdAt: new Date(),
          balanceId: 'balance-1',
        },
      ] as any);

      const result = await service.getTransactionHistory('user-1', { page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].amount).toBe(1000);
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.totalPages).toBe(2);
    });

    it('should filter by transaction type', async () => {
      jest.spyOn(prismaService.pointBalance, 'findUnique').mockResolvedValue(mockBalance as any);
      jest.spyOn(prismaService.pointTransaction, 'count').mockResolvedValue(0);
      jest.spyOn(prismaService.pointTransaction, 'findMany').mockResolvedValue([]);

      await service.getTransactionHistory('user-1', {
        page: 1,
        limit: 20,
        transactionType: PointTransactionType.EARNED_ORDER,
      });

      expect(prismaService.pointTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            transactionType: PointTransactionType.EARNED_ORDER,
          }),
        }),
      );
    });
  });
});
