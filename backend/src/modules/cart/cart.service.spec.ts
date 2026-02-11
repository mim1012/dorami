import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('CartService', () => {
  let service: CartService;

  const mockPrisma = {
    product: {
      findUnique: jest.fn(),
    },
    cart: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      aggregate: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((cb: any) => cb(mockPrisma)),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockProduct = {
    id: 'product-1',
    name: 'Test Product',
    price: new Decimal(29000),
    shippingFee: new Decimal(3000),
    quantity: 100,
    status: 'AVAILABLE',
    timerEnabled: true,
    timerDuration: 10,
    streamKey: 'stream-key-1',
    imageUrl: '/img.png',
  };

  const mockCartItem = {
    id: 'cart-1',
    userId: 'user-123',
    productId: 'product-1',
    productName: 'Test Product',
    price: new Decimal(29000),
    quantity: 1,
    color: 'Red',
    size: 'M',
    shippingFee: new Decimal(3000),
    timerEnabled: true,
    expiresAt: new Date(Date.now() + 600000),
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    module.get<PrismaService>(PrismaService);
    module.get<EventEmitter2>(EventEmitter2);

    jest.clearAllMocks();
  });

  describe('addToCart', () => {
    const userId = 'user-123';
    const addToCartDto = { productId: 'product-1', quantity: 1, color: 'Red', size: 'M' };

    it('should add a new item to cart', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.cart.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
      mockPrisma.cart.findFirst.mockResolvedValue(null);
      mockPrisma.cart.create.mockResolvedValue(mockCartItem);
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Test User' });

      const result = await service.addToCart(userId, addToCartDto);

      expect(result.productId).toBe('product-1');
      expect(result.quantity).toBe(1);
      expect(result.subtotal).toBe(29000);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'cart:added',
        expect.objectContaining({ productId: 'product-1' }),
      );
    });

    it('should update quantity if same product already in cart', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.cart.aggregate.mockResolvedValue({ _sum: { quantity: 1 } });
      mockPrisma.cart.findFirst.mockResolvedValue(mockCartItem);
      // Transaction mock — re-check stock + update
      mockPrisma.cart.update.mockResolvedValue({ ...mockCartItem, quantity: 2 });

      const result = await service.addToCart(userId, addToCartDto);

      expect(result.quantity).toBe(2);
    });

    it('should throw NotFoundException if product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      mockPrisma.cart.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
      mockPrisma.cart.findFirst.mockResolvedValue(null);

      await expect(service.addToCart(userId, addToCartDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if product not available', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, status: 'SOLD_OUT' });
      mockPrisma.cart.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
      mockPrisma.cart.findFirst.mockResolvedValue(null);

      await expect(service.addToCart(userId, addToCartDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if insufficient stock', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, quantity: 5 });
      mockPrisma.cart.aggregate.mockResolvedValue({ _sum: { quantity: 5 } }); // all reserved
      mockPrisma.cart.findFirst.mockResolvedValue(null);

      await expect(service.addToCart(userId, addToCartDto)).rejects.toThrow(BadRequestException);
    });

    it('should set expiresAt when timer is enabled', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.cart.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
      mockPrisma.cart.findFirst.mockResolvedValue(null);
      mockPrisma.cart.create.mockResolvedValue(mockCartItem);
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Test User' });

      await service.addToCart(userId, addToCartDto);

      expect(mockPrisma.cart.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            timerEnabled: true,
            expiresAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should set expiresAt to null when timer is disabled', async () => {
      const noTimerProduct = { ...mockProduct, timerEnabled: false };
      mockPrisma.product.findUnique.mockResolvedValue(noTimerProduct);
      mockPrisma.cart.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
      mockPrisma.cart.findFirst.mockResolvedValue(null);
      mockPrisma.cart.create.mockResolvedValue({
        ...mockCartItem,
        timerEnabled: false,
        expiresAt: null,
      });
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Test User' });

      await service.addToCart(userId, addToCartDto);

      expect(mockPrisma.cart.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            timerEnabled: false,
            expiresAt: null,
          }),
        }),
      );
    });
  });

  describe('getCart', () => {
    it('should return cart summary with calculated totals', async () => {
      mockPrisma.cart.findMany.mockResolvedValue([mockCartItem]);

      const result = await service.getCart('user-123');

      expect(result.itemCount).toBe(1);
      expect(result.subtotal).toBe(29000);
      expect(result.totalShippingFee).toBe(3000);
      expect(result.grandTotal).toBe(32000);
    });

    it('should return empty cart', async () => {
      mockPrisma.cart.findMany.mockResolvedValue([]);

      const result = await service.getCart('user-123');

      expect(result.itemCount).toBe(0);
      expect(result.grandTotal).toBe(0);
    });
  });

  describe('updateCartItem', () => {
    it('should update item quantity', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue(mockCartItem);
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.cart.aggregate.mockResolvedValue({ _sum: { quantity: 1 } });
      mockPrisma.cart.update.mockResolvedValue({ ...mockCartItem, quantity: 3 });

      const result = await service.updateCartItem('user-123', 'cart-1', { quantity: 3 });

      expect(result.quantity).toBe(3);
    });

    it('should throw NotFoundException if cart item not found', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCartItem('user-123', 'nonexistent', { quantity: 2 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if stock insufficient', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue(mockCartItem);
      mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, quantity: 2 });
      mockPrisma.cart.aggregate.mockResolvedValue({ _sum: { quantity: 3 } });

      await expect(service.updateCartItem('user-123', 'cart-1', { quantity: 5 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('removeCartItem', () => {
    it('should delete cart item', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue(mockCartItem);
      mockPrisma.cart.delete.mockResolvedValue(mockCartItem);

      await service.removeCartItem('user-123', 'cart-1');

      expect(mockPrisma.cart.delete).toHaveBeenCalledWith({ where: { id: 'cart-1' } });
    });

    it('should throw NotFoundException if cart item not found', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue(null);

      await expect(service.removeCartItem('user-123', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('clearCart', () => {
    it('should delete all active cart items for user', async () => {
      mockPrisma.cart.deleteMany.mockResolvedValue({ count: 3 });

      await service.clearCart('user-123');

      expect(mockPrisma.cart.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', status: 'ACTIVE' },
      });
    });
  });

  describe('expireTimedOutCarts', () => {
    it('should expire carts past their timer', async () => {
      const expiredCarts = [
        { id: 'cart-1', productId: 'product-1' },
        { id: 'cart-2', productId: 'product-2' },
      ];
      mockPrisma.cart.findMany.mockResolvedValue(expiredCarts);
      mockPrisma.cart.updateMany.mockResolvedValue({ count: 2 });

      await service.expireTimedOutCarts();

      expect(mockPrisma.cart.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'EXPIRED' },
        }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'cart:product:released',
        expect.any(Object),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('cart:expired', expect.any(Object));
    });

    it('should do nothing when no expired carts', async () => {
      mockPrisma.cart.findMany.mockResolvedValue([]);

      await service.expireTimedOutCarts();

      expect(mockPrisma.cart.updateMany).not.toHaveBeenCalled();
    });
  });
});
