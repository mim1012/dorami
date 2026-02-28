import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const mockPrisma = {
  product: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  liveStream: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  cart: {
    aggregate: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockEventEmitter = { emit: jest.fn() };

describe('ProductsService.getLiveDeals', () => {
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
    streamKey: 'stream-abc',
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
    ...overrides,
  });

  const makeLiveStream = (products: ReturnType<typeof makeProduct>[] = []) => ({
    id: 'stream-id-1',
    streamKey: 'stream-abc',
    title: '방송 특가 세일',
    status: 'LIVE',
    products,
  });

  it('should return products, streamTitle, streamKey when active live stream has products', async () => {
    const products = [makeProduct({ id: 'prod-1' }), makeProduct({ id: 'prod-2' })];
    mockPrisma.liveStream.findFirst.mockResolvedValue(makeLiveStream(products));

    const result = await service.getLiveDeals();

    expect(result).not.toBeNull();
    expect(result!.streamTitle).toBe('방송 특가 세일');
    expect(result!.streamKey).toBe('stream-abc');
    expect(result!.products).toHaveLength(2);
  });

  it('should return null when no active live stream', async () => {
    mockPrisma.liveStream.findFirst.mockResolvedValue(null);

    const result = await service.getLiveDeals();

    expect(result).toBeNull();
  });

  it('should return null when active stream has no available products', async () => {
    mockPrisma.liveStream.findFirst.mockResolvedValue(makeLiveStream([]));

    const result = await service.getLiveDeals();

    expect(result).toBeNull();
  });

  it('should query for LIVE status streams only', async () => {
    mockPrisma.liveStream.findFirst.mockResolvedValue(null);

    await service.getLiveDeals();

    expect(mockPrisma.liveStream.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'LIVE' },
      }),
    );
  });

  it('should include only AVAILABLE products ordered by sortOrder then createdAt', async () => {
    mockPrisma.liveStream.findFirst.mockResolvedValue(null);

    await service.getLiveDeals();

    expect(mockPrisma.liveStream.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          products: expect.objectContaining({
            where: { status: 'AVAILABLE' },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            take: 8,
          }),
        }),
      }),
    );
  });

  it('should return mapped ProductResponseDto fields', async () => {
    const product = makeProduct({
      id: 'prod-99',
      name: 'Special Deal Item',
      price: { toString: () => '15000' },
      discountRate: { toString: () => '20' },
      originalPrice: { toString: () => '19000' },
    });
    mockPrisma.liveStream.findFirst.mockResolvedValue(makeLiveStream([product]));

    const result = await service.getLiveDeals();

    expect(result!.products[0]).toMatchObject({
      id: 'prod-99',
      name: 'Special Deal Item',
      price: 15000,
      discountRate: 20,
      originalPrice: 19000,
    });
  });
});
