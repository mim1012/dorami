import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('CartService', () => {
  let service: CartService;
  let prismaService: PrismaService;
  let eventEmitter: EventEmitter2;

  const mockProduct = {
    id: 'product-1',
    name: 'Test Product',
    price: new Decimal(29000),
    quantity: 10,
    shippingFee: new Decimal(3000),
    timerEnabled: true,
    timerDuration: 10, // minutes
    status: 'AVAILABLE',
    streamKey: 'stream-key-1',
  };

  const mockCartItem = {
    id: 'cart-1',
    userId: 'user-1',
    productId: 'product-1',
    productName: 'Test Product',
    price: new Decimal(29000),
    quantity: 1,
    color: 'Red',
    size: 'M',
    shippingFee: new Decimal(3000),
    timerEnabled: true,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        {
          provide: PrismaService,
          useValue: {
            product: {
              findUnique: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
            },
            cart: {
              aggregate: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
              updateMany: jest.fn(),
            },
            user: {
              findUnique: jest.fn().mockResolvedValue(null),
            },
            liveStream: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            $transaction: jest.fn(),
            systemConfig: {
              findFirst: jest.fn().mockResolvedValue({
                defaultShippingFee: 10,
                caShippingFee: 8,
                freeShippingEnabled: false,
                freeShippingThreshold: 150,
              }),
            },
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            decryptAddress: jest.fn((v) => v),
            encryptAddress: jest.fn((v) => v),
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

    service = module.get<CartService>(CartService);
    prismaService = module.get<PrismaService>(PrismaService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addToCart', () => {
    it('should add new product to cart with timer', async () => {
      jest.spyOn(prismaService.product, 'findUnique').mockResolvedValue(mockProduct as any);
      jest.spyOn(prismaService.cart, 'aggregate').mockResolvedValue({
        _sum: { quantity: 0 },
        _count: 0,
        _avg: { quantity: null },
        _min: { quantity: null },
        _max: { quantity: null },
      } as any);
      jest.spyOn(prismaService.cart, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.cart, 'create').mockResolvedValue(mockCartItem as any);
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({ name: 'Test User' } as any);
      (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          cart: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
            create: jest.fn().mockResolvedValue(mockCartItem),
          },
        };
        return callback(tx);
      });

      const result = await service.addToCart('user-1', {
        productId: 'product-1',
        quantity: 1,
        color: 'Red',
        size: 'M',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('cart-1');
      expect(result.productId).toBe('product-1');
      expect(result.timerEnabled).toBe(true);
      expect(result.expiresAt).toBeDefined();
      // cart.create is called inside the $transaction callback on tx, not on prismaService directly
      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cart:added',
        expect.objectContaining({
          userId: 'user-1',
          productId: 'product-1',
          productName: 'Test Product',
        }),
      );
    });

    it('should throw NotFoundException when product not found', async () => {
      jest.spyOn(prismaService.product, 'findUnique').mockResolvedValue(null);
      jest
        .spyOn(prismaService.cart, 'aggregate')
        .mockResolvedValue({ _sum: { quantity: 0 } } as any);
      jest.spyOn(prismaService.cart, 'findFirst').mockResolvedValue(null);

      await expect(
        service.addToCart('user-1', { productId: 'invalid', quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when product is not available', async () => {
      jest.spyOn(prismaService.product, 'findUnique').mockResolvedValue({
        ...mockProduct,
        status: 'SOLD_OUT',
      } as any);
      jest
        .spyOn(prismaService.cart, 'aggregate')
        .mockResolvedValue({ _sum: { quantity: 0 } } as any);
      jest.spyOn(prismaService.cart, 'findFirst').mockResolvedValue(null);

      await expect(
        service.addToCart('user-1', { productId: 'product-1', quantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when insufficient stock', async () => {
      jest.spyOn(prismaService.product, 'findUnique').mockResolvedValue(mockProduct as any);
      jest
        .spyOn(prismaService.cart, 'aggregate')
        .mockResolvedValue({ _sum: { quantity: 8 } } as any);
      jest.spyOn(prismaService.cart, 'findFirst').mockResolvedValue(null);

      await expect(
        service.addToCart('user-1', { productId: 'product-1', quantity: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update existing cart item quantity when same product/color/size', async () => {
      jest.spyOn(prismaService.product, 'findUnique').mockResolvedValue(mockProduct as any);
      jest
        .spyOn(prismaService.cart, 'aggregate')
        .mockResolvedValue({ _sum: { quantity: 1 } } as any);
      jest.spyOn(prismaService.cart, 'findFirst').mockResolvedValue(mockCartItem as any);

      const updatedItem = { ...mockCartItem, quantity: 2 };
      (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          cart: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 1 } }),
            update: jest.fn().mockResolvedValue(updatedItem),
          },
        };
        return callback(tx);
      });

      const result = await service.addToCart('user-1', {
        productId: 'product-1',
        quantity: 1,
        color: 'Red',
        size: 'M',
      });

      expect(result.quantity).toBe(2);
    });

    it('should create cart item without timer when product timer disabled', async () => {
      const noTimerProduct = { ...mockProduct, timerEnabled: false };
      const noTimerCartItem = { ...mockCartItem, timerEnabled: false, expiresAt: null };

      jest.spyOn(prismaService.product, 'findUnique').mockResolvedValue(noTimerProduct as any);
      jest
        .spyOn(prismaService.cart, 'aggregate')
        .mockResolvedValue({ _sum: { quantity: 0 } } as any);
      jest.spyOn(prismaService.cart, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.cart, 'create').mockResolvedValue(noTimerCartItem as any);
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({ name: 'Test User' } as any);
      (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          cart: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
            create: jest.fn().mockResolvedValue(noTimerCartItem),
          },
        };
        return callback(tx);
      });

      const result = await service.addToCart('user-1', {
        productId: 'product-1',
        quantity: 1,
      });

      expect(result.timerEnabled).toBe(false);
      expect(result.expiresAt).toBeUndefined();
    });
  });

  describe('getCart', () => {
    it('should return cart summary with items', async () => {
      jest.spyOn(prismaService.cart, 'findMany').mockResolvedValue([mockCartItem] as any);

      const result = await service.getCart('user-1');

      expect(result.itemCount).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.subtotal).toBe(29000);
      expect(result.totalShippingFee).toBe(10);
      expect(result.grandTotal).toBe(29010);
    });

    it('should return empty cart when no active items', async () => {
      jest.spyOn(prismaService.cart, 'findMany').mockResolvedValue([]);

      const result = await service.getCart('user-1');

      expect(result.itemCount).toBe(0);
      expect(result.items).toHaveLength(0);
      expect(result.grandTotal).toBe(0);
    });

    it('should calculate correct totals for multiple items', async () => {
      const items = [
        mockCartItem,
        {
          ...mockCartItem,
          id: 'cart-2',
          price: new Decimal(50000),
          quantity: 2,
          shippingFee: new Decimal(5000),
        },
      ];
      jest.spyOn(prismaService.cart, 'findMany').mockResolvedValue(items as any);

      const result = await service.getCart('user-1');

      expect(result.itemCount).toBe(2);
      expect(result.subtotal).toBe(29000 + 100000); // 29000*1 + 50000*2
      expect(result.totalShippingFee).toBe(10);
      expect(result.grandTotal).toBe(129010);
    });
  });

  describe('updateCartItem', () => {
    it('should update cart item quantity', async () => {
      jest.spyOn(prismaService.cart, 'findFirst').mockResolvedValue(mockCartItem as any);
      jest.spyOn(prismaService.product, 'findUnique').mockResolvedValue(mockProduct as any);
      jest
        .spyOn(prismaService.cart, 'aggregate')
        .mockResolvedValue({ _sum: { quantity: 1 } } as any);
      jest.spyOn(prismaService.cart, 'update').mockResolvedValue({
        ...mockCartItem,
        quantity: 3,
      } as any);

      const result = await service.updateCartItem('user-1', 'cart-1', { quantity: 3 });

      expect(result.quantity).toBe(3);
    });

    it('should throw NotFoundException when cart item not found', async () => {
      jest.spyOn(prismaService.cart, 'findFirst').mockResolvedValue(null);

      await expect(service.updateCartItem('user-1', 'invalid', { quantity: 2 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when insufficient stock for update', async () => {
      jest.spyOn(prismaService.cart, 'findFirst').mockResolvedValue(mockCartItem as any);
      jest.spyOn(prismaService.product, 'findUnique').mockResolvedValue(mockProduct as any);
      jest
        .spyOn(prismaService.cart, 'aggregate')
        .mockResolvedValue({ _sum: { quantity: 5 } } as any);

      await expect(service.updateCartItem('user-1', 'cart-1', { quantity: 10 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('removeCartItem', () => {
    it('should remove cart item', async () => {
      jest.spyOn(prismaService.cart, 'findFirst').mockResolvedValue(mockCartItem as any);
      jest.spyOn(prismaService.cart, 'delete').mockResolvedValue(mockCartItem as any);

      await service.removeCartItem('user-1', 'cart-1');

      expect(prismaService.cart.delete).toHaveBeenCalledWith({
        where: { id: 'cart-1' },
      });
    });

    it('should throw NotFoundException when cart item not found', async () => {
      jest.spyOn(prismaService.cart, 'findFirst').mockResolvedValue(null);

      await expect(service.removeCartItem('user-1', 'invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('clearCart', () => {
    it('should clear all active cart items for user', async () => {
      const mockCartItems = [
        { ...mockCartItem, id: 'cart-1', productId: 'product-1' },
        { ...mockCartItem, id: 'cart-2', productId: 'product-2' },
      ];
      jest.spyOn(prismaService.cart, 'findMany').mockResolvedValue(mockCartItems as any);
      jest.spyOn(prismaService.cart, 'deleteMany').mockResolvedValue({ count: 2 });

      await service.clearCart('user-1');

      expect(prismaService.cart.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'ACTIVE' },
      });
    });
  });

  describe('expireTimedOutCarts', () => {
    it('should expire timed-out carts and emit events', async () => {
      const expiredCarts = [
        { ...mockCartItem, id: 'cart-1', productId: 'product-1' },
        { ...mockCartItem, id: 'cart-2', productId: 'product-2' },
      ];
      jest.spyOn(prismaService.cart, 'findMany').mockResolvedValue(expiredCarts as any);
      jest.spyOn(prismaService.cart, 'updateMany').mockResolvedValue({ count: 2 });

      await service.expireTimedOutCarts();

      expect(prismaService.cart.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['cart-1', 'cart-2'] } },
        data: { status: 'EXPIRED' },
      });

      // Should emit cart:product:released for each unique product
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cart:product:released',
        expect.objectContaining({ productId: 'product-1' }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cart:product:released',
        expect.objectContaining({ productId: 'product-2' }),
      );

      // Should emit general cart:expired event
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cart:expired',
        expect.objectContaining({ count: 2 }),
      );
    });

    it('should do nothing when no expired carts found', async () => {
      jest.spyOn(prismaService.cart, 'findMany').mockResolvedValue([]);

      await service.expireTimedOutCarts();

      expect(prismaService.cart.updateMany).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should deduplicate product IDs for released events', async () => {
      const expiredCarts = [
        { ...mockCartItem, id: 'cart-1', productId: 'product-1' },
        { ...mockCartItem, id: 'cart-2', productId: 'product-1' }, // same product
        { ...mockCartItem, id: 'cart-3', productId: 'product-2' },
      ];
      jest.spyOn(prismaService.cart, 'findMany').mockResolvedValue(expiredCarts as any);
      jest.spyOn(prismaService.cart, 'updateMany').mockResolvedValue({ count: 3 });

      await service.expireTimedOutCarts();

      // Should emit only 2 product:released events (deduplicated)
      const releasedCalls = (eventEmitter.emit as jest.Mock).mock.calls.filter(
        (call) => call[0] === 'cart:product:released',
      );
      expect(releasedCalls).toHaveLength(2);
    });

    it('should handle errors gracefully without throwing', async () => {
      jest.spyOn(prismaService.cart, 'findMany').mockRejectedValue(new Error('DB error'));

      // Should not throw
      await expect(service.expireTimedOutCarts()).resolves.toBeUndefined();
    });
  });
});
