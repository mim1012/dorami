import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProductStatus, VariantStatus } from './dto/product.dto';
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
    productVariant: {
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    liveStream: {
      findUnique: jest.fn(),
    },
    cart: {
      count: jest.fn(),
      aggregate: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
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
    jest.resetAllMocks();
    mockPrismaService.$transaction.mockImplementation(async (operations: unknown[]) =>
      Promise.all(operations),
    );
    mockPrismaService.productVariant.findFirst.mockResolvedValue(null);
    mockPrismaService.productVariant.findUnique.mockResolvedValue(null);
    mockPrismaService.productVariant.create.mockImplementation(async ({ data }: any) => ({
      ...buildVariant({ id: data?.id ?? `${data?.color ?? 'variant'}-${data?.size ?? 'default'}` }),
      ...data,
    }));
    mockPrismaService.productVariant.update.mockImplementation(async ({ data, where }: any) => ({
      ...buildVariant({ id: where?.id ?? 'variant-1' }),
      ...data,
    }));
  });

  const buildVariant = (overrides: Record<string, unknown> = {}) => ({
    id: 'variant-1',
    productId: 'product-1',
    color: 'Black',
    size: 'M',
    label: 'Black / M',
    price: { toString: () => '29000' },
    stock: 3,
    status: 'ACTIVE',
    sortOrder: 0,
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  });

  const buildProduct = (overrides: Record<string, unknown> = {}) => ({
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
    images: [],
    sortOrder: 0,
    isNew: false,
    discountRate: null,
    originalPrice: null,
    expiresAt: null,
    status: 'AVAILABLE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a product successfully', async () => {
      const createDto = {
        streamKey: 'test-stream-key',
        name: 'Test Product',
        price: 10000,
        stock: 10,
      };

      const mockStream = {
        id: 'stream-123',
        streamKey: 'test-stream-key',
        status: 'ACTIVE',
      };

      const mockProduct = buildProduct({
        id: '123',
        streamKey: createDto.streamKey,
        name: createDto.name,
        price: { toString: () => '10000' },
        quantity: createDto.stock,
        colorOptions: [],
        sizeOptions: [],
        status: 'ACTIVE',
      });

      jest.spyOn(prisma.liveStream, 'findUnique').mockResolvedValue(mockStream as any);
      jest.spyOn(prisma.product, 'create').mockResolvedValue(mockProduct as any);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(createDto.name);
    });

    it('should persist create status when provided', async () => {
      const createDto = {
        streamKey: 'test-stream-key',
        name: 'Sold Out Product',
        price: 10000,
        stock: 0,
        status: ProductStatus.SOLD_OUT,
      };

      const mockStream = {
        id: 'stream-123',
        streamKey: 'test-stream-key',
        status: 'ACTIVE',
      };

      const mockProduct = buildProduct({
        id: 'status-product',
        streamKey: createDto.streamKey,
        name: createDto.name,
        price: { toString: () => '10000' },
        quantity: createDto.stock,
        colorOptions: [],
        sizeOptions: [],
        status: ProductStatus.SOLD_OUT,
      });

      jest.spyOn(prisma.liveStream, 'findUnique').mockResolvedValue(mockStream as any);
      jest.spyOn(prisma.product, 'create').mockResolvedValue(mockProduct as any);

      const result = await service.create(createDto as any);

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ProductStatus.SOLD_OUT }),
        }),
      );
      expect(result.status).toBe(ProductStatus.SOLD_OUT);
    });

    it('should save variants and derive summary fields from active variants', async () => {
      const createDto = {
        streamKey: 'test-stream-key',
        name: 'Variant Product',
        price: 99999,
        stock: 999,
        variants: [
          { color: 'Black', size: 'M', label: 'Black / M', price: 31000, stock: 2, sortOrder: 1 },
          { color: 'Black', size: 'L', label: 'Black / L', price: 29000, stock: 5, sortOrder: 2 },
          {
            color: 'White',
            size: 'S',
            label: 'White / S',
            price: 27000,
            stock: 7,
            status: VariantStatus.SOLD_OUT,
          },
        ],
      };
      const mockStream = { id: 'stream-123', streamKey: 'test-stream-key', status: 'ACTIVE' };
      const createdProduct = buildProduct({
        id: 'product-variant',
        streamKey: createDto.streamKey,
        name: createDto.name,
        price: { toString: () => '99999' },
        quantity: 999,
        colorOptions: [],
        sizeOptions: [],
      });
      const persistedVariants = [
        buildVariant({
          id: 'variant-1',
          productId: 'product-variant',
          color: 'Black',
          size: 'M',
          label: 'Black / M',
          price: { toString: () => '31000' },
          stock: 2,
          sortOrder: 1,
        }),
        buildVariant({
          id: 'variant-2',
          productId: 'product-variant',
          color: 'Black',
          size: 'L',
          label: 'Black / L',
          price: { toString: () => '29000' },
          stock: 5,
          sortOrder: 2,
        }),
        buildVariant({
          id: 'variant-3',
          productId: 'product-variant',
          color: 'White',
          size: 'S',
          label: 'White / S',
          price: { toString: () => '27000' },
          stock: 7,
          status: VariantStatus.SOLD_OUT,
        }),
      ];

      jest.spyOn(prisma.liveStream, 'findUnique').mockResolvedValue(mockStream as any);
      jest.spyOn(prisma.product, 'create').mockResolvedValue(createdProduct as any);
      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue({
        ...createdProduct,
        variants: persistedVariants,
      } as any);
      jest.spyOn(prisma.productVariant, 'findMany').mockResolvedValue(persistedVariants as any);
      (jest.spyOn(prisma.productVariant, 'upsert') as any).mockImplementation(
        async ({ create }: any) => ({
          ...buildVariant(),
          ...create,
        }),
      );

      const result = await service.create(createDto);

      expect(prisma.productVariant.create).toHaveBeenCalledTimes(3);
      expect(result.variants).toHaveLength(3);
      expect(result.price).toBe(29000);
      expect(result.stock).toBe(7);
      expect(result.minPrice).toBe(29000);
      expect(result.maxPrice).toBe(31000);
      expect(result.colorOptions).toEqual(['Black']);
      expect(result.sizeOptions).toEqual(['M', 'L']);
    });

    it('should reject duplicate color/size variant combinations', async () => {
      const createDto = {
        streamKey: 'test-stream-key',
        name: 'Duplicate Variant Product',
        price: 10000,
        stock: 10,
        variants: [
          { color: 'Black', size: 'M', price: 10000, stock: 1 },
          { color: ' Black ', size: 'M', price: 12000, stock: 2 },
        ],
      };

      jest.spyOn(prisma.liveStream, 'findUnique').mockResolvedValue({
        id: 'stream-123',
        streamKey: 'test-stream-key',
        status: 'ACTIVE',
      } as any);
      jest.spyOn(prisma.product, 'create').mockResolvedValue(
        buildProduct({
          id: 'dup-product',
          streamKey: createDto.streamKey,
          name: createDto.name,
          quantity: createDto.stock,
        }) as any,
      );

      await expect(service.create(createDto as any)).rejects.toThrow(
        'Duplicate color/size variant combination is not allowed',
      );
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
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  expect.objectContaining({ streamKey: null }),
                  expect.objectContaining({ streamKey: '' }),
                ]),
              }),
            ]),
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

  describe('findByStreamKey', () => {
    const mockProduct = {
      id: 'product-1',
      streamKey: 'stream-abc',
      name: 'Live Product',
      price: { toString: () => '15000' },
      quantity: 20,
      status: 'AVAILABLE',
      imageUrl: null,
      colorOptions: [],
      sizeOptions: [],
      shippingFee: { toString: () => '3000' },
      freeShippingMessage: null,
      timerEnabled: false,
      timerDuration: 10,
      sortOrder: 0,
      metadata: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should use default take=100 and skip=0 when no options provided', async () => {
      jest.spyOn(prisma.product, 'findMany').mockResolvedValue([mockProduct] as any);

      await service.findByStreamKey('stream-abc');

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
          skip: 0,
        }),
      );
    });

    it('should pass custom take and skip options to prisma', async () => {
      jest.spyOn(prisma.product, 'findMany').mockResolvedValue([mockProduct] as any);

      await service.findByStreamKey('stream-abc', undefined, false, { take: 10, skip: 20 });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        }),
      );
    });

    it('should filter by streamKey in where clause', async () => {
      jest.spyOn(prisma.product, 'findMany').mockResolvedValue([mockProduct] as any);

      await service.findByStreamKey('stream-abc');

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ streamKey: 'stream-abc' }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return a product by id', async () => {
      const mockProduct = buildProduct();

      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(mockProduct as any);

      const result = await service.findById('product-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('product-1');
    });

    it('should return variants and summary fields when product has variants', async () => {
      const mockProduct = buildProduct({
        variants: [
          buildVariant({
            id: 'variant-1',
            color: 'Black',
            size: 'M',
            price: { toString: () => '31000' },
            stock: 2,
          }),
          buildVariant({
            id: 'variant-2',
            color: 'Ivory',
            size: 'L',
            price: { toString: () => '28000' },
            stock: 4,
          }),
          buildVariant({
            id: 'variant-3',
            color: 'Black',
            size: 'S',
            price: { toString: () => '26000' },
            stock: 1,
            status: 'SOLD_OUT',
          }),
        ],
      });

      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(mockProduct as any);

      const result = await service.findById('product-1');

      expect(result.variants).toHaveLength(3);
      expect(result.price).toBe(28000);
      expect(result.stock).toBe(6);
      expect(result.minPrice).toBe(28000);
      expect(result.maxPrice).toBe(31000);
      expect(result.colorOptions).toEqual(['Black', 'Ivory']);
      expect(result.sizeOptions).toEqual(['M', 'L']);
    });

    it('should throw EntityNotFoundException when product does not exist', async () => {
      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('update', () => {
    const mockProduct = buildProduct();

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

    it('should replace variants through upsert and soft-deactivate omitted variants', async () => {
      const existingProduct = buildProduct({
        variants: [
          buildVariant({ id: 'variant-1', productId: 'product-1', color: 'Black', size: 'M' }),
          buildVariant({ id: 'variant-2', productId: 'product-1', color: 'White', size: 'L' }),
        ],
      });
      const updatedProduct = buildProduct({ id: 'product-1', variants: undefined });
      const refreshedVariants = [
        buildVariant({
          id: 'variant-1',
          productId: 'product-1',
          color: 'Black',
          size: 'M',
          price: { toString: () => '33000' },
          stock: 4,
          sortOrder: 0,
        }),
        buildVariant({
          id: 'variant-3',
          productId: 'product-1',
          color: 'Navy',
          size: 'S',
          price: { toString: () => '28000' },
          stock: 6,
          sortOrder: 1,
        }),
        buildVariant({
          id: 'variant-2',
          productId: 'product-1',
          color: 'White',
          size: 'L',
          price: { toString: () => '30000' },
          stock: 0,
          status: VariantStatus.HIDDEN,
          deletedAt: new Date('2026-01-02T00:00:00.000Z'),
        }),
      ];

      jest
        .spyOn(prisma.product, 'findUnique')
        .mockResolvedValueOnce(existingProduct as any)
        .mockResolvedValueOnce({
          ...updatedProduct,
          variants: refreshedVariants,
        } as any);
      jest.spyOn(prisma.product, 'update').mockResolvedValue(updatedProduct as any);
      jest
        .spyOn(prisma.productVariant, 'findUnique')
        .mockResolvedValueOnce(buildVariant({ id: 'variant-1' }) as any);
      jest.spyOn(prisma.productVariant, 'findFirst').mockResolvedValueOnce(null as any);
      (jest.spyOn(prisma.productVariant, 'upsert') as any).mockImplementation(
        async ({ create }: any) => ({
          ...buildVariant(),
          ...create,
        }),
      );
      jest.spyOn(prisma.productVariant, 'updateMany').mockResolvedValue({ count: 1 } as any);
      jest.spyOn(prisma.productVariant, 'findMany').mockResolvedValue(refreshedVariants as any);

      const result = await service.update('product-1', {
        variants: [
          {
            id: 'variant-1',
            color: 'Black',
            size: 'M',
            label: 'Black / M',
            price: 33000,
            stock: 4,
          },
          { color: 'Navy', size: 'S', label: 'Navy / S', price: 28000, stock: 6, sortOrder: 1 },
        ],
      });

      expect(prisma.productVariant.update).toHaveBeenCalledTimes(1);
      expect(prisma.productVariant.create).toHaveBeenCalledTimes(1);
      expect(prisma.productVariant.updateMany).toHaveBeenCalledWith({
        where: { productId: 'product-1', id: { notIn: ['variant-1', 'Navy-S'] } },
        data: { status: 'HIDDEN', deletedAt: expect.any(Date) },
      });
      expect(result.variants).toHaveLength(3);
      expect(result.price).toBe(28000);
      expect(result.stock).toBe(10);
      expect(result.colorOptions).toEqual(['Black', 'Navy']);
      expect(result.sizeOptions).toEqual(['M', 'S']);
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
      const mockProducts = [buildProduct()];

      jest.spyOn(prisma.product, 'findMany').mockResolvedValue(mockProducts as any);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
    });

    it('should derive summaries for product lists when variants are present', async () => {
      const mockProducts = [
        buildProduct({
          variants: [
            buildVariant({
              id: 'variant-1',
              color: 'Black',
              size: 'M',
              price: { toString: () => '31000' },
              stock: 2,
            }),
            buildVariant({
              id: 'variant-2',
              color: 'Black',
              size: 'L',
              price: { toString: () => '29000' },
              stock: 5,
            }),
            buildVariant({
              id: 'variant-3',
              color: 'White',
              size: 'S',
              price: { toString: () => '27000' },
              stock: 9,
              status: 'SOLD_OUT',
            }),
          ],
        }),
      ];

      jest.spyOn(prisma.product, 'findMany').mockResolvedValue(mockProducts as any);

      const [result] = await service.findAll();

      expect(result.price).toBe(29000);
      expect(result.stock).toBe(7);
      expect(result.colorOptions).toEqual(['Black']);
      expect(result.sizeOptions).toEqual(['M', 'L']);
      expect(result.variants).toHaveLength(3);
    });

    it('should filter by status when provided', async () => {
      jest.spyOn(prisma.product, 'findMany').mockResolvedValue([]);

      await service.findAll(ProductStatus.AVAILABLE);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: ProductStatus.AVAILABLE }),
        }),
      );
    });
  });

  describe('images handling', () => {
    const baseStream = { id: 'stream-1', streamKey: 'stream-key' };
    const baseProduct = (images: string[]) => ({
      id: 'prod-1',
      streamKey: 'stream-key',
      name: 'Test',
      price: { toString: () => '10000' },
      quantity: 10,
      status: 'AVAILABLE',
      colorOptions: [],
      sizeOptions: [],
      shippingFee: { toString: () => '0' },
      freeShippingMessage: null,
      timerEnabled: false,
      timerDuration: 10,
      imageUrl: null,
      images,
      isNew: false,
      discountRate: null,
      originalPrice: null,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should deduplicate image URLs on create', async () => {
      jest.spyOn(prisma.liveStream, 'findUnique').mockResolvedValue(baseStream as any);
      (prisma.product.create as jest.Mock).mockImplementation(async ({ data }: any) =>
        baseProduct(data.images),
      );

      const result = await service.create({
        streamKey: 'stream-key',
        name: 'Test',
        price: 10000,
        stock: 10,
        images: [
          'https://example.com/a.jpg',
          'https://example.com/a.jpg',
          'https://example.com/b.jpg',
        ],
      });

      expect(result.images).toEqual(['https://example.com/a.jpg', 'https://example.com/b.jpg']);
    });

    it('should trim whitespace from image URLs on create', async () => {
      jest.spyOn(prisma.liveStream, 'findUnique').mockResolvedValue(baseStream as any);
      (prisma.product.create as jest.Mock).mockImplementation(async ({ data }: any) =>
        baseProduct(data.images),
      );

      const result = await service.create({
        streamKey: 'stream-key',
        name: 'Test',
        price: 10000,
        stock: 10,
        images: ['  https://example.com/a.jpg  ', 'https://example.com/b.jpg'],
      });

      expect(result.images).toEqual(['https://example.com/a.jpg', 'https://example.com/b.jpg']);
    });

    it('should return empty array when images is undefined on create', async () => {
      jest.spyOn(prisma.liveStream, 'findUnique').mockResolvedValue(baseStream as any);
      (prisma.product.create as jest.Mock).mockImplementation(async ({ data }: any) =>
        baseProduct(data.images),
      );

      const result = await service.create({
        streamKey: 'stream-key',
        name: 'Test',
        price: 10000,
        stock: 10,
      });

      expect(result.images).toEqual([]);
    });

    it('should deduplicate image URLs on update', async () => {
      const mockProduct = baseProduct([]);
      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(mockProduct as any);
      (prisma.product.update as jest.Mock).mockImplementation(async ({ data }: any) =>
        baseProduct(data.images),
      );

      const result = await service.update('prod-1', {
        images: [
          'https://example.com/x.jpg',
          'https://example.com/x.jpg',
          'https://example.com/y.jpg',
        ],
      });

      expect(result.images).toEqual(['https://example.com/x.jpg', 'https://example.com/y.jpg']);
    });
  });

  describe('getFeaturedProducts', () => {
    it('should return featured products with default limit', async () => {
      jest.spyOn(prisma.product, 'findMany').mockResolvedValue([]);

      await service.getFeaturedProducts();

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'AVAILABLE' }),
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
