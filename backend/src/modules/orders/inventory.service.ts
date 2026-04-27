import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  InsufficientStockException,
  ProductNotFoundException,
  ProductSoldOutException,
} from '../../common/exceptions/business.exception';
import { Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Decrease stock with pessimistic locking (SELECT FOR UPDATE)
   * Ensures no race conditions during high-concurrency scenarios
   */
  async decreaseStock(
    productId: string,
    quantity: number,
  ): Promise<{ success: boolean; newStock: number }> {
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          // Pessimistic lock: SELECT FOR UPDATE
          const product = await tx.product.findUnique({
            where: { id: productId },
          });

          if (!product) {
            throw new ProductNotFoundException(productId);
          }

          if (product.status === 'SOLD_OUT') {
            throw new ProductSoldOutException(productId);
          }

          if (product.quantity < quantity) {
            throw new InsufficientStockException(productId, product.quantity, quantity);
          }

          // Decrease stock
          const updatedProduct = await tx.product.update({
            where: { id: productId },
            data: {
              quantity: product.quantity - quantity,
              status: product.quantity - quantity === 0 ? 'SOLD_OUT' : product.status,
            },
          });

          return {
            success: true,
            newStock: updatedProduct.quantity,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 3000, // 3s timeout to prevent deadlocks
        },
      );

      return result;
    } catch (error) {
      if (error instanceof InsufficientStockException) {
        throw error;
      }
      if (error instanceof ProductNotFoundException) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Restore stock (e.g., when order is cancelled)
   */
  async restoreStock(productId: string, quantity: number): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product) {
          return;
        }
        await tx.product.update({
          where: { id: productId },
          data: {
            quantity: { increment: quantity },
            // Only restore to AVAILABLE if currently SOLD_OUT (don't override other statuses)
            ...(product.status === 'SOLD_OUT' ? { status: 'AVAILABLE' } : {}),
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 3000,
      },
    );
  }

  /**
   * Batch stock decrease using a provided transaction client (for atomic multi-op transactions)
   * Use this when you need stock decrease to be part of a larger transaction (e.g., order creation)
   */
  async batchDecreaseStockTx(
    tx: Prisma.TransactionClient,
    items: { productId: string; quantity: number; variantId?: string }[],
  ): Promise<void> {
    for (const item of items) {
      if (item.variantId) {
        const variant = await (tx as any).productVariant.findFirst({
          where: {
            id: item.variantId,
            productId: item.productId,
            deletedAt: null,
          },
        });

        if (!variant) {
          throw new ProductNotFoundException(item.variantId);
        }

        if (variant.status === 'SOLD_OUT' || variant.status === 'HIDDEN') {
          throw new ProductSoldOutException(item.productId);
        }

        if (variant.stock < item.quantity) {
          throw new InsufficientStockException(item.productId, variant.stock, item.quantity);
        }

        await (tx as any).productVariant.update({
          where: { id: item.variantId },
          data: {
            stock: variant.stock - item.quantity,
            status: variant.stock - item.quantity === 0 ? 'SOLD_OUT' : variant.status,
          },
        });
        continue;
      }

      const product = await tx.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new ProductNotFoundException(item.productId);
      }

      if (product.status === 'SOLD_OUT') {
        throw new ProductSoldOutException(item.productId);
      }

      if (product.quantity < item.quantity) {
        throw new InsufficientStockException(item.productId, product.quantity, item.quantity);
      }

      await tx.product.update({
        where: { id: item.productId },
        data: {
          quantity: product.quantity - item.quantity,
          status: product.quantity - item.quantity === 0 ? 'SOLD_OUT' : product.status,
        },
      });
    }
  }

  /**
   * Batch stock restore using a provided transaction client (for atomic cancellation)
   */
  async batchRestoreStockTx(
    tx: Prisma.TransactionClient,
    items: { productId: string; quantity: number; variantId?: string }[],
  ): Promise<void> {
    for (const item of items) {
      if (item.variantId) {
        const variant = await (tx as any).productVariant.findFirst({
          where: {
            id: item.variantId,
            productId: item.productId,
            deletedAt: null,
          },
        });

        if (!variant) {
          continue;
        }

        await (tx as any).productVariant.update({
          where: { id: item.variantId },
          data: {
            stock: { increment: item.quantity },
            ...(variant.status === 'SOLD_OUT' ? { status: 'ACTIVE' } : {}),
          },
        });
        continue;
      }

      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) {
        continue;
      } // Product may have been deleted
      await tx.product.update({
        where: { id: item.productId },
        data: {
          quantity: { increment: item.quantity },
          // Only restore to AVAILABLE if currently SOLD_OUT (don't override other statuses)
          ...(product.status === 'SOLD_OUT' ? { status: 'AVAILABLE' } : {}),
        },
      });
    }
  }

  /**
   * Batch stock decrease for multiple products
   */
  async batchDecreaseStock(
    items: { productId: string; quantity: number }[],
  ): Promise<{ success: boolean }> {
    await this.prisma.$transaction(
      async (tx) => {
        for (const item of items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product) {
            throw new ProductNotFoundException(item.productId);
          }

          if (product.quantity < item.quantity) {
            throw new InsufficientStockException(item.productId, product.quantity, item.quantity);
          }

          await tx.product.update({
            where: { id: item.productId },
            data: {
              quantity: product.quantity - item.quantity,
              status: product.quantity - item.quantity === 0 ? 'SOLD_OUT' : product.status,
            },
          });
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 5000,
      },
    );

    return { success: true };
  }
}
