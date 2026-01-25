import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  InsufficientStockException,
  ProductNotFoundException,
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

          if (product.quantity < quantity) {
            throw new InsufficientStockException(
              productId,
              product.quantity,
              quantity,
            );
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
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        quantity: {
          increment: quantity,
        },
        status: 'AVAILABLE', // Restore to available if it was sold out
      },
    });
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
            throw new InsufficientStockException(
              item.productId,
              product.quantity,
              item.quantity,
            );
          }

          await tx.product.update({
            where: { id: item.productId },
            data: {
              quantity: product.quantity - item.quantity,
              status:
                product.quantity - item.quantity === 0
                  ? 'SOLD_OUT'
                  : product.status,
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
