import { Test, TestingModule } from '@nestjs/testing';
import { SettlementService } from './settlement.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('SettlementService', () => {
  let service: SettlementService;
  let prisma: PrismaService;

  const mockOrders = [
    {
      id: 'ORD-20260115-00001',
      userId: 'user-1',
      createdAt: new Date('2026-01-15T10:00:00Z'),
      total: 100.5,
      shippingFee: 10,
      paidAt: new Date('2026-01-16T14:00:00Z'),
      paymentStatus: 'CONFIRMED',
      user: { instagramId: '@testuser1' },
      instagramId: '@testuser1',
    },
    {
      id: 'ORD-20260120-00002',
      userId: 'user-2',
      createdAt: new Date('2026-01-20T11:00:00Z'),
      total: 200.75,
      shippingFee: 15,
      paidAt: new Date('2026-01-21T15:00:00Z'),
      paymentStatus: 'CONFIRMED',
      user: { instagramId: '@testuser2' },
      instagramId: '@testuser2',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementService,
        {
          provide: PrismaService,
          useValue: {
            order: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SettlementService>(SettlementService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSettlementReport', () => {
    it('should return settlement report with correct summary', async () => {
      jest.spyOn(prisma.order, 'findMany').mockResolvedValue(mockOrders as any);

      const result = await service.getSettlementReport({
        from: '2026-01-01',
        to: '2026-01-31',
      });

      expect(result.summary.totalOrders).toBe(2);
      expect(result.summary.totalRevenue).toBe(301.25); // 100.5 + 200.75
      expect(result.summary.avgOrderValue).toBe(150.625); // 301.25 / 2
      expect(result.summary.totalShippingFee).toBe(25); // 10 + 15
      expect(result.orders).toHaveLength(2);
      expect(result.dateRange.from).toBe('2026-01-01');
      expect(result.dateRange.to).toBe('2026-01-31');
    });

    it('should query only CONFIRMED orders within date range', async () => {
      const findManySpy = jest.spyOn(prisma.order, 'findMany').mockResolvedValue([]);

      await service.getSettlementReport({
        from: '2026-01-01',
        to: '2026-01-31',
      });

      expect(findManySpy).toHaveBeenCalledWith({
        where: {
          paymentStatus: 'CONFIRMED',
          paidAt: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
        include: {
          user: {
            select: {
              instagramId: true,
            },
          },
        },
        orderBy: {
          paidAt: 'desc',
        },
      });
    });

    it('should return zeros for empty result set', async () => {
      jest.spyOn(prisma.order, 'findMany').mockResolvedValue([]);

      const result = await service.getSettlementReport({
        from: '2026-01-01',
        to: '2026-01-31',
      });

      expect(result.summary.totalOrders).toBe(0);
      expect(result.summary.totalRevenue).toBe(0);
      expect(result.summary.avgOrderValue).toBe(0);
      expect(result.summary.totalShippingFee).toBe(0);
      expect(result.orders).toHaveLength(0);
    });

    it('should map orders to DTOs correctly', async () => {
      jest.spyOn(prisma.order, 'findMany').mockResolvedValue(mockOrders as any);

      const result = await service.getSettlementReport({
        from: '2026-01-01',
        to: '2026-01-31',
      });

      expect(result.orders[0]).toEqual({
        orderId: 'ORD-20260115-00001',
        orderDate: '2026-01-15T10:00:00.000Z',
        customerId: '@testuser1',
        total: 100.5,
        paidAt: '2026-01-16T14:00:00.000Z',
      });
    });
  });

  describe('generateExcelReport', () => {
    it('should generate Excel buffer', async () => {
      jest.spyOn(prisma.order, 'findMany')
        .mockResolvedValueOnce(mockOrders as any)
        .mockResolvedValueOnce(mockOrders as any);

      const buffer = await service.generateExcelReport({
        from: '2026-01-01',
        to: '2026-01-31',
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});
