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
import {
  Prisma,
  ProductStatus as PrismaProductStatus,
  ProductVariant,
  StreamStatus,
  VariantStatus,
} from '@prisma/client';
import { mapProductToDto, ProductWithVariants } from './product.mapper';

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
  expiresAt?: Date | null;
}

type VariantInput = NonNullable<CreateProductDto['variants']>[number];

type ProductWithLiveStream = ProductWithVariants & {
  liveStream?: {
    title: string;
    endedAt: Date | null;
  } | null;
};

const productWithVariantsInclude = {
  variants: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private async loadProductWithVariants(id: string): Promise<ProductWithVariants> {
    return (await findOrThrow(
      this.prisma.product.findUnique({
        where: { id },
        include: productWithVariantsInclude,
      }),
      'Product',
      id,
    )) as ProductWithVariants;
  }

  private buildVariantMutationData(productId: string, variant: VariantInput, sortOrder: number) {
    return {
      productId,
      color: variant.color ?? null,
      size: variant.size ?? null,
      label: variant.label ?? null,
      price: new Decimal(variant.price),
      stock: variant.stock,
      status: variant.status ?? VariantStatus.ACTIVE,
      sortOrder: variant.sortOrder ?? sortOrder,
      deletedAt: null,
    };
  }

  private async syncVariants(
    productId: string,
    variants: VariantInput[],
  ): Promise<ProductVariant[]> {
    const persistedVariants: ProductVariant[] = [];

    for (const [index, variant] of variants.entries()) {
      const variantData = this.buildVariantMutationData(productId, variant, index);

      const existingVariant = variant.id
        ? await this.prisma.productVariant.findUnique({ where: { id: variant.id } })
        : await this.prisma.productVariant.findFirst({
            where: {
              productId,
              color: variant.color ?? null,
              size: variant.size ?? null,
            },
          });

      const persistedVariant = existingVariant
        ? await this.prisma.productVariant.update({
            where: { id: existingVariant.id },
            data: variantData,
          })
        : await this.prisma.productVariant.create({
            data: variantData,
          });

      persistedVariants.push(persistedVariant);
    }

    const activeVariantIds = persistedVariants.map((variant) => variant.id);

    await this.prisma.productVariant.updateMany({
      where: {
        productId,
        ...(activeVariantIds.length > 0 ? { id: { notIn: activeVariantIds } } : {}),
      },
      data: {
        status: VariantStatus.HIDDEN,
        deletedAt: new Date(),
      },
    });

    return persistedVariants;
  }

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

    const createdProduct = await this.prisma.product.create({
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
        images: this.sanitizeImages(createDto.images),
        isNew: createDto.isNew || false,
        discountRate:
          createDto.discountRate !== null && createDto.discountRate !== undefined
            ? new Decimal(createDto.discountRate)
            : null,
        originalPrice:
          createDto.originalPrice !== null && createDto.originalPrice !== undefined
            ? new Decimal(createDto.originalPrice)
            : null,
        expiresAt: createDto.expiresAt ? new Date(createDto.expiresAt) : null,
      },
    });

    let product: ProductWithVariants = createdProduct as ProductWithVariants;

    if (createDto.variants?.length) {
      await this.syncVariants(createdProduct.id, createDto.variants);
      product = await this.loadProductWithVariants(createdProduct.id);
    }

    this.logger.log(`Product created: ${product.id} for stream ${product.streamKey}`);

    // Emit event for WebSocket broadcast
    this.eventEmitter.emit('product:created', {
      productId: product.id,
      streamKey: product.streamKey,
      product: mapProductToDto(product),
    });

    return mapProductToDto(product);
  }

  /**
   * Get all products for a stream
   * Epic 5 Story 5.2, 5.3
   */
  @LogErrors('get products by stream key')
  async findByStreamKey(
    streamKey: string,
    status?: ProductStatus,
    includeExpired = false,
    options?: { take?: number; skip?: number },
  ): Promise<ProductResponseDto[]> {
    const products = await this.prisma.product.findMany({
      where: {
        streamKey,
        ...(status && { status }),
        ...(includeExpired ? {} : { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }),
      },
      include: productWithVariantsInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: options?.take ?? 100,
      skip: options?.skip ?? 0,
    });

    return products.map((product: ProductWithVariants) => mapProductToDto(product));
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
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: productWithVariantsInclude,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return products.map((product: ProductWithVariants) => mapProductToDto(product));
  }

  /**
   * Get all products (legacy method)
   */
  @LogErrors('get all products')
  async findAll(status?: ProductStatus, includeExpired = false): Promise<ProductResponseDto[]> {
    const products = await this.prisma.product.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(includeExpired ? {} : { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }),
      },
      include: productWithVariantsInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return products.map((product: ProductWithVariants) => mapProductToDto(product));
  }

  /**
   * Get a single product by ID
   * Epic 5 Story 5.4
   */
  @LogErrors('get product by id')
  async findById(id: string): Promise<ProductResponseDto> {
    const product = await this.loadProductWithVariants(id);
    return mapProductToDto(product);
  }

  /**
   * Update a product
   * Epic 5 Story 5.1
   */
  @LogErrors('update product')
  async update(id: string, updateDto: UpdateProductDto): Promise<ProductResponseDto> {
    // Check if product exists
    await this.loadProductWithVariants(id);

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
      updateData.images = this.sanitizeImages(updateDto.images);
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
    if (updateDto.expiresAt !== undefined) {
      updateData.expiresAt = updateDto.expiresAt ? new Date(updateDto.expiresAt) : null;
    }

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: updateData,
    });

    let product: ProductWithVariants = updatedProduct as ProductWithVariants;

    if (updateDto.variants) {
      await this.syncVariants(id, updateDto.variants);
      product = await this.loadProductWithVariants(id);
    }

    this.logger.log(`Product updated: ${product.id}`);

    // Emit event for WebSocket broadcast
    this.eventEmitter.emit('product:updated', {
      productId: product.id,
      streamKey: product.streamKey,
      product: mapProductToDto(product),
    });

    return mapProductToDto(product);
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

    return mapProductToDto(product);
  }

  /**
   * Delete a product
   */
  @LogErrors('delete product')
  async delete(id: string): Promise<void> {
    const product = (await findOrThrow(
      this.prisma.product.findUnique({ where: { id } }),
      'Product',
      id,
    )) as ProductWithVariants;

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
    const product = (await findOrThrow(
      this.prisma.product.findUnique({ where: { id } }),
      'Product',
      id,
    )) as ProductWithVariants;

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
      product: mapProductToDto(updatedProduct),
    });

    return mapProductToDto(updatedProduct);
  }

  /**
   * Duplicate an existing product
   */
  @LogErrors('duplicate product')
  async duplicate(id: string): Promise<ProductResponseDto> {
    const source = (await findOrThrow(
      this.prisma.product.findUnique({ where: { id } }),
      'Product',
      id,
    )) as ProductWithVariants;

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
      product: mapProductToDto(product),
    });

    return mapProductToDto(product);
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
    const uniqueIds = [...new Set(dto.ids)];

    const result = await this.prisma.product.updateMany({
      where: { id: { in: uniqueIds } },
      data: { status: dto.status as PrismaProductStatus },
    });

    const updatedProducts = await this.prisma.product.findMany({
      where: { id: { in: uniqueIds } },
      include: productWithVariantsInclude,
    });

    // Emit events for each product
    for (const product of updatedProducts) {
      if (!product.streamKey) {
        continue;
      }

      this.eventEmitter.emit('product:updated', {
        productId: product.id,
        streamKey: product.streamKey,
        product: mapProductToDto(product),
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
   * Get store products (from ended live streams + streamKey-less products)
   * Epic 11 Story 11.1
   * Includes: products with OFFLINE streamKey OR products with no streamKey (streamKey = null)
   */
  @LogErrors('get store products')
  async getStoreProducts(
    page = 1,
    limit = 24,
    search?: string,
  ): Promise<{
    products: ProductResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const whereCondition: Prisma.ProductWhereInput = {
      status: 'AVAILABLE',
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        {
          OR: [
            { streamKey: null },
            { streamKey: '' },
            {
              liveStream: {
                is: { status: StreamStatus.OFFLINE },
              },
            },
          ],
        },
        ...(search?.trim()
          ? [
              {
                name: {
                  contains: search.trim(),
                  mode: Prisma.QueryMode.insensitive,
                },
              } satisfies Prisma.ProductWhereInput,
            ]
          : []),
      ],
    };

    // Get products from ended (OFFLINE) live streams OR products with no streamKey (null or empty string)
    const products = (await this.prisma.product.findMany({
      where: whereCondition,
      include: {
        ...productWithVariantsInclude,
        liveStream: {
          select: {
            title: true,
            endedAt: true,
          },
        },
      },
      orderBy: [
        { liveStream: { endedAt: 'desc' } },
        { createdAt: 'desc' }, // Fallback for products with no streamKey
      ],
      skip,
      take: limit,
    })) as ProductWithLiveStream[];

    const total = await this.prisma.product.count({
      where: whereCondition,
    });

    this.logger.log(
      `Retrieved ${products.length} store products (page ${page}/${Math.ceil(total / limit)})`,
    );

    return {
      products: products.map((product: ProductWithVariants) => mapProductToDto(product)),
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
          include: productWithVariantsInclude,
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          take: 8,
        },
      },
    });

    if (!activeLive || activeLive.products.length === 0) {
      return null;
    }

    return {
      products: activeLive.products.map((product: ProductWithVariants) => mapProductToDto(product)),
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

    try {
      // Step 1: Get all products with their sale counts (raw SQL for performance)
      const productsWithCounts = await this.prisma.$queryRaw<
        Array<{ id: string; sold_count: bigint }>
      >`
        SELECT
          p.id,
          COUNT(DISTINCT oi.id) as sold_count
        FROM products p
        LEFT JOIN order_items oi ON p.id = oi.product_id
        LEFT JOIN orders o ON oi.order_id = o.id
        WHERE p.status = 'AVAILABLE'
          AND (p.expires_at IS NULL OR p.expires_at > NOW())
          AND (o.status IN ('PAYMENT_CONFIRMED', 'SHIPPED', 'DELIVERED') OR o.id IS NULL)
        GROUP BY p.id
        ORDER BY sold_count DESC
        LIMIT ${limit} OFFSET ${skip}
      `;

      const productIds = productsWithCounts.map((productWithCount) => productWithCount.id);

      // Step 2: Get full product details
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        include: productWithVariantsInclude,
      });

      // Step 3: Merge counts back and maintain sort order
      const productsWithSoldCount = productIds.map((productId) => {
        const product = products.find(
          (candidate: ProductWithVariants) => candidate.id === productId,
        )!;
        const countData = productsWithCounts.find((candidate) => candidate.id === productId)!;
        return {
          product,
          soldCount: Number(countData.sold_count),
        };
      });

      // Step 4: Get total count
      const total = await this.prisma.product.count({
        where: {
          status: 'AVAILABLE',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });

      return {
        data: productsWithSoldCount.map(
          ({ product, soldCount }: { product: ProductWithVariants; soldCount: number }) => ({
            ...mapProductToDto(product),
            soldCount,
          }),
        ),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('getPopularProducts error:', error);
      throw error;
    }
  }

  /**
   * Count expired products (for scheduler logging only).
   * Expired products are NOT deleted — Store queries already filter them out
   * via { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }.
   */
  async countExpiredProducts(): Promise<number> {
    return this.prisma.product.count({
      where: { expiresAt: { not: null, lte: new Date() } },
    });
  }

  /**
   * Deduplicate and trim image URLs, returning an empty array for undefined input.
   */
  private sanitizeImages(images: string[] | undefined): string[] {
    if (!images || images.length === 0) {
      return [];
    }
    const seen = new Set<string>();
    return images
      .map((url) => url.trim())
      .filter((url) => {
        if (!url || seen.has(url)) {
          return false;
        }
        seen.add(url);
        return true;
      });
  }
}
