import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  AddToCartDto,
  UpdateCartItemDto,
  CartItemResponseDto,
  CartSummaryDto,
  CartStatus,
} from './dto/cart.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, Cart } from '@prisma/client';

// Type for Prisma transaction client
type PrismaTransactionClient = Omit<
  PrismaService,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends' | 'onModuleInit' | 'onModuleDestroy' | 'isHealthy'
>;

// Type for Cart model from Prisma
interface CartModel extends Cart {
  price: Decimal;
  shippingFee: Decimal;
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Epic 6: Add product to cart with timer
   * Optimized: Single query to fetch product, reserved quantity, and existing cart item
   */
  async addToCart(userId: string, addToCartDto: AddToCartDto): Promise<CartItemResponseDto> {
    const { productId, quantity, color, size } = addToCartDto;

    // 1. Fetch all required data in parallel (N+1 optimization)
    const [product, reservedResult, existingCartItem] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id: productId },
      }),
      this.prisma.cart.aggregate({
        where: {
          productId,
          status: 'ACTIVE',
        },
        _sum: {
          quantity: true,
        },
      }),
      this.prisma.cart.findFirst({
        where: {
          userId,
          productId,
          color: color || null,
          size: size || null,
          status: 'ACTIVE',
        },
      }),
    ]);

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    if (product.status !== 'AVAILABLE') {
      throw new BadRequestException('Product is not available for purchase');
    }

    // 2. Check stock availability
    const reservedQuantity = reservedResult._sum.quantity || 0;
    const availableStock = product.quantity - reservedQuantity;

    if (availableStock < quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${availableStock}, Requested: ${quantity}`,
      );
    }

    // 3. If user already has this product in cart (same color/size), update quantity
    if (existingCartItem) {
      // Update existing cart item quantity with transaction to prevent race condition
      const updatedItem = await this.prisma.$transaction(async (tx) => {
        // Re-check available stock within transaction
        const currentReserved = await this.getReservedQuantityInTransaction(tx, productId);
        const currentAvailableStock = product.quantity - currentReserved;
        const newQuantity = existingCartItem.quantity + quantity;

        if (currentAvailableStock < newQuantity) {
          throw new BadRequestException(
            `Cannot add ${quantity} more. Available: ${currentAvailableStock - existingCartItem.quantity}`,
          );
        }

        return await tx.cart.update({
          where: { id: existingCartItem.id },
          data: { quantity: newQuantity },
        });
      });

      this.logger.log(`Updated cart item ${updatedItem.id} quantity to ${updatedItem.quantity}`);

      return this.mapToResponseDto(updatedItem as CartModel);
    }

    // 4. Create new cart item with timer
    const expiresAt = product.timerEnabled
      ? new Date(Date.now() + product.timerDuration * 60 * 1000)
      : null;

    const cartItem = await this.prisma.cart.create({
      data: {
        userId,
        productId,
        productName: product.name,
        price: product.price,
        quantity,
        color,
        size,
        shippingFee: product.shippingFee,
        timerEnabled: product.timerEnabled,
        expiresAt,
        status: 'ACTIVE',
      },
    });

    this.logger.log(`Added to cart: ${cartItem.id}, expires at: ${expiresAt}`);

    // 5. Emit cart added event for WebSocket broadcast
    this.eventEmitter.emit('cart:added', {
      userId,
      cartItemId: cartItem.id,
      productId,
      productName: product.name,
      quantity,
      streamKey: product.streamKey,
    });

    return this.mapToResponseDto(cartItem as CartModel);
  }

  /**
   * Get user's active cart
   */
  async getCart(userId: string): Promise<CartSummaryDto> {
    const cartItems = await this.prisma.cart.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const items = cartItems.map((item) => this.mapToResponseDto(item as CartModel));

    return this.calculateCartSummary(items);
  }

  /**
   * Update cart item quantity
   */
  async updateCartItem(
    userId: string,
    cartItemId: string,
    updateDto: UpdateCartItemDto,
  ): Promise<CartItemResponseDto> {
    const cartItem = await this.prisma.cart.findFirst({
      where: {
        id: cartItemId,
        userId,
        status: 'ACTIVE',
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    // Check stock availability
    const product = await this.prisma.product.findUnique({
      where: { id: cartItem.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const reservedQuantity = await this.getReservedQuantity(cartItem.productId);
    const availableStock = product.quantity - reservedQuantity + cartItem.quantity; // Add current quantity back

    if (availableStock < updateDto.quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${availableStock}, Requested: ${updateDto.quantity}`,
      );
    }

    const updatedItem = await this.prisma.cart.update({
      where: { id: cartItemId },
      data: { quantity: updateDto.quantity },
    });

    this.logger.log(`Updated cart item ${cartItemId} quantity to ${updateDto.quantity}`);

    return this.mapToResponseDto(updatedItem as CartModel);
  }

  /**
   * Remove item from cart
   */
  async removeCartItem(userId: string, cartItemId: string): Promise<void> {
    const cartItem = await this.prisma.cart.findFirst({
      where: {
        id: cartItemId,
        userId,
        status: 'ACTIVE',
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.cart.delete({
      where: { id: cartItemId },
    });

    this.logger.log(`Removed cart item ${cartItemId}`);
  }

  /**
   * Clear all items from cart
   */
  async clearCart(userId: string): Promise<void> {
    await this.prisma.cart.deleteMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
    });

    this.logger.log(`Cleared cart for user ${userId}`);
  }

  /**
   * Cron job: Expire carts that have passed their timer
   * Runs every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireTimedOutCarts() {
    try {
      const now = new Date();

      // Find expired carts first to get product IDs
      const expiredCarts = await this.prisma.cart.findMany({
        where: {
          status: 'ACTIVE',
          timerEnabled: true,
          expiresAt: {
            lte: now,
          },
        },
      });

      if (expiredCarts.length === 0) {
        return;
      }

      // Update status to expired
      await this.prisma.cart.updateMany({
        where: {
          id: {
            in: expiredCarts.map((c) => c.id),
          },
        },
        data: {
          status: 'EXPIRED',
        },
      });

      this.logger.log(`Expired ${expiredCarts.length} cart items`);

      // Emit event for each product to trigger reservation promotion
      const productIds = [...new Set(expiredCarts.map((c) => c.productId))];
      for (const productId of productIds) {
        this.eventEmitter.emit('cart:product:released', {
          productId,
          timestamp: now,
        });
      }

      // Emit general event for WebSocket notification
      this.eventEmitter.emit('cart:expired', {
        count: expiredCarts.length,
        timestamp: now,
      });
    } catch (error) {
      this.logger.error('Failed to expire timed-out carts', error.stack);
    }
  }

  /**
   * Get reserved quantity for a product (sum of all active cart items)
   */
  private async getReservedQuantity(productId: string): Promise<number> {
    const result = await this.prisma.cart.aggregate({
      where: {
        productId,
        status: 'ACTIVE',
      },
      _sum: {
        quantity: true,
      },
    });

    return result._sum.quantity || 0;
  }

  /**
   * Get reserved quantity within transaction (for race condition prevention)
   */
  private async getReservedQuantityInTransaction(
    tx: PrismaTransactionClient,
    productId: string,
  ): Promise<number> {
    const result = await tx.cart.aggregate({
      where: {
        productId,
        status: 'ACTIVE',
      },
      _sum: {
        quantity: true,
      },
    });

    return result._sum.quantity || 0;
  }

  /**
   * Calculate cart summary
   */
  private calculateCartSummary(items: CartItemResponseDto[]): CartSummaryDto {
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const totalShippingFee = items.reduce((sum, item) => sum + item.shippingFee, 0);

    // Find earliest expiration
    const expiringItems = items.filter(item => item.expiresAt);
    const earliestExpiration = expiringItems.length > 0
      ? expiringItems.reduce((earliest, item) => {
          return new Date(item.expiresAt) < new Date(earliest)
            ? item.expiresAt
            : earliest;
        }, expiringItems[0].expiresAt)
      : undefined;

    return {
      items,
      itemCount: items.length,
      subtotal,
      totalShippingFee,
      grandTotal: subtotal + totalShippingFee,
      earliestExpiration,
    };
  }

  /**
   * Map Prisma model to Response DTO
   */
  private mapToResponseDto(cartItem: CartModel): CartItemResponseDto {
    const price = parseFloat(cartItem.price.toString());
    const shippingFee = parseFloat(cartItem.shippingFee.toString());
    const subtotal = price * cartItem.quantity;
    const total = subtotal + shippingFee;

    let remainingSeconds: number | undefined;
    if (cartItem.expiresAt) {
      const now = new Date();
      const expiresAt = new Date(cartItem.expiresAt);
      remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
    }

    return {
      id: cartItem.id,
      userId: cartItem.userId,
      productId: cartItem.productId,
      productName: cartItem.productName,
      price,
      quantity: cartItem.quantity,
      color: cartItem.color,
      size: cartItem.size,
      shippingFee,
      timerEnabled: cartItem.timerEnabled,
      expiresAt: cartItem.expiresAt?.toISOString(),
      status: cartItem.status as CartStatus,
      createdAt: cartItem.createdAt.toISOString(),
      updatedAt: cartItem.updatedAt.toISOString(),
      subtotal,
      total,
      remainingSeconds,
    };
  }
}
