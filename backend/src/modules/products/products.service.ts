import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateProductDto,
  UpdateProductDto,
  UpdateStockDto,
  ProductResponseDto,
  ProductStatus,
  ReorderProductsDto,
  BulkUpdateStatusDto,
} from './dto/product.dto';
import {
  ProductNotFoundException,
  InsufficientStockException,
} from '../../common/exceptions/business.exception';
import { LogErrors } from '../../common/decorators/log-errors.decorator';
import { findOrThrow } from '../../common/prisma/find-or-throw.util';
import { Decimal } from '@prisma/client/runtime/library';
import { Product, ProductStatus as PrismaProductStatus } from '@prisma/client';

// Type for product update data
interface ProductUpdateData {
  name?: string;
  price?: Decimal;
  quantity?: number;
  colorOptions?: string[];
  sizeOptions?: string[];
  timerEnabled?: boolean;
  timerDuration?: number;
  imageUrl?: string | null;
  images?: string[];
  status?: PrismaProductStatus;
  isNew?: boolean;
  discountRate?: Decimal | null;
  originalPrice?: Decimal | null;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new product
   * Epic 5 Story 5.1
   */
  @LogErrors('create product')
  async create(createDto: CreateProductDto): Promise<ProductResponseDto> {
    // Trim streamKey to prevent whitespace-induced mismatches
    const streamKey = createDto.streamKey?.trim() || undefined;

    // Verify stream exists (only if streamKey provided)
    if (streamKey) {
      this.logger.log(`Verifying LiveStream for key: "${streamKey}"`);
      const stream = await this.prisma.liveStream.findUnique({
        where: { streamKey },
      });

      if (!stream) {
        this.logger.error(`LiveStream not found for key: "${streamKey}"`);
        throw new NotFoundException(`LiveStream with key ${streamKey} not found`);
      }
      this.logger.log(`LiveStream found: id=${stream.id}, status=${stream.status}`);
    }

    const product = await this.prisma.product.create({
      data: {
        streamKey: streamKey ?? null,
        name: createDto.name,
        price: new Decimal(createDto.price),
        quantity: createDto.stock,
        colorOptions: createDto.colorOptions || [],
        sizeOptions: createDto.sizeOptions || [],
        shippingFee: new Decimal(0),
        freeShippingMessage: null,
        timerEnabled: createDto.timerEnabled || false,
        timerDuration: createDto.timerDuration || 10,
        imageUrl: createDto.imageUrl,
        images: createDto.images || [],
        isNew: createDto.isNew || false,
        discountRate:
          createDto.discountRate !== null && createDto.discountRate !== undefined
            ? new Decimal(createDto.discountRate)
            : null,
        originalPrice:
          createDto.originalPrice !== null && createDto.originalPrice !== undefined
            ? new Decimal(createDto.originalPrice)
            : null,
      },
    });

    this.logger.log(`Product created: ${product.id} for stream ${product.streamKey}`);

    // Emit event for WebSocket broadcast
    this.eventEmitter.emit('product:created', {
      productId: product.id,
      streamKey: product.streamKey,
      product: this.mapToResponseDto(product),
    });

    return this.mapToResponseDto(product);
  }

