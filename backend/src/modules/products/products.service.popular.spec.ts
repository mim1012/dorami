import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const mockPrisma = {
  product: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  cart: {
    aggregate: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockEventEmitter = { emit: jest.fn() };

describe('ProductsService.getPopularProducts', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  const makeProduct = (overrides: Record<string, unknown> = {}) => ({
    id: 'prod-1',
    streamKey: null,
    name: 'Test Product',
    price: { toString: () => '29000' },
    quantity: 10,
    colorOptions: [],
    sizeOptions: [],
    shippingFee: { toString: () => '0' },
    freeShippingMessage: null,
    timerEnabled: false,
    timerDuration: 10,
    imageUrl: null,
    images: [],
    sortOrder: 0,
    isNew: false,
    discountRate: null,
    originalPrice: null,
    status: 'AVAILABLE',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    _count: { orderItems: 5 },
    ...overrides,
  });

  it('should return products sorted by soldCount DESC', async () => {
    const products = [
      makeProduct({ id: 'prod-1', _count: { orderItems: 10 } }),
      makeProduct({ id: 'prod-2', _count: { orderItems: 5 } }),
      makeProduct({ id: 'prod-3', _count: { orderItems: 1 } }),
    ];
    mockPrisma.product.findMany.mockResolvedValue(products);
    mockPrisma.product.count.mockResolvedValue(3);

    const result = await service.getPopularProducts(1, 8);

    expect(result.data[0].soldCount).toBe(10);
    expect(result.data[1].soldCount).toBe(5);
    expect(result.data[2].soldCount).toBe(1);
    expect(result.data).toHaveLength(3);
  });

  it('should handle pagination correctly', async () => {
    mockPrisma.product.findMany.mockResolvedValue([makeProduct()]);
    mockPrisma.product.count.mockResolvedValue(20);

    const result = await service.getPopularProducts(2, 8);

    expect(result.meta.page).toBe(2);
    expect(result.meta.limit).toBe(8);
    expect(result.meta.total).toBe(20);
    expect(result.meta.totalPages).toBe(3);

    // Verify skip was calculated correctly
    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 8, take: 8 }),
    );
  });

  it('should only count PAYMENT_CONFIRMED, SHIPPED, DELIVERED orders', async () => {
    mockPrisma.product.findMany.mockResolvedValue([makeProduct()]);
    mockPrisma.product.count.mockResolvedValue(1);

    await service.getPopularProducts(1, 8);

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          _count: expect.objectContaining({
            select: expect.objectContaining({
              orderItems: expect.objectContaining({
                where: {
                  order: {
                    status: { in: ['PAYMENT_CONFIRMED', 'SHIPPED', 'DELIVERED'] },
                  },
                },
              }),
            }),
          }),
        }),
      }),
    );
  });

  it('should exclude SOLD_OUT products', async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.product.count.mockResolvedValue(0);

    await service.getPopularProducts(1, 8);

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'AVAILABLE' },
      }),
    );
    expect(mockPrisma.product.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'AVAILABLE' },
      }),
    );
  });

  it('should return soldCount of 0 when product has no qualifying orders', async () => {
    mockPrisma.product.findMany.mockResolvedValue([makeProduct({ _count: { orderItems: 0 } })]);
    mockPrisma.product.count.mockResolvedValue(1);

    const result = await service.getPopularProducts(1, 8);

    expect(result.data[0].soldCount).toBe(0);
  });

  it('should use orderItems count desc ordering', async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.product.count.mockResolvedValue(0);

    await service.getPopularProducts(1, 8);

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { orderItems: { _count: 'desc' } },
      }),
    );
  });
});
