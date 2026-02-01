import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateProductDto,
  UpdateProductDto,
  UpdateStockDto,
  ProductResponseDto,
  ProductStatus,
} from './dto/product.dto';
import {
  ProductNotFoundException,
  InsufficientStockException,
} from '../../common/exceptions/business.exception';
import { Decimal } from '@prisma/client/runtime/library';

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
  async create(createDto: CreateProductDto): Promise<ProductResponseDto> {
    try {
      // Verify stream exists
      const stream = await this.prisma.liveStream.findUnique({
        where: { streamKey: createDto.streamKey },
      });

      if (!stream) {
        throw new NotFoundException(`LiveStream with key ${createDto.streamKey} not found`);
      }

      const product = await this.prisma.product.create({
        data: {
          streamKey: createDto.streamKey,
          name: createDto.name,
          price: new Decimal(createDto.price),
          quantity: createDto.stock,
          colorOptions: createDto.colorOptions || [],
          sizeOptions: createDto.sizeOptions || [],
          shippingFee: new Decimal(createDto.shippingFee || 0),
          freeShippingMessage: createDto.freeShippingMessage,
          timerEnabled: createDto.timerEnabled || false,
          timerDuration: createDto.timerDuration || 10,
          imageUrl: createDto.imageUrl,
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
    } catch (error) {
      this.logger.error(`Failed to create product: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all products for a stream
   * Epic 5 Story 5.2, 5.3
   */
  async findByStreamKey(
    streamKey: string,
    status?: ProductStatus,
  ): Promise<ProductResponseDto[]> {
    try {
      const products = await this.prisma.product.findMany({
        where: {
          streamKey,
          ...(status && { status }),
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return products.map((product) => this.mapToResponseDto(product));
    } catch (error) {
      this.logger.error(`Failed to get products for stream ${streamKey}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all products (legacy method)
   */
  async findAll(status?: string): Promise<ProductResponseDto[]> {
    try {
      const products = await this.prisma.product.findMany({
        where: status ? { status: status as any } : undefined,
        orderBy: { createdAt: 'desc' },
      });

      return products.map((p) => this.mapToResponseDto(p));
    } catch (error) {
      this.logger.error(`Failed to get all products: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get a single product by ID
   * Epic 5 Story 5.4
   */
  async findById(id: string): Promise<ProductResponseDto> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id },
      });

      if (!product) {
        throw new ProductNotFoundException(id);
      }

      return this.mapToResponseDto(product);
    } catch (error) {
      this.logger.error(`Failed to get product ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update a product
   * Epic 5 Story 5.1
   */
  async update(id: string, updateDto: UpdateProductDto): Promise<ProductResponseDto> {
    try {
      // Check if product exists
      const existingProduct = await this.prisma.product.findUnique({
        where: { id },
      });

      if (!existingProduct) {
        throw new ProductNotFoundException(id);
      }

      // Check if trying to reduce quantity below items in carts
      if (updateDto.stock !== undefined) {
        const itemsInCarts = await this.prisma.cart.count({
          where: {
            productId: id,
            status: 'ACTIVE',
          },
        });

        if (updateDto.stock < 0) {
          throw new BadRequestException(
            `Cannot reduce quantity below items in active carts (${itemsInCarts})`,
          );
        }
      }

      const updateData: any = {};

      if (updateDto.name !== undefined) updateData.name = updateDto.name;
      if (updateDto.price !== undefined) updateData.price = new Decimal(updateDto.price);
      if (updateDto.stock !== undefined) updateData.quantity = updateDto.stock;
      if (updateDto.colorOptions !== undefined) updateData.colorOptions = updateDto.colorOptions;
      if (updateDto.sizeOptions !== undefined) updateData.sizeOptions = updateDto.sizeOptions;
      if (updateDto.shippingFee !== undefined) updateData.shippingFee = new Decimal(updateDto.shippingFee);
      if (updateDto.freeShippingMessage !== undefined) updateData.freeShippingMessage = updateDto.freeShippingMessage;
      if (updateDto.timerEnabled !== undefined) updateData.timerEnabled = updateDto.timerEnabled;
      if (updateDto.timerDuration !== undefined) updateData.timerDuration = updateDto.timerDuration;
      if (updateDto.imageUrl !== undefined) updateData.imageUrl = updateDto.imageUrl;
      if (updateDto.status !== undefined) updateData.status = updateDto.status;

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
    } catch (error) {
      this.logger.error(`Failed to update product ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Mark product as sold out
   * Epic 5 Story 5.1
   */
  async markAsSoldOut(id: string): Promise<ProductResponseDto> {
    try {
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
    } catch (error) {
      if (error.code === 'P2025') {
        throw new ProductNotFoundException(id);
      }
      this.logger.error(`Failed to mark product ${id} as sold out: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete a product
   */
  async delete(id: string): Promise<void> {
    try {
      // Check if product has any active carts
      const activeCartsCount = await this.prisma.cart.count({
        where: {
          productId: id,
          status: 'ACTIVE',
        },
      });

      if (activeCartsCount > 0) {
        throw new BadRequestException(
          `Cannot delete product with active cart items. Mark as sold out instead.`,
        );
      }

      const product = await this.prisma.product.findUnique({ where: { id } });

      await this.prisma.product.delete({
        where: { id },
      });

      this.logger.log(`Product deleted: ${id}`);

      // Emit deletion event
      this.eventEmitter.emit('product:deleted', {
        productId: id,
        streamKey: product?.streamKey,
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new ProductNotFoundException(id);
      }
      this.logger.error(`Failed to delete product ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update stock (increase/decrease)
   * Used by cart and order modules
   */
  async updateStock(id: string, updateStockDto: UpdateStockDto): Promise<ProductResponseDto> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id },
      });

      if (!product) {
        throw new ProductNotFoundException(id);
      }

      const newStock = product.quantity + updateStockDto.quantity;

      if (newStock < 0) {
        throw new InsufficientStockException(
          id,
          product.quantity,
          Math.abs(updateStockDto.quantity),
        );
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
    } catch (error) {
      this.logger.error(`Failed to update stock for product ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Check if product has available stock
   * Epic 6: Used for cart reservation
   */
  async checkStock(productId: string, quantity: number): Promise<boolean> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new ProductNotFoundException(productId);
    }

    if (product.status !== 'AVAILABLE') {
      return false;
    }

    // Count reserved items in active carts
    const reservedQuantity = await this.prisma.cart.aggregate({
      where: {
        productId,
        status: 'ACTIVE',
      },
      _sum: {
        quantity: true,
      },
    });

    const reserved = reservedQuantity._sum.quantity || 0;
    const available = product.quantity - reserved;

    return available >= quantity;
  }

  /**
   * Get store products (from ended live streams)
   * Epic 11 Story 11.1
   */
  async getStoreProducts(
    page: number = 1,
    limit: number = 24,
  ): Promise<{
    products: ProductResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
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

      this.logger.log(`Retrieved ${products.length} store products (page ${page}/${Math.ceil(total / limit)})`);

      return {
        products: products.map((p) => this.mapToResponseDto(p)),
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(`Failed to get store products: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Map Prisma model to Response DTO
   */
  private mapToResponseDto(product: any): ProductResponseDto {
    return {
      id: product.id,
      streamKey: product.streamKey,
      name: product.name,
      price: parseFloat(product.price.toString()),
      stock: product.quantity, // Map quantity to stock
      colorOptions: product.colorOptions,
      sizeOptions: product.sizeOptions,
      shippingFee: parseFloat(product.shippingFee.toString()),
      freeShippingMessage: product.freeShippingMessage,
      timerEnabled: product.timerEnabled,
      timerDuration: product.timerDuration,
      imageUrl: product.imageUrl,
      status: product.status as ProductStatus,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      // Legacy fields
      description: undefined,
      metadata: undefined,
    };
  }
}
