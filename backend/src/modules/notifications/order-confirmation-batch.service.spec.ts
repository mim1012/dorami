jest.mock(
  '@bizgo/bizgo-sdk-comm-js',
  () => ({
    Bizgo: class {},
    BizgoOptionsBuilder: class {
      setBaseURL() {
        return this;
      }
      setApiKey() {
        return this;
      }
      build() {
        return {};
      }
    },
    AlimtalkBuilder: class {},
    AlimtalkAttachmentBuilder: class {},
    BrandMessageBuilder: class {},
    BrandMessageAttachmentBuilder: class {},
    DestinationBuilder: class {},
    OMNIRequestBodyBuilder: class {},
    KakaoButtonBuilder: class {},
  }),
  { virtual: true },
);

import { Test, TestingModule } from '@nestjs/testing';
import { OrderConfirmationBatchStatus } from '@prisma/client';
import { OrderConfirmationBatchService } from './order-confirmation-batch.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AlimtalkService } from '../admin/alimtalk.service';

describe('OrderConfirmationBatchService', () => {
  let service: OrderConfirmationBatchService;
  let prisma: any;
  let alimtalkService: { sendGroupedOrderAlimtalk: jest.Mock };

  beforeEach(async () => {
    prisma = {
      liveStream: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      systemConfig: {
        findFirst: jest.fn(),
      },
      order: {
        findMany: jest.fn(),
      },
      orderConfirmationBatch: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      orderConfirmationBatchOrder: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) =>
        callback({
          orderConfirmationBatch: prisma.orderConfirmationBatch,
          orderConfirmationBatchOrder: prisma.orderConfirmationBatchOrder,
        }),
      ),
    };

    alimtalkService = {
      sendGroupedOrderAlimtalk: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderConfirmationBatchService,
        { provide: PrismaService, useValue: prisma },
        { provide: AlimtalkService, useValue: alimtalkService },
      ],
    }).compile();

    service = module.get(OrderConfirmationBatchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('detects grouped flow only when a matching stream is live', async () => {
    prisma.liveStream.findFirst.mockResolvedValue({ id: 'live-1' });

    await expect(service.shouldUseGroupedFlow(['stream-1'])).resolves.toBe(true);
    await expect(service.shouldUseGroupedFlow([])).resolves.toBe(false);
  });

  it('creates one pending batch per user + streamKey on stream end', async () => {
    prisma.liveStream.findUnique.mockResolvedValue({
      id: 'live-1',
      streamKey: 'stream-1',
      startedAt: new Date('2026-04-22T10:00:00.000Z'),
      endedAt: new Date('2026-04-22T11:00:00.000Z'),
    });
    prisma.systemConfig.findFirst.mockResolvedValue({ orderConfirmationDelayHours: 2 });
    prisma.order.findMany.mockResolvedValue([
      { id: 'ORD-1', userId: 'user-1' },
      { id: 'ORD-2', userId: 'user-1' },
      { id: 'ORD-3', userId: 'user-2' },
    ]);
    prisma.orderConfirmationBatch.upsert
      .mockResolvedValueOnce({ id: 'batch-1' })
      .mockResolvedValueOnce({ id: 'batch-2' });

    await service.scheduleBatchesForStreamEnd({ streamId: 'live-1', streamKey: 'stream-1' });

    expect(prisma.orderConfirmationBatch.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.orderConfirmationBatchOrder.upsert).toHaveBeenCalledTimes(3);
    expect(prisma.orderConfirmationBatch.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { userId_streamKey: { userId: 'user-1', streamKey: 'stream-1' } },
      }),
    );
  });

  it('sends due grouped batches once and marks them sent', async () => {
    prisma.orderConfirmationBatch.findMany.mockResolvedValue([
      {
        id: 'batch-1',
        streamKey: 'stream-1',
        orders: [
          {
            order: {
              id: 'ORD-1',
              user: { name: '홍길동', kakaoPhone: '01012345678' },
              orderItems: [
                {
                  productName: '라이브 상품 A',
                  quantity: 1,
                  price: 10000,
                  Product: { streamKey: 'stream-1' },
                },
                {
                  productName: '다른 방송 상품',
                  quantity: 1,
                  price: 5000,
                  Product: { streamKey: 'stream-2' },
                },
              ],
            },
          },
          {
            order: {
              id: 'ORD-2',
              user: { name: '홍길동', kakaoPhone: '01012345678' },
              orderItems: [
                {
                  productName: '라이브 상품 B',
                  quantity: 2,
                  price: 7000,
                  Product: { streamKey: 'stream-1' },
                },
              ],
            },
          },
        ],
      },
    ]);
    prisma.orderConfirmationBatch.updateMany.mockResolvedValue({ count: 1 });
    alimtalkService.sendGroupedOrderAlimtalk.mockResolvedValue({
      results: [{ status: 'sent', channel: 'AT', recipient: '01012345678' }],
      totals: { sent: 1, failed: 0, skipped: 0 },
    });

    await service.processDueBatches();

    expect(alimtalkService.sendGroupedOrderAlimtalk).toHaveBeenCalledWith({
      phone: '01012345678',
      customerName: '홍길동',
      orderIds: ['ORD-1', 'ORD-2'],
      totalAmount: 24000,
      items: [
        { productName: '라이브 상품 A', quantity: 1 },
        { productName: '라이브 상품 B', quantity: 2 },
      ],
    });
    expect(prisma.orderConfirmationBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'batch-1' },
        data: expect.objectContaining({ status: OrderConfirmationBatchStatus.SENT }),
      }),
    );
  });

  it('marks batch failed when grouped send is skipped or rejected', async () => {
    prisma.orderConfirmationBatch.findMany.mockResolvedValue([
      {
        id: 'batch-1',
        streamKey: 'stream-1',
        orders: [
          {
            order: {
              id: 'ORD-1',
              user: { name: '홍길동', kakaoPhone: '01012345678' },
              orderItems: [
                {
                  productName: '라이브 상품 A',
                  quantity: 1,
                  price: 10000,
                  Product: { streamKey: 'stream-1' },
                },
              ],
            },
          },
        ],
      },
    ]);
    prisma.orderConfirmationBatch.updateMany.mockResolvedValue({ count: 1 });
    alimtalkService.sendGroupedOrderAlimtalk.mockResolvedValue({
      results: [
        { status: 'skipped', channel: 'AT', recipient: '01012345678', reason: 'template_disabled' },
      ],
      totals: { sent: 0, failed: 0, skipped: 1 },
    });

    await service.processDueBatches();

    expect(prisma.orderConfirmationBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: OrderConfirmationBatchStatus.FAILED }),
      }),
    );
  });
});
