import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  InsufficientStockException,
  ProductSoldOutException,
} from '../../common/exceptions/business.exception';

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
        quantity: 10,
        status: 'ACTIVE',
      };

      const updatedProduct = {
        ...mockProduct,
        quantity: 5,
      };

      jest
        .spyOn(prisma, '$transaction')
        .mockImplementation(async (callback: any, _options?: any) => {
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
        quantity: 3,
        status: 'ACTIVE',
      };

      jest
        .spyOn(prisma, '$transaction')
        .mockImplementation(async (callback: any, _options?: any) => {
          return callback({
            product: {
              findUnique: jest.fn().mockResolvedValue(mockProduct),
              update: jest.fn(),
            },
          });
        });

      await expect(service.decreaseStock('123', 5)).rejects.toThrow(InsufficientStockException);
    });

    it('should throw ProductSoldOutException when product is SOLD_OUT', async () => {
      const soldOutProduct = {
        id: '123',
        quantity: 0,
        status: 'SOLD_OUT',
      };

      jest
        .spyOn(prisma, '$transaction')
        .mockImplementation(async (callback: any, _options?: any) => {
          return callback({
            product: {
              findUnique: jest.fn().mockResolvedValue(soldOutProduct),
              update: jest.fn(),
            },
          });
        });

      await expect(service.decreaseStock('123', 1)).rejects.toThrow(ProductSoldOutException);
    });
  });

  describe('batchDecreaseStockTx', () => {
    it('should throw ProductSoldOutException when any product is SOLD_OUT', async () => {
      const soldOutProduct = {
        id: 'prod-1',
        quantity: 5,
        status: 'SOLD_OUT',
      };

      const mockTx = {
        product: {
          findUnique: jest.fn().mockResolvedValue(soldOutProduct),
          update: jest.fn(),
        },
      };

      await expect(
        service.batchDecreaseStockTx(mockTx as any, [{ productId: 'prod-1', quantity: 1 }]),
      ).rejects.toThrow(ProductSoldOutException);
    });

    it('should succeed when product is AVAILABLE with sufficient stock', async () => {
      const availableProduct = {
        id: 'prod-1',
        quantity: 10,
        status: 'AVAILABLE',
      };

      const mockTx = {
        product: {
          findUnique: jest.fn().mockResolvedValue(availableProduct),
          update: jest.fn().mockResolvedValue({ ...availableProduct, quantity: 9 }),
        },
      };

      await expect(
        service.batchDecreaseStockTx(mockTx as any, [{ productId: 'prod-1', quantity: 1 }]),
      ).resolves.not.toThrow();
    });
  });
});
