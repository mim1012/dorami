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
});
