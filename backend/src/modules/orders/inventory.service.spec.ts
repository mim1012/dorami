import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InsufficientStockException } from '../../common/exceptions/business.exception';

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
            product: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('decreaseStock', () => {
    it('should decrease stock successfully', async () => {
      const mockProduct = {
        id: '123',
        stock: 10,
        status: 'ACTIVE',
      };

      const updatedProduct = {
        ...mockProduct,
        stock: 5,
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          product: {
            findUnique: jest.fn().mockResolvedValue(mockProduct),
            update: jest.fn().mockResolvedValue(updatedProduct),
          },
        });
      });

      const result = await service.decreaseStock('123', 5);

      expect(result.success).toBe(true);
      expect(result.newStock).toBe(5);
    });

    it('should throw InsufficientStockException when stock is insufficient', async () => {
      const mockProduct = {
        id: '123',
        stock: 3,
        status: 'ACTIVE',
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          product: {
            findUnique: jest.fn().mockResolvedValue(mockProduct),
          },
        });
      });

      await expect(service.decreaseStock('123', 5)).rejects.toThrow(
        InsufficientStockException,
      );
    });
  });
});