  /**
   * Get all products for a stream
   * Epic 5 Story 5.2, 5.3
   */
  @LogErrors('get products by stream key')
  async findByStreamKey(streamKey: string, status?: ProductStatus): Promise<ProductResponseDto[]> {
    const products = await this.prisma.product.findMany({
      where: {
        streamKey,
        ...(status && { status }),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return products.map((product) => this.mapToResponseDto(product));
  }

  /**
   * Get featured products for homepage
   * Returns latest available products with limit
   */
  @LogErrors('get featured products')
  async getFeaturedProducts(limit = 6): Promise<ProductResponseDto[]> {
    const products = await this.prisma.product.findMany({
      where: {
        status: 'AVAILABLE',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return products.map((p) => this.mapToResponseDto(p));
  }

  /**
   * Get all products (legacy method)
   */
  @LogErrors('get all products')
  async findAll(status?: ProductStatus): Promise<ProductResponseDto[]> {
    const products = await this.prisma.product.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return products.map((p) => this.mapToResponseDto(p));
  }

  /**
   * Get a single product by ID
   * Epic 5 Story 5.4
   */
  @LogErrors('get product by id')
  async findById(id: string): Promise<ProductResponseDto> {
    const product = await findOrThrow(
      this.prisma.product.findUnique({ where: { id } }),
      'Product',
      id,
    );
    return this.mapToResponseDto(product);
  }

  /**
   * Update a product
   * Epic 5 Story 5.1
   */
  @LogErrors('update product')
  async update(id: string, updateDto: UpdateProductDto): Promise<ProductResponseDto> {
    // Check if product exists
    await findOrThrow(this.prisma.product.findUnique({ where: { id } }), 'Product', id);

    // Check if trying to reduce quantity below items in carts
    if (updateDto.stock !== undefined && updateDto.stock < 0) {
      throw new BadRequestException('Stock cannot be negative');
    }

    const updateData: ProductUpdateData = {};

    if (updateDto.name !== undefined) {
      updateData.name = updateDto.name;
    }
    if (updateDto.price !== undefined) {
      updateData.price = new Decimal(updateDto.price);
    }
    if (updateDto.stock !== undefined) {
      updateData.quantity = updateDto.stock;
    }
    if (updateDto.colorOptions !== undefined) {
      updateData.colorOptions = updateDto.colorOptions;
    }
    if (updateDto.sizeOptions !== undefined) {
      updateData.sizeOptions = updateDto.sizeOptions;
    }
    // shippingFee and freeShippingMessage are deprecated (global shipping now)
    if (updateDto.timerEnabled !== undefined) {
      updateData.timerEnabled = updateDto.timerEnabled;
    }
    if (updateDto.timerDuration !== undefined) {
      updateData.timerDuration = updateDto.timerDuration;
    }
    if (updateDto.imageUrl !== undefined) {
      updateData.imageUrl = updateDto.imageUrl;
    }
    if (updateDto.images !== undefined) {
      updateData.images = updateDto.images;
    }
    if (updateDto.status !== undefined) {
      updateData.status = updateDto.status as PrismaProductStatus;
    }
    if (updateDto.isNew !== undefined) {
      updateData.isNew = updateDto.isNew;
    }
    if (updateDto.discountRate !== undefined) {
      updateData.discountRate =
        updateDto.discountRate !== null && updateDto.discountRate !== undefined
          ? new Decimal(updateDto.discountRate)
          : null;
    }
    if (updateDto.originalPrice !== undefined) {
      updateData.originalPrice =
        updateDto.originalPrice !== null && updateDto.originalPrice !== undefined
          ? new Decimal(updateDto.originalPrice)
          : null;
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Product updated: ${product.id}`);

    // Emit event for WebSocket broadcast
    this.eventEmitter.emit('product:updated', {
      productId: product.id,
      streamKey: product.streamKey,
      product: this.mapToResponseDto(product),
    });

    return this.mapToResponseDto(product);
  }

  /**
   * Mark product as sold out
   * Epic 5 Story 5.1
   */
  @LogErrors('mark product as sold out')
  async markAsSoldOut(id: string): Promise<ProductResponseDto> {
    await findOrThrow(this.prisma.product.findUnique({ where: { id } }), 'Product', id);

    const product = await this.prisma.product.update({
      where: { id },
      data: { status: 'SOLD_OUT' },
    });

    this.logger.log(`Product marked as sold out: ${product.id}`);

    // Emit event for WebSocket broadcast
    this.eventEmitter.emit('product:soldout', {
      productId: product.id,
      streamKey: product.streamKey,
    });

    return this.mapToResponseDto(product);
  }

  /**
   * Delete a product
   */
  @LogErrors('delete product')
  async delete(id: string): Promise<void> {
    const product = await findOrThrow(
      this.prisma.product.findUnique({ where: { id } }),
      'Product',
      id,
    );

    // Clear active carts for this product before deleting
    const expiredCarts = await this.prisma.cart.updateMany({
      where: {
        productId: id,
        status: 'ACTIVE',
      },
      data: {
        status: 'EXPIRED',
      },
    });

    if (expiredCarts.count > 0) {
      this.logger.log(
        `Expired ${expiredCarts.count} active cart(s) for product ${id} before deletion`,
      );
    }

    await this.prisma.product.delete({
      where: { id },
    });

    this.logger.log(`Product deleted: ${id}`);

    // Emit deletion event
    this.eventEmitter.emit('product:deleted', {
      productId: id,
      streamKey: product.streamKey,
    });
  }

  /**
   * Bulk delete products
   */
  @LogErrors('bulk delete products')
  async bulkDelete(ids: string[]): Promise<{ deleted: number; failed: string[] }> {
    const failed: string[] = [];
    let deleted = 0;

    for (const id of ids) {
      try {
        await this.delete(id);
        deleted++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to delete product ${id}: ${message}`);
        failed.push(id);
      }
    }

    return { deleted, failed };
  }

  /**
   * Update stock (increase/decrease)
   * Used by cart and order modules
   */
  @LogErrors('update stock')
  async updateStock(id: string, updateStockDto: UpdateStockDto): Promise<ProductResponseDto> {
    const product = await findOrThrow(
      this.prisma.product.findUnique({ where: { id } }),
      'Product',
      id,
    );

    const newStock = product.quantity + updateStockDto.quantity;

    if (newStock < 0) {
      throw new InsufficientStockException(id, product.quantity, Math.abs(updateStockDto.quantity));
    }

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: {
        quantity: newStock,
        status: newStock === 0 ? 'SOLD_OUT' : product.status,
      },
    });

    this.logger.log(`Stock updated for product ${id}: ${product.quantity} → ${newStock}`);

    // Emit stock update event
    this.eventEmitter.emit('product:stock:updated', {
      productId: updatedProduct.id,
      streamKey: updatedProduct.streamKey,
      oldStock: product.quantity,
      newStock: updatedProduct.quantity,
      product: this.mapToResponseDto(updatedProduct),
    });

    return this.mapToResponseDto(updatedProduct);
  }

  /**
   * Duplicate an existing product
   */
  @LogErrors('duplicate product')
  async duplicate(id: string): Promise<ProductResponseDto> {
    const source = await findOrThrow(
      this.prisma.product.findUnique({ where: { id } }),
      'Product',
      id,
    );

    const product = await this.prisma.product.create({
      data: {
        streamKey: source.streamKey,
        name: `${source.name} (복사)`,
        price: source.price,
        quantity: source.quantity,
        colorOptions: source.colorOptions,
        sizeOptions: source.sizeOptions,
        shippingFee: source.shippingFee,
        freeShippingMessage: source.freeShippingMessage,
        timerEnabled: source.timerEnabled,
        timerDuration: source.timerDuration,
        imageUrl: source.imageUrl,
        images: source.images,
        isNew: source.isNew,
        discountRate: source.discountRate,
        originalPrice: source.originalPrice,
        status: 'AVAILABLE',
      },
    });

    this.logger.log(`Product duplicated: ${source.id} → ${product.id}`);

    this.eventEmitter.emit('product:created', {
      productId: product.id,
      streamKey: product.streamKey,
      product: this.mapToResponseDto(product),
    });

    return this.mapToResponseDto(product);
  }

  /**
   * Reorder products by ID array
   */
  @LogErrors('reorder products')
  async reorder(dto: ReorderProductsDto): Promise<void> {
    await this.prisma.$transaction(
      dto.ids.map((id, index) =>
        this.prisma.product.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    this.logger.log(`Products reordered: ${dto.ids.length} items`);
  }

  /**
   * Bulk update product status
   */
  @LogErrors('bulk update product status')
  async bulkUpdateStatus(dto: BulkUpdateStatusDto): Promise<{ updated: number }> {
    const result = await this.prisma.product.updateMany({
      where: { id: { in: dto.ids } },
      data: { status: dto.status as PrismaProductStatus },
    });

    // Emit events for each product
    for (const id of dto.ids) {
      this.eventEmitter.emit('product:updated', {
        productId: id,
      });
    }

    this.logger.log(`Bulk status update: ${result.count} products → ${dto.status}`);

    return { updated: result.count };
  }

  /**
   * Check if product has available stock
   * Epic 6: Used for cart reservation
   * Optimized: Uses Promise.all to avoid N+1 query
   */
  async checkStock(productId: string, quantity: number): Promise<boolean> {
    // Execute both queries in parallel to avoid N+1
    const [product, reservedQuantity] = await Promise.all([
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
    ]);

    if (!product) {
      throw new ProductNotFoundException(productId);
    }

    if (product.status !== 'AVAILABLE') {
      return false;
    }

    const reserved = reservedQuantity._sum.quantity || 0;
    const available = product.quantity - reserved;

    return available >= quantity;
  }

  /**
   * Get store products (from ended live streams)
   * Epic 11 Story 11.1
   */
  @LogErrors('get store products')
  async getStoreProducts(
    page = 1,
    limit = 24,
  ): Promise<{
    products: ProductResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    // Get products from ended (OFFLINE) live streams
    const products = await this.prisma.product.findMany({
      where: {
        liveStream: {
          status: 'OFFLINE',
        },
        status: 'AVAILABLE',
      },
      include: {
        liveStream: {
          select: {
            title: true,
            endedAt: true,
          },
        },
      },
      orderBy: {
        liveStream: {
          endedAt: 'desc',
        },
      },
      skip,
      take: limit,
    });

    const total = await this.prisma.product.count({
      where: {
        liveStream: {
          status: 'OFFLINE',
        },
        status: 'AVAILABLE',
      },
    });

    this.logger.log(
      `Retrieved ${products.length} store products (page ${page}/${Math.ceil(total / limit)})`,
    );

    return {
      products: products.map((p) => this.mapToResponseDto(p)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get live deal products from currently active live stream
   * Returns products linked to the active LIVE stream, or null if no live stream
   */
  @LogErrors('get live deals')
  async getLiveDeals(): Promise<{
    products: ProductResponseDto[];
    streamTitle: string;
    streamKey: string;
  } | null> {
    const activeLive = await this.prisma.liveStream.findFirst({
      where: { status: 'LIVE' },
      include: {
        products: {
          where: { status: 'AVAILABLE' },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          take: 8,
        },
      },
    });

    if (!activeLive || activeLive.products.length === 0) {
      return null;
    }

    return {
      products: activeLive.products.map((p) => this.mapToResponseDto(p)),
      streamTitle: activeLive.title,
      streamKey: activeLive.streamKey,
    };
  }

  /**
   * Get popular products sorted by confirmed sales count
   */
  @LogErrors('get popular products')
  async getPopularProducts(
    page = 1,
    limit = 8,
  ): Promise<{
    data: (ProductResponseDto & { soldCount: number })[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where: { status: 'AVAILABLE' },
        include: {
          _count: {
            select: {
              orderItems: {
                where: {
                  order: {
                    status: { in: ['PAYMENT_CONFIRMED', 'SHIPPED', 'DELIVERED'] },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          orderItems: {
            _count: 'desc',
          },
        },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where: { status: 'AVAILABLE' } }),
    ]);

    return {
      data: products.map((p) => ({
        ...this.mapToResponseDto(p),
        soldCount: p._count.orderItems,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Map Prisma model to Response DTO
   */
  private mapToResponseDto(product: Product): ProductResponseDto {
    return {
      id: product.id,
      streamKey: product.streamKey,
      name: product.name,
      price: parseFloat(product.price.toString()),
      stock: product.quantity, // Map quantity to stock
      colorOptions: product.colorOptions,
      sizeOptions: product.sizeOptions,
      shippingFee: parseFloat(product.shippingFee.toString()),
      freeShippingMessage: product.freeShippingMessage ?? undefined,
      timerEnabled: product.timerEnabled,
      timerDuration: product.timerDuration,
      imageUrl: product.imageUrl ?? undefined,
      images: product.images ?? [],
      sortOrder: product.sortOrder ?? 0,
      isNew: product.isNew ?? false,
      discountRate: product.discountRate ? parseFloat(product.discountRate.toString()) : undefined,
      originalPrice: product.originalPrice
        ? parseFloat(product.originalPrice.toString())
        : undefined,
      status: product.status as ProductStatus,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      // Legacy fields
      description: undefined,
      metadata: undefined,
    };
  }
}
