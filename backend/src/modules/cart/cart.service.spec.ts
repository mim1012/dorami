import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InsufficientStockException } from '../../common/exceptions/business.exception';
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
              update: jest.fn(),
            },
            productVariant: {
              findFirst: jest.fn(),
              update: jest.fn(),
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
            reservation: {
              updateMany: jest.fn(),
            },
            user: {
              findUnique: jest.fn().mockResolvedValue(null),
            },
            liveStream: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            orderItem: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
            $transaction: jest.fn(),
            systemConfig: {
              findFirst: jest.fn().mockResolvedValue({
                defaultShippingFee: 10,
                caShippingFee: 8,
                freeShippingEnabled: false,
                freeShippingThreshold: 150,
                abandonedCartReminderHours: 24,
              }),
            },
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            decryptAddress: jest.fn((v) => v),
            encryptAddress: jest.fn((v) => v),
            normalizeAddressValue: jest.fn((v) => v),
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
          product: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(mockProduct),
          },
          cart: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
            create: jest.fn().mockResolvedValue(mockCartItem),
            findFirst: jest.fn().mockResolvedValue(null),
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
        quantity: 0,
      } as any);
      jest
        .spyOn(prismaService.cart, 'aggregate')
        .mockResolvedValue({ _sum: { quantity: 0 } } as any);
      jest.spyOn(prismaService.cart, 'findFirst').mockResolvedValue(null);

      await expect(
        service.addToCart('user-1', { productId: 'product-1', quantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should still block purchase when product is SOLD_OUT even if quantity remains', async () => {
      jest.spyOn(prismaService.product, 'findUnique').mockResolvedValue({
        ...mockProduct,
        status: 'SOLD_OUT',
        quantity: 5,
      } as any);
      jest
        .spyOn(prismaService.cart, 'aggregate')
        .mockResolvedValue({ _sum: { quantity: 0 } } as any);
      jest.spyOn(prismaService.cart, 'findFirst').mockResolvedValue(null);

      await expect(
        service.addToCart('user-1', { productId: 'product-1', quantity: 1 }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaService.product.update).not.toHaveBeenCalled();
    });

    it('should throw InsufficientStockException when insufficient stock', async () => {
      jest.spyOn(prismaService.product, 'findUnique').mockResolvedValue(mockProduct as any);
      jest
        .spyOn(prismaService.cart, 'aggregate')
        .mockResolvedValue({ _sum: { quantity: 8 } } as any);
      jest.spyOn(prismaService.cart, 'findFirst').mockResolvedValue(null);

      (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          product: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(mockProduct),
          },
          cart: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 8 } }),
          },
        };
        return callback(tx);
      });

      await expect(
        service.addToCart('user-1', { productId: 'product-1', quantity: 5 }),
      ).rejects.toThrow(InsufficientStockException);
    });

    it('should allow adding more than 10 items when stock permits', async () => {
      const highStockProduct = { ...mockProduct, quantity: 25, timerEnabled: false };
      const createdCartItem = {
        ...mockCartItem,
        quantity: 12,
        timerEnabled: false,
        expiresAt: null,
      };

      jest.spyOn(prismaService.product, 'findUnique').mockResolvedValue(highStockProduct as any);
      jest
        .spyOn(prismaService.cart, 'aggregate')
        .mockResolvedValue({ _sum: { quantity: 0 } } as any);
      jest.spyOn(prismaService.cart, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.cart, 'create').mockResolvedValue(createdCartItem as any);
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({ name: 'Test User' } as any);

      (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          product: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(highStockProduct),
          },
          cart: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
            create: jest.fn().mockResolvedValue(createdCartItem),
            findFirst: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(tx);
      });

      const result = await service.addToCart('user-1', {
        productId: 'product-1',
        quantity: 12,
      });

      expect(result.quantity).toBe(12);
      expect(prismaService.$transaction).toHaveBeenCalled();
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
          product: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(mockProduct),
          },
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
          product: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(noTimerProduct),
          },
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

    it('should use variant snapshot fields and variant stock when variantId is provided', async () => {
      const variantProduct = { ...mockProduct, quantity: 999 };
      const variant = {
        id: 'variant-1',
        productId: 'product-1',
        color: 'Black',
        size: 'M',
        label: 'Black / M',
        price: new Decimal(31000),
        stock: 4,
        status: 'ACTIVE',
        deletedAt: null,
      };
      const createdCartItem = {
        ...mockCartItem,
        variantId: 'variant-1',
        variantLabel: 'Black / M',
        color: 'Black',
        size: 'M',
        price: new Decimal(31000),
      };

      (prismaService as any).productVariant = {
        findFirst: jest.fn().mockResolvedValue(variant),
      };
      jest.spyOn(prismaService.product, 'findUnique').mockResolvedValue(variantProduct as any);
      jest.spyOn(prismaService.cart, 'findFirst').mockResolvedValue(null);

      const tx = {
        product: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(variantProduct),
        },
        productVariant: {
          findFirst: jest.fn().mockResolvedValue(variant),
        },
        cart: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 1 } }),
          create: jest.fn().mockResolvedValue(createdCartItem),
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };
      (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) =>
        callback(tx),
      );

      const result = await service.addToCart('user-1', {
        productId: 'product-1',
        variantId: 'variant-1',
        quantity: 2,
      });

      expect(tx.cart.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            variantId: 'variant-1',
            variantLabel: 'Black / M',
            color: 'Black',
            size: 'M',
            price: new Decimal(31000),
          }),
        }),
      );
      expect(result.variantId).toBe('variant-1');
      expect(result.variantLabel).toBe('Black / M');
      expect(result.price).toBe('31000');
    });
  });

  describe('getCart', () => {
    it('should return cart summary with items', async () => {
      jest.spyOn(prismaService.cart, 'findMany').mockResolvedValue([mockCartItem] as any);

      const result = await service.getCart('user-1');

      expect(result.itemCount).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.subtotal).toBe('29000');
      expect(result.totalShippingFee).toBe('10');
      expect(result.grandTotal).toBe('29010');
    });

    it('should return empty cart when no active items', async () => {
      jest.spyOn(prismaService.cart, 'findMany').mockResolvedValue([]);

      const result = await service.getCart('user-1');

      expect(result.itemCount).toBe(0);
      expect(result.items).toHaveLength(0);
      expect(result.grandTotal).toBe('0');
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
      expect(result.subtotal).toBe('129000'); // 29000*1 + 50000*2
      expect(result.totalShippingFee).toBe('10');
      expect(result.grandTotal).toBe('129010');
    });

    it('should waive shipping for repeat orders in the same stream', async () => {
      jest.spyOn(prismaService.cart, 'findMany').mockResolvedValue([mockCartItem] as any);
      jest
        .spyOn(prismaService.product, 'findMany')
        .mockResolvedValue([{ streamKey: 'stream-key-1' }] as any);
      jest
        .spyOn(prismaService.orderItem, 'findFirst')
        .mockResolvedValue({ id: 'prior-order-item' } as any);

      const result = await service.getCart('user-1');

      expect(result.shippingWaived).toBe(true);
      expect(result.totalShippingFee).toBe('0');
      expect(result.grandTotal).toBe('29000');
    });
  });

  describe('updateCartItem', () => {
    it('should update cart item quantity and refresh timer', async () => {
      jest.spyOn(prismaService.cart, 'findFirst').mockResolvedValue(mockCartItem as any);
      jest.spyOn(prismaService.product, 'findUnique').mockResolvedValue(mockProduct as any);

      const updatedItem = { ...mockCartItem, quantity: 3 };
      (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          product: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(mockProduct),
          },
          cart: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 1 } }),
            update: jest.fn().mockResolvedValue(updatedItem),
          },
        };
        return callback(tx);
      });

      const result = await service.updateCartItem('user-1', 'cart-1', { quantity: 3 });

      expect(result.quantity).toBe(3);
      // Timer should be refreshed since product.timerEnabled is true
      expect(result.expiresAt).toBeDefined();
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should enforce variant stock when updating a variant-backed cart item', async () => {
      const variantCartItem = {
        ...mockCartItem,
        variantId: 'variant-1',
        variantLabel: 'Black / M',
        color: 'Black',
        size: 'M',
        quantity: 1,
      };
      const variantProduct = { ...mockProduct, quantity: 999 };
      const variant = {
        id: 'variant-1',
        productId: 'product-1',
        stock: 2,
        status: 'ACTIVE',
        color: 'Black',
        size: 'M',
        label: 'Black / M',
        deletedAt: null,
      };

      jest.spyOn(prismaService.cart, 'findFirst').mockResolvedValue(variantCartItem as any);
      jest.spyOn(prismaService.product, 'findUnique').mockResolvedValue(variantProduct as any);

      (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          product: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(variantProduct),
          },
          productVariant: {
            findFirst: jest.fn().mockResolvedValue(variant),
          },
          cart: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 1 } }),
            update: jest.fn(),
          },
        };
        return callback(tx);
      });

      await expect(service.updateCartItem('user-1', 'cart-1', { quantity: 3 })).rejects.toThrow(
        InsufficientStockException,
      );
    });

    it('should allow updating cart item quantity beyond 10 when stock permits', async () => {
      const highStockProduct = { ...mockProduct, quantity: 25, timerEnabled: false };
      const highQuantityCartItem = {
        ...mockCartItem,
        quantity: 12,
        timerEnabled: false,
        expiresAt: null,
      };

      jest.spyOn(prismaService.cart, 'findFirst').mockResolvedValue(mockCartItem as any);
      jest.spyOn(prismaService.product, 'findUnique').mockResolvedValue(highStockProduct as any);

      (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          product: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(highStockProduct),
          },
          cart: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 1 } }),
            update: jest.fn().mockResolvedValue(highQuantityCartItem),
          },
        };
        return callback(tx);
      });

      const result = await service.updateCartItem('user-1', 'cart-1', { quantity: 12 });

      expect(result.quantity).toBe(12);
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when cart item not found', async () => {
      jest.spyOn(prismaService.cart, 'findFirst').mockResolvedValue(null);

      await expect(service.updateCartItem('user-1', 'invalid', { quantity: 2 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InsufficientStockException when insufficient stock for update', async () => {
      jest.spyOn(prismaService.cart, 'findFirst').mockResolvedValue(mockCartItem as any);
      jest.spyOn(prismaService.product, 'findUnique').mockResolvedValue(mockProduct as any);

      (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          product: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(mockProduct),
          },
          cart: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 5 } }),
            update: jest.fn(),
          },
        };
        return callback(tx);
      });

      await expect(service.updateCartItem('user-1', 'cart-1', { quantity: 10 })).rejects.toThrow(
        InsufficientStockException,
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

  describe('mapToResponseDto decimal precision (via getCart)', () => {
    /**
     * These tests verify the cent-based arithmetic fix in mapToResponseDto.
     * Before the fix, direct float multiplication caused IEEE-754 rounding errors
     * (e.g. 12.70 * 3 = 38.10000000000001). The fix converts to integer cents
     * first (Math.round(price * 100) * quantity) then divides back.
     *
     * All cases test through getCart() since mapToResponseDto is private.
     * The systemConfig mock in beforeEach returns defaultShippingFee=10, so
     * each item has shippingFee=0 stored (shipping is per-order, not per-item).
     */

    function makeCartItem(id: string, price: number, quantity: number, shippingFee: number = 0) {
      return {
        id,
        userId: 'user-1',
        productId: 'product-1',
        productName: 'Test Product',
        price: new Decimal(price),
        quantity,
        color: null,
        size: null,
        shippingFee: new Decimal(shippingFee),
        timerEnabled: false,
        expiresAt: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        product: null,
      };
    }

    it('returns subtotal "38.10" for price=12.70, quantity=3 (classic float trap)', async () => {
      jest
        .spyOn(prismaService.cart, 'findMany')
        .mockResolvedValue([makeCartItem('c1', 12.7, 3)] as any);

      const result = await service.getCart('user-1');

      expect(result.items[0].subtotal).toBe('38.10');
    });

    it('returns total "38.10" when shippingFee is zero for price=12.70, quantity=3', async () => {
      jest
        .spyOn(prismaService.cart, 'findMany')
        .mockResolvedValue([makeCartItem('c1', 12.7, 3, 0)] as any);

      const result = await service.getCart('user-1');

      expect(result.items[0].total).toBe('38.10');
    });

    it('returns total "0.30" for price=0.10, shippingFee=0.20 (classic 0.1+0.2 float trap)', async () => {
      jest
        .spyOn(prismaService.cart, 'findMany')
        .mockResolvedValue([makeCartItem('c1', 0.1, 1, 0.2)] as any);

      const result = await service.getCart('user-1');

      expect(result.items[0].total).toBe('0.30');
    });

    it('returns subtotal "20.00" for integer price=10, quantity=2', async () => {
      jest
        .spyOn(prismaService.cart, 'findMany')
        .mockResolvedValue([makeCartItem('c1', 10, 2)] as any);

      const result = await service.getCart('user-1');

      expect(result.items[0].subtotal).toBe('20.00');
    });

    it('returns subtotal "19.99" and total "25.49" for price=19.99, quantity=1, shippingFee=5.50', async () => {
      jest
        .spyOn(prismaService.cart, 'findMany')
        .mockResolvedValue([makeCartItem('c1', 19.99, 1, 5.5)] as any);

      const result = await service.getCart('user-1');

      expect(result.items[0].subtotal).toBe('19.99');
      expect(result.items[0].total).toBe('25.49');
    });

    it('returns subtotal "0.00" for price=0, quantity=5', async () => {
      jest
        .spyOn(prismaService.cart, 'findMany')
        .mockResolvedValue([makeCartItem('c1', 0, 5)] as any);

      const result = await service.getCart('user-1');

      expect(result.items[0].subtotal).toBe('0.00');
    });

    it('returns subtotal "999.00" for price=9.99, quantity=100 (large quantity)', async () => {
      jest
        .spyOn(prismaService.cart, 'findMany')
        .mockResolvedValue([makeCartItem('c1', 9.99, 100)] as any);

      const result = await service.getCart('user-1');

      expect(result.items[0].subtotal).toBe('999.00');
    });
  });

  describe('sendCartReminders', () => {
    it('should target active carts linked to streams that ended before the configured delay', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-04-16T12:00:00.000Z'));
      jest.spyOn(prismaService.cart, 'findMany').mockResolvedValue([] as any);

      await service.sendCartReminders();

      expect(prismaService.cart.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
            reminderSent: false,
            product: {
              is: {
                streamKey: { not: null },
                liveStream: {
                  is: {
                    endedAt: {
                      not: null,
                      lte: new Date('2026-04-15T12:00:00.000Z'),
                    },
                  },
                },
              },
            },
          }),
        }),
      );
      expect(prismaService.cart.findMany).toHaveBeenCalledWith(
        expect.not.objectContaining({
          where: expect.objectContaining({ createdAt: expect.anything() }),
        }),
      );

      jest.useRealTimers();
    });

    it('should allow zero-hour delay and emit reminders grouped by user and stream', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-04-16T12:00:00.000Z'));
      jest
        .spyOn(prismaService.systemConfig, 'findFirst')
        .mockResolvedValue({ abandonedCartReminderHours: 0 } as any);
      jest.spyOn(prismaService.cart, 'findMany').mockResolvedValue([
        {
          id: 'cart-1',
          userId: 'user-1',
          productId: 'product-1',
          productName: '첫 상품',
          product: {
            streamKey: 'stream-1',
            liveStream: { endedAt: new Date('2026-04-16T11:59:00.000Z') },
          },
        },
        {
          id: 'cart-2',
          userId: 'user-1',
          productId: 'product-2',
          productName: '둘째 상품',
          product: {
            streamKey: 'stream-1',
            liveStream: { endedAt: new Date('2026-04-16T11:59:00.000Z') },
          },
        },
        {
          id: 'cart-3',
          userId: 'user-1',
          productId: 'product-3',
          productName: '다른 방송 상품',
          product: {
            streamKey: 'stream-2',
            liveStream: { endedAt: new Date('2026-04-16T11:58:00.000Z') },
          },
        },
      ] as any);
      jest.spyOn(prismaService.cart, 'updateMany').mockResolvedValue({ count: 3 } as any);

      await service.sendCartReminders();

      expect(prismaService.cart.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            product: {
              is: {
                streamKey: { not: null },
                liveStream: {
                  is: {
                    endedAt: {
                      not: null,
                      lte: new Date('2026-04-16T12:00:00.000Z'),
                    },
                  },
                },
              },
            },
          }),
        }),
      );
      expect(prismaService.cart.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['cart-1', 'cart-2', 'cart-3'] } },
        data: { reminderSent: true },
      });
      expect(eventEmitter.emit).toHaveBeenNthCalledWith(1, 'cart:reminder', {
        userId: 'user-1',
        productIds: ['product-1', 'product-2'],
        productNames: ['첫 상품', '둘째 상품'],
        streamKey: 'stream-1',
        reminderDelayHours: 0,
        streamEndedAt: new Date('2026-04-16T11:59:00.000Z'),
      });
      expect(eventEmitter.emit).toHaveBeenNthCalledWith(2, 'cart:reminder', {
        userId: 'user-1',
        productIds: ['product-3'],
        productNames: ['다른 방송 상품'],
        streamKey: 'stream-2',
        reminderDelayHours: 0,
        streamEndedAt: new Date('2026-04-16T11:58:00.000Z'),
      });

      jest.useRealTimers();
    });

    it('should trigger immediate reminders only for the ended stream when delay is 0', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-04-16T12:00:00.000Z'));
      jest
        .spyOn(prismaService.systemConfig, 'findFirst')
        .mockResolvedValue({ abandonedCartReminderHours: 0 } as any);
      jest.spyOn(prismaService.cart, 'findMany').mockResolvedValue([
        {
          id: 'cart-1',
          userId: 'user-1',
          productId: 'product-1',
          productName: '첫 상품',
          product: {
            streamKey: 'stream-1',
            liveStream: { endedAt: new Date('2026-04-16T11:59:00.000Z') },
          },
        },
      ] as any);
      jest.spyOn(prismaService.cart, 'updateMany').mockResolvedValue({ count: 1 } as any);

      await service.triggerImmediateStreamEndReminders('stream-1');

      expect(prismaService.cart.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            product: {
              is: expect.objectContaining({
                streamKey: 'stream-1',
              }),
            },
          }),
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('cart:reminder', {
        userId: 'user-1',
        productIds: ['product-1'],
        productNames: ['첫 상품'],
        streamKey: 'stream-1',
        reminderDelayHours: 0,
        streamEndedAt: new Date('2026-04-16T11:59:00.000Z'),
      });

      jest.useRealTimers();
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
