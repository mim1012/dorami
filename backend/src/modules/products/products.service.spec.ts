import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: {
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

    service = module.get<ProductsService>(ProductsService);
    prisma = module.get<PrismaService>(PrismaService);
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
});
