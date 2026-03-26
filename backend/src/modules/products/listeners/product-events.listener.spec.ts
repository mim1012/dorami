import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProductEventsListener } from './product-events.listener';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { SocketIoProvider } from '../../websocket/socket-io.provider';

import { OrderCreatedEvent } from '../../../common/events/order.events';
import { ProductStockUpdatedEvent } from '../../../common/events/product.events';
import { ProductStatus } from '@live-commerce/shared-types';

jest.mock('../../../common/logger/logger.service');

describe('ProductEventsListener', () => {
  let listener: ProductEventsListener;
  let mockPrisma: any;
  let mockEventEmitter: any;
  let mockSocketIo: any;
  let mockIoServer: any;

  const makeProduct = (overrides: Partial<any> = {}) => ({
    id: 'product-1',
    streamKey: 'stream-key-1',
    name: 'Test Product',
    price: { toString: () => '10000' },
    quantity: 10,
    status: ProductStatus.AVAILABLE,
    colorOptions: [],
    sizeOptions: [],
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
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    mockIoServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    mockPrisma = {
      product: {
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    mockSocketIo = {
      server: mockIoServer,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductEventsListener,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: SocketIoProvider, useValue: mockSocketIo },
      ],
    }).compile();

    listener = module.get<ProductEventsListener>(ProductEventsListener);

    jest.clearAllMocks();
    // Re-attach after clearAllMocks
    mockPrisma.$transaction = jest.fn().mockImplementation(async (cb) => cb(mockPrisma));
    mockIoServer.to = jest.fn().mockReturnThis();
    mockIoServer.emit = jest.fn();
  });

  describe('handleOrderCreated', () => {
    it('should call prisma.$transaction for atomic stock decrement', async () => {
      const product = makeProduct({ quantity: 8 });
      mockPrisma.product.update.mockResolvedValue(product);

      const event = new OrderCreatedEvent('order-1', 'user-1', 10000, [
        { productId: 'product-1', quantity: 2, priceAtPurchase: 10000 },
      ]);

      await listener.handleOrderCreated(event);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        data: { quantity: { decrement: 2 } },
      });
    });

    it('should decrement stock for all items in the order', async () => {
      const product1 = makeProduct({ id: 'product-1', quantity: 8 });
      const product2 = makeProduct({ id: 'product-2', quantity: 5, streamKey: 'stream-key-2' });
      mockPrisma.product.update.mockResolvedValueOnce(product1).mockResolvedValueOnce(product2);

      const event = new OrderCreatedEvent('order-1', 'user-1', 20000, [
        { productId: 'product-1', quantity: 2, priceAtPurchase: 10000 },
        { productId: 'product-2', quantity: 3, priceAtPurchase: 10000 },
      ]);

      await listener.handleOrderCreated(event);

      expect(mockPrisma.product.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.product.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'product-1' },
        data: { quantity: { decrement: 2 } },
      });
      expect(mockPrisma.product.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'product-2' },
        data: { quantity: { decrement: 3 } },
      });
    });

    it('should update status to SOLD_OUT when quantity drops to 0 or below', async () => {
      // After decrement, quantity is 0
      const productAfterDecrement = makeProduct({ quantity: 0, status: ProductStatus.AVAILABLE });
      // After status update
      const productSoldOut = makeProduct({ quantity: 0, status: ProductStatus.SOLD_OUT });

      mockPrisma.product.update
        .mockResolvedValueOnce(productAfterDecrement) // decrement call
        .mockResolvedValueOnce(productSoldOut); // status update call

      const event = new OrderCreatedEvent('order-1', 'user-1', 10000, [
        { productId: 'product-1', quantity: 10, priceAtPurchase: 10000 },
      ]);

      await listener.handleOrderCreated(event);

      // Should call update twice: once to decrement, once to set SOLD_OUT
      expect(mockPrisma.product.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.product.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'product-1' },
        data: { status: ProductStatus.SOLD_OUT },
      });
    });

    it('should NOT update status to SOLD_OUT when quantity remains above 0', async () => {
      const productAfterDecrement = makeProduct({ quantity: 5 });
      mockPrisma.product.update.mockResolvedValueOnce(productAfterDecrement);

      const event = new OrderCreatedEvent('order-1', 'user-1', 10000, [
        { productId: 'product-1', quantity: 5, priceAtPurchase: 10000 },
      ]);

      await listener.handleOrderCreated(event);

      // Only the decrement call, no SOLD_OUT update
      expect(mockPrisma.product.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.product.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: ProductStatus.SOLD_OUT } }),
      );
    });

    it('should emit product:stock:updated events AFTER transaction commits', async () => {
      const product = makeProduct({ quantity: 8 });
      mockPrisma.product.update.mockResolvedValue(product);

      const transactionOrder: string[] = [];
      mockPrisma.$transaction = jest.fn().mockImplementation(async (cb) => {
        const result = await cb(mockPrisma);
        transactionOrder.push('transaction');
        return result;
      });
      mockEventEmitter.emit = jest.fn().mockImplementation(() => {
        transactionOrder.push('emit');
      });

      const event = new OrderCreatedEvent('order-1', 'user-1', 10000, [
        { productId: 'product-1', quantity: 2, priceAtPurchase: 10000 },
      ]);

      await listener.handleOrderCreated(event);

      expect(transactionOrder).toEqual(['transaction', 'emit']);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'product:stock:updated',
        expect.any(ProductStockUpdatedEvent),
      );
    });

    it('should emit ProductStockUpdatedEvent with correct old and new quantities', async () => {
      // quantity after decrement = 8, purchased 2, so oldQuantity = 8 + 2 = 10
      const productAfterDecrement = makeProduct({ quantity: 8 });
      mockPrisma.product.update.mockResolvedValue(productAfterDecrement);

      const event = new OrderCreatedEvent('order-1', 'user-1', 10000, [
        { productId: 'product-1', quantity: 2, priceAtPurchase: 10000 },
      ]);

      await listener.handleOrderCreated(event);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'product:stock:updated',
        expect.objectContaining({
          productId: 'product-1',
          oldStock: 10,
          newStock: 8,
          reason: 'purchase',
        }),
      );
    });

    it('should emit one event per order item', async () => {
      const product1 = makeProduct({ id: 'product-1', quantity: 8 });
      const product2 = makeProduct({ id: 'product-2', quantity: 5, streamKey: 'stream-key-2' });
      mockPrisma.product.update.mockResolvedValueOnce(product1).mockResolvedValueOnce(product2);

      const event = new OrderCreatedEvent('order-1', 'user-1', 20000, [
        { productId: 'product-1', quantity: 2, priceAtPurchase: 10000 },
        { productId: 'product-2', quantity: 3, priceAtPurchase: 10000 },
      ]);

      await listener.handleOrderCreated(event);

      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(2);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'product:stock:updated',
        expect.objectContaining({ productId: 'product-1' }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'product:stock:updated',
        expect.objectContaining({ productId: 'product-2' }),
      );
    });

    it('should propagate error and NOT emit events when transaction fails (rollback)', async () => {
      const dbError = new Error('Database connection lost');
      mockPrisma.$transaction = jest.fn().mockRejectedValue(dbError);

      const event = new OrderCreatedEvent('order-1', 'user-1', 10000, [
        { productId: 'product-1', quantity: 2, priceAtPurchase: 10000 },
      ]);

      await expect(listener.handleOrderCreated(event)).rejects.toThrow('Database connection lost');
      // No events should be emitted when the transaction rolls back
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should NOT emit any events when one item update fails mid-transaction', async () => {
      // First item succeeds, second item throws — simulates partial failure inside tx
      mockPrisma.product.update
        .mockResolvedValueOnce(makeProduct({ id: 'product-1', quantity: 8 }))
        .mockRejectedValueOnce(new Error('Constraint violation'));

      // $transaction propagates the inner error
      mockPrisma.$transaction = jest.fn().mockImplementation(async (cb) => cb(mockPrisma));

      const event = new OrderCreatedEvent('order-1', 'user-1', 20000, [
        { productId: 'product-1', quantity: 2, priceAtPurchase: 10000 },
        { productId: 'product-2', quantity: 3, priceAtPurchase: 10000 },
      ]);

      await expect(listener.handleOrderCreated(event)).rejects.toThrow('Constraint violation');
      // stockUpdates array never gets populated fully, so no events emitted
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
