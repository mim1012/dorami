import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  OrderConfirmationBatchStatus,
  Prisma,
  type OrderConfirmationBatch,
  type OrderConfirmationBatchOrder,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AlimtalkService } from '../admin/alimtalk.service';

interface LinkedOrderForBatch extends OrderConfirmationBatchOrder {
  order: {
    id: string;
    user: { name: string | null; kakaoPhone: string | null } | null;
    orderItems: Array<{
      productName: string;
      quantity: number;
      price: Prisma.Decimal;
      Product: { streamKey: string | null } | null;
    }>;
  };
}

interface BatchWithOrders extends OrderConfirmationBatch {
  orders: LinkedOrderForBatch[];
}

@Injectable()
export class OrderConfirmationBatchService {
  private readonly logger = new Logger(OrderConfirmationBatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alimtalkService: AlimtalkService,
  ) {}

  async shouldUseGroupedFlow(streamKeys: string[] | undefined): Promise<boolean> {
    const normalizedStreamKeys = [
      ...new Set((streamKeys ?? []).map((value) => value?.trim()).filter(Boolean)),
    ];

    if (normalizedStreamKeys.length === 0) {
      return false;
    }

    const activeStream = await this.prisma.liveStream.findFirst({
      where: {
        streamKey: { in: normalizedStreamKeys },
        status: 'LIVE',
      },
      select: { id: true },
    });

    return Boolean(activeStream);
  }

  async hasPendingOrSentBatchForOrder(orderId: string): Promise<boolean> {
    const linkedBatch = await this.prisma.orderConfirmationBatchOrder.findFirst({
      where: {
        orderId,
        batch: {
          status: {
            in: [
              OrderConfirmationBatchStatus.PENDING,
              OrderConfirmationBatchStatus.PROCESSING,
              OrderConfirmationBatchStatus.SENT,
            ],
          },
        },
      },
      select: { id: true },
    });

    return Boolean(linkedBatch);
  }

  async scheduleBatchesForStreamEnd(payload: { streamId: string; streamKey?: string }) {
    const stream = await this.prisma.liveStream.findUnique({
      where: { id: payload.streamId },
      select: { id: true, streamKey: true, startedAt: true, endedAt: true },
    });

    if (!stream?.startedAt) {
      this.logger.warn(
        `Stream ${payload.streamId} missing startedAt, skipping order confirmation batch setup`,
      );
      return;
    }

    const streamKey = payload.streamKey?.trim() || stream.streamKey;
    const streamEnd = stream.endedAt ?? new Date();
    const scheduledAt = await this.buildScheduledAt(streamEnd);

    const orders = await this.prisma.order.findMany({
      where: {
        deletedAt: null,
        status: 'PENDING_PAYMENT',
        createdAt: {
          gte: stream.startedAt,
          lte: streamEnd,
        },
        orderItems: {
          some: {
            Product: {
              streamKey,
            },
          },
        },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (orders.length === 0) {
      this.logger.log(`No live-related orders found for stream ${streamKey} after end event`);
      return;
    }

    const ordersByUserId = new Map<string, string[]>();
    for (const order of orders) {
      const existing = ordersByUserId.get(order.userId) ?? [];
      existing.push(order.id);
      ordersByUserId.set(order.userId, existing);
    }

    for (const [userId, orderIds] of ordersByUserId.entries()) {
      await this.prisma.$transaction(async (tx) => {
        const batch = await tx.orderConfirmationBatch.upsert({
          where: {
            userId_streamKey: {
              userId,
              streamKey,
            },
          },
          update: {
            streamId: stream.id,
            scheduledAt,
            lastError: null,
            status: OrderConfirmationBatchStatus.PENDING,
            sentAt: null,
          },
          create: {
            userId,
            streamKey,
            streamId: stream.id,
            scheduledAt,
            status: OrderConfirmationBatchStatus.PENDING,
          },
        });

        for (const orderId of orderIds) {
          await tx.orderConfirmationBatchOrder.upsert({
            where: {
              batchId_orderId: {
                batchId: batch.id,
                orderId,
              },
            },
            update: {},
            create: {
              batchId: batch.id,
              orderId,
            },
          });
        }
      });
    }

    this.logger.log(
      `Prepared ${ordersByUserId.size} grouped order confirmation batch(es) for stream ${streamKey}`,
    );
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processDueBatches() {
    const dueBatches = await this.prisma.orderConfirmationBatch.findMany({
      where: {
        status: OrderConfirmationBatchStatus.PENDING,
        scheduledAt: { lte: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 50,
      include: {
        orders: {
          include: {
            order: {
              select: {
                id: true,
                user: { select: { name: true, kakaoPhone: true } },
                orderItems: {
                  select: {
                    productName: true,
                    quantity: true,
                    price: true,
                    Product: { select: { streamKey: true } },
                  },
                  orderBy: { productName: 'asc' },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    for (const batch of dueBatches) {
      await this.processBatch(batch as BatchWithOrders);
    }
  }

  private async processBatch(batch: BatchWithOrders) {
    const claimed = await this.prisma.orderConfirmationBatch.updateMany({
      where: {
        id: batch.id,
        status: OrderConfirmationBatchStatus.PENDING,
      },
      data: {
        status: OrderConfirmationBatchStatus.PROCESSING,
      },
    });

    if (claimed.count === 0) {
      return;
    }

    const recipient = batch.orders[0]?.order.user;
    const phone = recipient?.kakaoPhone?.trim();

    if (!phone) {
      await this.failBatch(batch.id, 'recipient_phone_missing');
      return;
    }

    const relevantOrderDetails = batch.orders
      .map((link) => ({
        orderId: link.order.id,
        items: link.order.orderItems.filter((item) => item.Product?.streamKey === batch.streamKey),
      }))
      .filter((entry) => entry.items.length > 0);

    if (relevantOrderDetails.length === 0) {
      await this.failBatch(batch.id, 'batch_items_missing');
      return;
    }

    const totalAmount = relevantOrderDetails.reduce(
      (sum, order) =>
        sum +
        order.items.reduce((orderSum, item) => orderSum + Number(item.price) * item.quantity, 0),
      0,
    );

    const items = relevantOrderDetails.flatMap((order) => order.items);

    const result = await this.alimtalkService.sendGroupedOrderAlimtalk({
      phone,
      customerName: recipient?.name ?? '고객',
      orderIds: relevantOrderDetails.map((entry) => entry.orderId),
      totalAmount,
      items: items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
      })),
    });

    const failedResult = result.results.find((entry) => entry.status !== 'sent');

    if (failedResult) {
      await this.failBatch(
        batch.id,
        failedResult.reason ?? failedResult.providerMessage ?? 'send_failed',
      );
      return;
    }

    await this.prisma.orderConfirmationBatch.update({
      where: { id: batch.id },
      data: {
        status: OrderConfirmationBatchStatus.SENT,
        sentAt: new Date(),
        lastError: null,
      },
    });
  }

  private async buildScheduledAt(streamEnd: Date) {
    const config = await this.prisma.systemConfig.findFirst({
      where: { id: 'system' },
      select: { orderConfirmationDelayHours: true },
    });

    const delayHours = Math.max(0, config?.orderConfirmationDelayHours ?? 0);
    return new Date(streamEnd.getTime() + delayHours * 60 * 60 * 1000);
  }

  private async failBatch(batchId: string, reason: string) {
    await this.prisma.orderConfirmationBatch.update({
      where: { id: batchId },
      data: {
        status: OrderConfirmationBatchStatus.FAILED,
        lastError: reason,
      },
    });
  }
}
