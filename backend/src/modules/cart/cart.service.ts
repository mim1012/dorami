import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
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
import { Cart } from '@prisma/client';

// Type for Prisma transaction client
type PrismaTransactionClient = Omit<
  PrismaService,
  | '$connect'
  | '$disconnect'
  | '$on'
  | '$transaction'
  | '$use'
  | '$extends'
  | 'onModuleInit'
  | 'onModuleDestroy'
  | 'isHealthy'
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

        // Also sync timer settings from product in case they changed after item was first added
        const newExpiresAt = product.timerEnabled
          ? new Date(Date.now() + product.timerDuration * 60 * 1000)
          : null;

        return await tx.cart.update({
          where: { id: existingCartItem.id },
          data: {
            quantity: newQuantity,
            timerEnabled: product.timerEnabled,
            expiresAt: newExpiresAt,
          },
        });
      });

      this.logger.log(`Updated cart item ${updatedItem.id} quantity to ${updatedItem.quantity}`);

      return this.mapToResponseDto(updatedItem as CartModel);
    }

    // 4. Create new cart item with timer (wrapped in transaction to prevent race condition)
    const cartItem = await this.prisma.$transaction(async (tx) => {
      // Re-check available stock within transaction to prevent TOCTOU race condition
      const currentReserved = await this.getReservedQuantityInTransaction(tx, productId);
      const currentAvailableStock = product.quantity - currentReserved;

      if (currentAvailableStock < quantity) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${currentAvailableStock}, Requested: ${quantity}`,
        );
      }

      const expiresAt = product.timerEnabled
        ? new Date(Date.now() + product.timerDuration * 60 * 1000)
        : null;

      return await tx.cart.create({
        data: {
          userId,
          productId,
          productName: product.name,
          price: product.price,
          quantity,
          color,
          size,
          shippingFee: new Decimal(0),
          timerEnabled: product.timerEnabled,
          expiresAt,
          status: 'ACTIVE',
        },
      });
    });

    this.logger.log(`Added to cart: ${cartItem.id}, expires at: ${cartItem.expiresAt}`);

    // 5. Emit cart added event for WebSocket broadcast (with user info for real-time display)
    // Fetch user name for broadcast
    let userName = '익명';
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { instagramId: true },
      });
      userName = user?.instagramId || '익명';
    } catch {
      // Fallback to anonymous
    }

    // Generate consistent color from userId hash
    const userColor = this.generateUserColor(userId);

    this.eventEmitter.emit('cart:added', {
      userId,
      userName,
      userColor,
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

    return this.calculateCartSummary(items, userId);
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

    const productId = cartItem.productId;

    await this.prisma.cart.delete({
      where: { id: cartItemId },
    });

    this.logger.log(`Removed cart item ${cartItemId}`);

    // Emit event to trigger reservation promotion
    this.eventEmitter.emit('cart:product:released', {
      productId,
      timestamp: new Date(),
    });
  }

  /**
   * Clear all items from cart
   */
  async clearCart(userId: string): Promise<void> {
    // Get cart items before deletion to emit events
    const cartItems = await this.prisma.cart.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
    });

    await this.prisma.cart.deleteMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
    });

    this.logger.log(`Cleared cart for user ${userId}`);

    // Emit event for each product to trigger reservation promotion
    const productIds = [...new Set(cartItems.map((item) => item.productId))];
    for (const productId of productIds) {
      this.eventEmitter.emit('cart:product:released', {
        productId,
        timestamp: new Date(),
      });
    }
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
   * Calculate cart summary with global shipping fee
   * Shipping is per-order based on SystemConfig settings:
   * - If broadcast freeShippingEnabled AND subtotal >= freeShippingThreshold: $0
   * - Else if shipping state === 'CA': caShippingFee
   * - Else: defaultShippingFee
   */
  private async calculateCartSummary(
    items: CartItemResponseDto[],
    userId?: string,
  ): Promise<CartSummaryDto> {
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

    // Calculate global shipping fee
    let totalShippingFee = 0;

    if (items.length > 0) {
      // Fetch system config for shipping settings
      const config = await this.prisma.systemConfig.findFirst();
      const defaultShippingFee =
        config?.defaultShippingFee !== null && config?.defaultShippingFee !== undefined
          ? Number(config.defaultShippingFee)
          : 10;
      const caShippingFee =
        config?.caShippingFee !== null && config?.caShippingFee !== undefined
          ? Number(config.caShippingFee)
          : 8;
      const freeShippingThreshold =
        config?.freeShippingThreshold !== null && config?.freeShippingThreshold !== undefined
          ? Number(config.freeShippingThreshold)
          : 150;

      // Check if any product's live stream has freeShippingEnabled
      let freeShippingEnabled = false;
      if (items.length > 0) {
        const productIds = [...new Set(items.map((item) => item.productId))];
        const products = await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { streamKey: true },
        });
        const streamKeys = [
          ...new Set(products.map((p) => p.streamKey).filter(Boolean)),
        ] as string[];
        if (streamKeys.length > 0) {
          const streams = await this.prisma.liveStream.findMany({
            where: { streamKey: { in: streamKeys } },
            select: { freeShippingEnabled: true },
          });
          freeShippingEnabled = streams.some((s) => s.freeShippingEnabled);
        }
      }

      // Check if free shipping conditions are met
      if (freeShippingEnabled && subtotal >= freeShippingThreshold) {
        totalShippingFee = 0;
      } else {
        // Determine shipping fee based on user's shipping state
        let isCA = false;
        if (userId) {
          const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { shippingAddress: true },
          });
          if (user?.shippingAddress) {
            const address = user.shippingAddress as Record<string, any>;
            isCA = address.state === 'CA';
          }
        }
        totalShippingFee = isCA ? caShippingFee : defaultShippingFee;
      }
    }

    // Find earliest expiration
    const expiringItems = items.filter((item) => item.expiresAt);
    const earliestExpiration =
      expiringItems.length > 0
        ? expiringItems.reduce((earliest, item) => {
            return new Date(item.expiresAt) < new Date(earliest) ? item.expiresAt : earliest;
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
   * Generate a consistent color from userId hash
   * Returns a bright, readable hex color
   */
  private generateUserColor(userId: string): string {
    const COLORS = [
      '#FF007A',
      '#FF6B35',
      '#7928CA',
      '#0070F3',
      '#00C853',
      '#FF3D00',
      '#AA00FF',
      '#00BFA5',
      '#FFD600',
      '#FF1744',
      '#651FFF',
      '#00B8D4',
      '#F50057',
      '#D500F9',
      '#00E5FF',
      '#76FF03',
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return COLORS[Math.abs(hash) % COLORS.length];
  }

  /**
   * Map Prisma model to Response DTO
   */
  private mapToResponseDto(cartItem: CartModel): CartItemResponseDto {
    const price =
      cartItem.price !== null && cartItem.price !== undefined ? Number(cartItem.price) : 0;
    const shippingFee =
      cartItem.shippingFee !== null && cartItem.shippingFee !== undefined
        ? Number(cartItem.shippingFee)
        : 0;
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
