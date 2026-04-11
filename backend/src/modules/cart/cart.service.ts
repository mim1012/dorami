import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InsufficientStockException } from '../../common/exceptions/business.exception';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { isCaliforniaAddress } from '../../common/utils/address.util';
import {
  AddToCartDto,
  UpdateCartItemDto,
  CartItemResponseDto,
  CartSummaryDto,
  CartStatus,
} from './dto/cart.dto';
import {
  ProductStatus,
  CartStatus as SharedCartStatus,
  ReservationStatus,
} from '@live-commerce/shared-types';
import { Decimal } from '@prisma/client/runtime/library';
import { Cart, Prisma } from '@prisma/client';

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
  product?: { imageUrl: string | null; status: string; streamKey?: string | null } | null;
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
    const [product, existingCartItem] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id: productId },
      }),
      this.prisma.cart.findFirst({
        where: {
          userId,
          productId,
          color: color ?? null,
          size: size ?? null,
          status: SharedCartStatus.ACTIVE,
        },
      }),
    ]);

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    if (product.status !== ProductStatus.AVAILABLE) {
      throw new BadRequestException('Product is not available for purchase');
    }

    // 2. NOTE: Stock check moved INSIDE transaction to prevent TOCTOU race condition
    // (all concurrent requests would pass the early check before any transaction starts)

    // 3. If user already has this product in cart (same color/size), update quantity
    if (existingCartItem) {
      // Update existing cart item quantity with transaction to prevent race condition
      const updatedItem = await this.prisma.$transaction(
        async (tx) => {
          // Re-read product inside transaction to get fresh quantity and status (prevent TOCTOU)
          const freshProduct = await tx.product.findUniqueOrThrow({ where: { id: productId } });
          if (freshProduct.status !== ProductStatus.AVAILABLE) {
            throw new BadRequestException('Product is not available for purchase');
          }
          // Re-check available stock within transaction
          const currentReserved = await this.getReservedQuantityInTransaction(tx, productId);
          const currentAvailableStock = freshProduct.quantity - currentReserved;
          const newQuantity = existingCartItem.quantity + quantity;

          if (currentAvailableStock < newQuantity) {
            throw new BadRequestException(
              `Cannot add ${quantity} more. Available: ${currentAvailableStock - existingCartItem.quantity}`,
            );
          }

          // Also sync timer settings from product in case they changed after item was first added
          const newExpiresAt = freshProduct.timerEnabled
            ? new Date(Date.now() + freshProduct.timerDuration * 60 * 1000)
            : null;

          return await tx.cart.update({
            where: { id: existingCartItem.id },
            data: {
              quantity: newQuantity,
              timerEnabled: freshProduct.timerEnabled,
              expiresAt: newExpiresAt,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      this.logger.log(`Updated cart item ${updatedItem.id} quantity to ${updatedItem.quantity}`);

      return this.mapToResponseDto(updatedItem as CartModel);
    }

    // 4. Create new cart item with timer (wrapped in transaction to prevent race condition)
    const cartItem = await this.prisma.$transaction(
      async (tx) => {
        // Re-read product inside transaction to get fresh quantity and status (prevent TOCTOU)
        const freshProduct = await tx.product.findUniqueOrThrow({ where: { id: productId } });
        if (freshProduct.status !== ProductStatus.AVAILABLE) {
          throw new BadRequestException('Product is not available for purchase');
        }
        // Re-check available stock within transaction to prevent TOCTOU race condition
        const currentReserved = await this.getReservedQuantityInTransaction(tx, productId);
        const currentAvailableStock = freshProduct.quantity - currentReserved;

        if (currentAvailableStock < quantity) {
          throw new InsufficientStockException(productId, currentAvailableStock, quantity);
        }

        const expiresAt = freshProduct.timerEnabled
          ? new Date(Date.now() + freshProduct.timerDuration * 60 * 1000)
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
            timerEnabled: freshProduct.timerEnabled,
            expiresAt,
            status: SharedCartStatus.ACTIVE,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.logger.log(`Added to cart: ${cartItem.id}, expires at: ${cartItem.expiresAt}`);

    // 5. Emit cart added event for WebSocket broadcast (with user info for real-time display)
    // Fetch user name for broadcast
    let userName = '익명';
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { instagramId: true },
      });
      userName = user?.instagramId ?? '익명';
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
        status: SharedCartStatus.ACTIVE,
      },
      include: {
        product: { select: { imageUrl: true, status: true, streamKey: true } },
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
        status: SharedCartStatus.ACTIVE,
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    const updatedItem = await this.prisma.$transaction(
      async (tx) => {
        const product = await tx.product.findUniqueOrThrow({
          where: { id: cartItem.productId },
        });

        // Re-check stock within transaction to prevent TOCTOU race condition
        const reservedQuantity = await this.getReservedQuantityInTransaction(
          tx,
          cartItem.productId,
        );
        const availableStock = product.quantity - reservedQuantity + cartItem.quantity; // Add current quantity back

        if (availableStock < updateDto.quantity) {
          throw new InsufficientStockException(
            cartItem.productId,
            availableStock,
            updateDto.quantity,
          );
        }

        // Refresh timer on quantity change to match addToCart behaviour
        const newExpiresAt = product.timerEnabled
          ? new Date(Date.now() + product.timerDuration * 60 * 1000)
          : null;

        return tx.cart.update({
          where: { id: cartItemId },
          data: {
            quantity: updateDto.quantity,
            timerEnabled: product.timerEnabled,
            expiresAt: newExpiresAt,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

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
        status: SharedCartStatus.ACTIVE,
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
        status: SharedCartStatus.ACTIVE,
      },
    });

    await this.prisma.cart.deleteMany({
      where: {
        userId,
        status: SharedCartStatus.ACTIVE,
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
          status: SharedCartStatus.ACTIVE,
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
          status: SharedCartStatus.EXPIRED,
        },
      });

      this.logger.log(`Expired ${expiredCarts.length} cart items`);

      // Synchronize: Expire linked PROMOTED reservations (timer sync)
      for (const cart of expiredCarts) {
        await this.prisma.reservation.updateMany({
          where: {
            userId: cart.userId,
            productId: cart.productId,
            status: ReservationStatus.PROMOTED,
          },
          data: { status: ReservationStatus.EXPIRED },
        });
      }

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

      // Emit per-user event for alimtalk notification
      const userCartMap = new Map<string, typeof expiredCarts>();
      for (const cart of expiredCarts) {
        if (!cart.userId) {
          continue;
        }
        const existing = userCartMap.get(cart.userId) ?? [];
        userCartMap.set(cart.userId, [...existing, cart]);
      }
      for (const [userId, items] of userCartMap) {
        this.eventEmitter.emit('cart:expired:user', {
          userId,
          productIds: items.map((i) => i.productId),
          itemCount: items.length,
          timestamp: now,
        });
      }
    } catch (error) {
      this.logger.error('Failed to expire timed-out carts', (error as Error).stack);
    }
  }

  /**
   * Cron job: Send cart reminder friendtalk when ~5 minutes remain
   * Runs every minute, targets carts expiring in 4–6 minutes that haven't been notified yet
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async sendCartReminders() {
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() + 4 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 6 * 60 * 1000);

      const remindableCarts = await this.prisma.cart.findMany({
        where: {
          status: SharedCartStatus.ACTIVE,
          timerEnabled: true,
          reminderSent: false,
          expiresAt: {
            gte: windowStart,
            lte: windowEnd,
          },
        },
        include: {
          product: { select: { streamKey: true } },
        },
      });

      if (remindableCarts.length === 0) {
        return;
      }

      // Mark reminder as sent before emitting to prevent double-send on retry
      await this.prisma.cart.updateMany({
        where: { id: { in: remindableCarts.map((c) => c.id) } },
        data: { reminderSent: true },
      });

      const userCartMap = new Map<string, typeof remindableCarts>();
      for (const cart of remindableCarts) {
        if (!cart.userId) {
          continue;
        }
        const existing = userCartMap.get(cart.userId) ?? [];
        userCartMap.set(cart.userId, [...existing, cart]);
      }

      for (const [userId, items] of userCartMap) {
        this.eventEmitter.emit('cart:reminder', {
          userId,
          productIds: items.map((i) => i.productId),
          productNames: items.map((i) => i.productName),
          streamKey: items[0]?.product?.streamKey ?? null,
          minutesLeft: 5,
        });
      }

      this.logger.log(`Cart reminder emitted for ${remindableCarts.length} carts`);
    } catch (error) {
      this.logger.error('Failed to send cart reminders', (error as Error).stack);
    }
  }

  /**
   * Get reserved quantity for a product (sum of all active cart items)
   */
  private async getReservedQuantity(productId: string): Promise<number> {
    const result = await this.prisma.cart.aggregate({
      where: {
        productId,
        status: SharedCartStatus.ACTIVE,
      },
      _sum: {
        quantity: true,
      },
    });

    return result._sum.quantity ?? 0;
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
        status: SharedCartStatus.ACTIVE,
      },
      _sum: {
        quantity: true,
      },
    });

    return result._sum.quantity ?? 0;
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
    const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0);

    // Calculate global shipping fee
    let totalShippingFee = 0;

    // Metadata for frontend dynamic calculation
    let freeShippingMode: string = 'DISABLED';
    let freeShippingThreshold: number | null = null;
    let cumulativePreviousSubtotal = 0;
    let appliedShippingFee = 0;

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

      // Determine base shipping fee for this user (CA vs default)
      let isCA = false;
      if (userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { shippingAddress: true },
        });
        if (user?.shippingAddress) {
          isCA = isCaliforniaAddress(user.shippingAddress);
        }
      }
      appliedShippingFee = isCA ? caShippingFee : defaultShippingFee;

      // Check per-broadcast free shipping mode
      let freeShippingApplied = false;
      const productIds = [...new Set(items.map((item) => item.productId))];
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { streamKey: true },
      });
      const streamKeys = [...new Set(products.map((p) => p.streamKey).filter(Boolean))] as string[];
      if (streamKeys.length > 0) {
        const streams = await this.prisma.liveStream.findMany({
          where: { streamKey: { in: streamKeys } },
          select: { freeShippingMode: true, freeShippingThreshold: true },
        });
        // UNCONDITIONAL: 무조건 무료
        if (streams.some((s) => s.freeShippingMode === 'UNCONDITIONAL')) {
          freeShippingApplied = true;
          freeShippingMode = 'UNCONDITIONAL';
        }
        // THRESHOLD: 기준금액 이상일 때 무료 (누적 합산 기준)
        if (!freeShippingApplied) {
          const thresholdStream = streams.find((s) => s.freeShippingMode === 'THRESHOLD');
          if (thresholdStream) {
            freeShippingMode = 'THRESHOLD';
            const threshold = thresholdStream.freeShippingThreshold
              ? Number(thresholdStream.freeShippingThreshold)
              : 150;
            freeShippingThreshold = threshold;

            // 누적 합산: 같은 유저의 같은 방송 이전 주문 subtotal 합산
            if (userId) {
              const previousOrders = await this.prisma.order.aggregate({
                where: {
                  userId,
                  status: { not: 'CANCELLED' },
                  deletedAt: null,
                  orderItems: {
                    some: {
                      Product: { streamKey: { in: streamKeys } },
                    },
                  },
                },
                _sum: { subtotal: true },
              });
              cumulativePreviousSubtotal = Number(previousOrders._sum.subtotal ?? 0);
            }

            if (subtotal + cumulativePreviousSubtotal >= threshold) {
              freeShippingApplied = true;
            }
          }
        }
      }

      if (freeShippingApplied) {
        totalShippingFee = 0;
      } else {
        totalShippingFee = appliedShippingFee;
      }
    }

    // Find earliest expiration
    const expiringItems = items.filter((item) => item.expiresAt);
    const earliestExpiration =
      expiringItems.length > 0
        ? expiringItems.reduce((earliest, item) => {
            return new Date(item.expiresAt!) < new Date(earliest!) ? item.expiresAt! : earliest!;
          }, expiringItems[0].expiresAt)
        : undefined;

    return {
      items,
      itemCount: items.length,
      subtotal: String(subtotal),
      totalShippingFee: String(totalShippingFee),
      grandTotal: String(subtotal + totalShippingFee),
      earliestExpiration,
      freeShippingMode,
      freeShippingThreshold,
      cumulativePreviousSubtotal: String(cumulativePreviousSubtotal),
      defaultShippingFee: String(appliedShippingFee),
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
    const priceCents = Math.round(price * 100);
    const subtotalCents = priceCents * cartItem.quantity;
    const shippingFeeCents = Math.round(shippingFee * 100);
    const totalCents = subtotalCents + shippingFeeCents;

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
      price: String(price),
      quantity: cartItem.quantity,
      color: cartItem.color ?? undefined,
      size: cartItem.size ?? undefined,
      shippingFee: String(shippingFee),
      timerEnabled: cartItem.timerEnabled,
      expiresAt: cartItem.expiresAt?.toISOString(),
      status: cartItem.status as CartStatus,
      createdAt: cartItem.createdAt.toISOString(),
      updatedAt: cartItem.updatedAt.toISOString(),
      subtotal: (subtotalCents / 100).toFixed(2),
      total: (totalCents / 100).toFixed(2),
      remainingSeconds,
      streamKey: cartItem.product?.streamKey ?? undefined,
      product: cartItem.product
        ? { imageUrl: cartItem.product.imageUrl, status: cartItem.product.status }
        : undefined,
    };
  }
}
