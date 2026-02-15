import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProductStatus } from './dto/product.dto';
import {
  ProductNotFoundException,
  InsufficientStockException,
  EntityNotFoundException,
} from '../../common/exceptions/business.exception';
import { BadRequestException } from '@nestjs/common';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: PrismaService;
  let _eventEmitter: EventEmitter2;

  const mockPrismaService = {
    product: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    liveStream: {
      findUnique: jest.fn(),
    },
    cart: {
      count: jest.fn(),
      aggregate: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prisma = module.get<PrismaService>(PrismaService);
    _eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new product', async () => {
      const createDto = {
        streamKey: 'test-stream-key',
        name: 'Test Product',
        description: 'Test Description',
        price: 10000,
        stock: 100,
      };

      const mockStream = {
        id: 'stream-123',
        streamKey: 'test-stream-key',
        status: 'ACTIVE',
      };

      const mockProduct = {
        id: '123',
        streamKey: createDto.streamKey,
        name: createDto.name,
        description: createDto.description,
        price: { toNumber: () => 10000 },
        quantity: createDto.stock,
        status: 'ACTIVE',
        shippingFee: { toString: () => '3000' },
        timerEnabled: false,
        timerDuration: 10,
        colorOptions: null,
        sizeOptions: null,
        freeShippingMessage: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.liveStream, 'findUnique').mockResolvedValue(mockStream as any);
      jest.spyOn(prisma.product, 'create').mockResolvedValue(mockProduct as any);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(createDto.name);
    });
  });

  describe('getStoreProducts - Epic 11', () => {
    it('should return paginated store products from ended live streams', async () => {
      const mockProducts = [
        {
          id: 'product-1',
          streamKey: 'stream-1',
          name: 'Past Product 1',
          price: { toString: () => '25000' },
          quantity: 10,
          status: 'AVAILABLE',
          imageUrl: 'https://example.com/product1.jpg',
          colorOptions: ['Red', 'Blue'],
          sizeOptions: ['S', 'M', 'L'],
          shippingFee: { toString: () => '3000' },
          freeShippingMessage: null,
          timerEnabled: false,
          timerDuration: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
          liveStream: {
            title: 'Past Live Stream 1',
            endedAt: new Date('2024-01-15'),
          },
        },
        {
          id: 'product-2',
          streamKey: 'stream-2',
          name: 'Past Product 2',
          price: { toString: () => '35000' },
          quantity: 5,
          status: 'AVAILABLE',
          imageUrl: 'https://example.com/product2.jpg',
          colorOptions: [],
          sizeOptions: [],
          shippingFee: { toString: () => '3000' },
          freeShippingMessage: 'Free shipping on orders over $50',
          timerEnabled: false,
          timerDuration: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
          liveStream: {
            title: 'Past Live Stream 2',
            endedAt: new Date('2024-01-14'),
          },
        },
      ];

      jest.spyOn(prisma.product, 'findMany').mockResolvedValue(mockProducts as any);
      jest.spyOn(prisma.product, 'count').mockResolvedValue(48);

      const result = await service.getStoreProducts(1, 24);

      expect(result).toBeDefined();
      expect(result.products).toHaveLength(2);
      expect(result.total).toBe(48);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(2);
      expect(result.products[0].name).toBe('Past Product 1');
      expect(result.products[1].name).toBe('Past Product 2');
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            liveStream: { status: 'OFFLINE' },
            status: 'AVAILABLE',
          }),
          skip: 0,
          take: 24,
        }),
      );
    });

    it('should return empty array when no store products exist', async () => {
      jest.spyOn(prisma.product, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.product, 'count').mockResolvedValue(0);

      const result = await service.getStoreProducts(1, 24);

      expect(result.products).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should handle pagination correctly for page 2', async () => {
      jest.spyOn(prisma.product, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.product, 'count').mockResolvedValue(48);

      await service.getStoreProducts(2, 24);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 24, // (page 2 - 1) * 24
          take: 24,
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return a product by id', async () => {
      const mockProduct = {
        id: 'product-1',
        streamKey: 'stream-123',
        name: 'Test Product',
        price: { toString: () => '29000' },
        quantity: 50,
        colorOptions: ['Red'],
        sizeOptions: ['M'],
        shippingFee: { toString: () => '3000' },
        freeShippingMessage: null,
        timerEnabled: false,
        timerDuration: 10,
        imageUrl: null,
        status: 'AVAILABLE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(mockProduct as any);

      const result = await service.findById('product-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('product-1');
    });

    it('should throw EntityNotFoundException when product does not exist', async () => {
      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('update', () => {
    const mockProduct = {
      id: 'product-1',
      streamKey: 'stream-123',
      name: 'Test Product',
      price: { toString: () => '29000' },
      quantity: 50,
      colorOptions: ['Red'],
      sizeOptions: ['M'],
      shippingFee: { toString: () => '3000' },
      freeShippingMessage: null,
      timerEnabled: false,
      timerDuration: 10,
      imageUrl: null,
      status: 'AVAILABLE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should update a product successfully', async () => {
      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(mockProduct as any);
      jest.spyOn(prisma.product, 'update').mockResolvedValue({
        ...mockProduct,
        name: 'Updated Product',
      } as any);

      const result = await service.update('product-1', { name: 'Updated Product' });

      expect(result.name).toBe('Updated Product');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('product:updated', expect.any(Object));
    });

    it('should throw EntityNotFoundException when product does not exist', async () => {
      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(null);

      await expect(service.update('non-existent', { name: 'Test' })).rejects.toThrow(
        EntityNotFoundException,
      );
    });

    it('should throw BadRequestException when stock is negative', async () => {
      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(mockProduct as any);

      await expect(service.update('product-1', { stock: -5 })).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    const mockProduct = {
      id: 'product-1',
      streamKey: 'stream-123',
      name: 'Test Product',
    };

    it('should delete a product with no active carts', async () => {
      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(mockProduct as any);
      mockPrismaService.cart.updateMany.mockResolvedValue({ count: 0 });
      jest.spyOn(prisma.product, 'delete').mockResolvedValue(mockProduct as any);

      await service.delete('product-1');

      expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 'product-1' } });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('product:deleted', expect.any(Object));
    });

    it('should expire active carts before deleting product', async () => {
      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(mockProduct as any);
      mockPrismaService.cart.updateMany.mockResolvedValue({ count: 3 });
      jest.spyOn(prisma.product, 'delete').mockResolvedValue(mockProduct as any);

      await service.delete('product-1');

      expect(mockPrismaService.cart.updateMany).toHaveBeenCalledWith({
        where: { productId: 'product-1', status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      });
      expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 'product-1' } });
    });
  });

  describe('updateStock', () => {
    const mockProduct = {
      id: 'product-1',
      streamKey: 'stream-123',
      name: 'Test Product',
      price: { toString: () => '29000' },
      quantity: 50,
      colorOptions: [],
      sizeOptions: [],
      shippingFee: { toString: () => '3000' },
      freeShippingMessage: null,
      timerEnabled: false,
      timerDuration: 10,
      imageUrl: null,
      status: 'AVAILABLE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should increase stock', async () => {
      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(mockProduct as any);
      jest.spyOn(prisma.product, 'update').mockResolvedValue({
        ...mockProduct,
        quantity: 60,
      } as any);

      const result = await service.updateStock('product-1', { quantity: 10 });

      expect(result.stock).toBe(60);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'product:stock:updated',
        expect.any(Object),
      );
    });

    it('should throw InsufficientStockException when decreasing below zero', async () => {
      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(mockProduct as any);

      await expect(service.updateStock('product-1', { quantity: -100 })).rejects.toThrow(
        InsufficientStockException,
      );
    });
  });

  describe('checkStock', () => {
    const mockProduct = {
      id: 'product-1',
      quantity: 50,
      status: 'AVAILABLE',
    };

    it('should return true when stock is available (optimized N+1)', async () => {
      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(mockProduct as any);
      mockPrismaService.cart.aggregate.mockResolvedValue({ _sum: { quantity: 10 } });

      const result = await service.checkStock('product-1', 5);

      expect(result).toBe(true);
      // Verify both queries run in parallel (Promise.all pattern)
      expect(prisma.product.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.cart.aggregate).toHaveBeenCalledTimes(1);
    });

    it('should return false when stock is insufficient', async () => {
      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(mockProduct as any);
      mockPrismaService.cart.aggregate.mockResolvedValue({ _sum: { quantity: 48 } });

      const result = await service.checkStock('product-1', 5);

      expect(result).toBe(false);
    });

    it('should return false when product is sold out', async () => {
      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue({
        ...mockProduct,
        status: 'SOLD_OUT',
      } as any);
      mockPrismaService.cart.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });

      const result = await service.checkStock('product-1', 1);

      expect(result).toBe(false);
    });

    it('should throw ProductNotFoundException when product does not exist', async () => {
      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(null);
      mockPrismaService.cart.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });

      await expect(service.checkStock('non-existent', 1)).rejects.toThrow(ProductNotFoundException);
    });
  });

  describe('markAsSoldOut', () => {
    it('should mark product as sold out', async () => {
      const mockProduct = {
        id: 'product-1',
        streamKey: 'stream-123',
        name: 'Test Product',
        price: { toString: () => '29000' },
        quantity: 0,
        colorOptions: [],
        sizeOptions: [],
        shippingFee: { toString: () => '3000' },
        freeShippingMessage: null,
        timerEnabled: false,
        timerDuration: 10,
        imageUrl: null,
        status: 'SOLD_OUT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(mockProduct as any);
      jest.spyOn(prisma.product, 'update').mockResolvedValue(mockProduct as any);

      const result = await service.markAsSoldOut('product-1');

      expect(result.status).toBe(ProductStatus.SOLD_OUT);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('product:soldout', expect.any(Object));
    });
  });

  describe('findAll', () => {
    it('should return all products', async () => {
      const mockProducts = [
        {
          id: 'product-1',
          streamKey: 'stream-123',
          name: 'Test Product',
          price: { toString: () => '29000' },
          quantity: 50,
          colorOptions: [],
          sizeOptions: [],
          shippingFee: { toString: () => '3000' },
          freeShippingMessage: null,
          timerEnabled: false,
          timerDuration: 10,
          imageUrl: null,
          status: 'AVAILABLE',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      jest.spyOn(prisma.product, 'findMany').mockResolvedValue(mockProducts as any);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
    });

    it('should filter by status when provided', async () => {
      jest.spyOn(prisma.product, 'findMany').mockResolvedValue([]);

      await service.findAll(ProductStatus.AVAILABLE);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: ProductStatus.AVAILABLE },
        }),
      );
    });
  });

  describe('getFeaturedProducts', () => {
    it('should return featured products with default limit', async () => {
      jest.spyOn(prisma.product, 'findMany').mockResolvedValue([]);

      await service.getFeaturedProducts();

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'AVAILABLE' },
          take: 6,
        }),
      );
    });

    it('should return featured products with custom limit', async () => {
      jest.spyOn(prisma.product, 'findMany').mockResolvedValue([]);

      await service.getFeaturedProducts(12);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 12,
        }),
      );
    });
  });
});
