import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductResponseDto,
  ProductStatus,
} from './dto/product.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new product
   */
  async createProduct(createProductDto: CreateProductDto): Promise<ProductResponseDto> {
    try {
      // Verify stream exists
      const stream = await this.prisma.liveStream.findUnique({
        where: { streamKey: createProductDto.streamKey },
      });

      if (!stream) {
        throw new NotFoundException(`LiveStream with key ${createProductDto.streamKey} not found`);
      }

      const product = await this.prisma.product.create({
        data: {
          streamKey: createProductDto.streamKey,
          name: createProductDto.name,
          price: new Decimal(createProductDto.price),
          quantity: createProductDto.quantity,
          colorOptions: createProductDto.colorOptions || [],
          sizeOptions: createProductDto.sizeOptions || [],
          shippingFee: new Decimal(createProductDto.shippingFee || 0),
          freeShippingMessage: createProductDto.freeShippingMessage,
          timerEnabled: createProductDto.timerEnabled || false,
          timerDuration: createProductDto.timerDuration || 10,
          imageUrl: createProductDto.imageUrl,
        },
      });

      this.logger.log(`Product created: ${product.id} for stream ${product.streamKey}`);

      return this.mapToResponseDto(product);
    } catch (error) {
      this.logger.error(`Failed to create product: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all products for a stream
   */
  async getProductsByStream(
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
   * Get a single product by ID
   */
  async getProductById(id: string): Promise<ProductResponseDto> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }

      return this.mapToResponseDto(product);
    } catch (error) {
      this.logger.error(`Failed to get product ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update a product
   */
  async updateProduct(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    try {
      // Check if product exists
      const existingProduct = await this.prisma.product.findUnique({
        where: { id },
      });

      if (!existingProduct) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }

      // Check if trying to reduce quantity below items in carts
      if (updateProductDto.quantity !== undefined) {
        const itemsInCarts = await this.prisma.cart.count({
          where: {
            productId: id,
            status: 'ACTIVE',
          },
        });

        if (updateProductDto.quantity < 0) {
          throw new BadRequestException(
            `Cannot reduce quantity below items in active carts (${itemsInCarts})`,
          );
        }
      }

      const updateData: any = {};

      if (updateProductDto.name !== undefined) updateData.name = updateProductDto.name;
      if (updateProductDto.price !== undefined) updateData.price = new Decimal(updateProductDto.price);
      if (updateProductDto.quantity !== undefined) updateData.quantity = updateProductDto.quantity;
      if (updateProductDto.colorOptions !== undefined) updateData.colorOptions = updateProductDto.colorOptions;
      if (updateProductDto.sizeOptions !== undefined) updateData.sizeOptions = updateProductDto.sizeOptions;
      if (updateProductDto.shippingFee !== undefined) updateData.shippingFee = new Decimal(updateProductDto.shippingFee);
      if (updateProductDto.freeShippingMessage !== undefined) updateData.freeShippingMessage = updateProductDto.freeShippingMessage;
      if (updateProductDto.timerEnabled !== undefined) updateData.timerEnabled = updateProductDto.timerEnabled;
      if (updateProductDto.timerDuration !== undefined) updateData.timerDuration = updateProductDto.timerDuration;
      if (updateProductDto.imageUrl !== undefined) updateData.imageUrl = updateProductDto.imageUrl;
      if (updateProductDto.status !== undefined) updateData.status = updateProductDto.status;

      const product = await this.prisma.product.update({
        where: { id },
        data: updateData,
      });

      this.logger.log(`Product updated: ${product.id}`);

      return this.mapToResponseDto(product);
    } catch (error) {
      this.logger.error(`Failed to update product ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Mark product as sold out
   */
  async markAsSoldOut(id: string): Promise<ProductResponseDto> {
    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: { status: 'SOLD_OUT' },
      });

      this.logger.log(`Product marked as sold out: ${product.id}`);

      return this.mapToResponseDto(product);
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }
      this.logger.error(`Failed to mark product ${id} as sold out: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete a product (soft delete by marking as SOLD_OUT)
   */
  async deleteProduct(id: string): Promise<void> {
    try {
      // Check if product has any carts or orders
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

      await this.prisma.product.delete({
        where: { id },
      });

      this.logger.log(`Product deleted: ${id}`);
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }
      this.logger.error(`Failed to delete product ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Check if product has available stock
   */
  async checkStock(productId: string, quantity: number): Promise<boolean> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
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
   * Decrease product stock (when cart is created)
   */
  async decreaseStock(productId: string, quantity: number): Promise<void> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      if (product.quantity < quantity) {
        throw new BadRequestException('Insufficient stock');
      }

      await this.prisma.product.update({
        where: { id: productId },
        data: {
          quantity: {
            decrement: quantity,
          },
        },
      });

      // Auto mark as sold out if quantity reaches 0
      if (product.quantity - quantity === 0) {
        await this.markAsSoldOut(productId);
      }

      this.logger.log(`Stock decreased for product ${productId}: -${quantity}`);
    } catch (error) {
      this.logger.error(`Failed to decrease stock for product ${productId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Increase product stock (when cart is cancelled/expired)
   */
  async increaseStock(productId: string, quantity: number): Promise<void> {
    try {
      await this.prisma.product.update({
        where: { id: productId },
        data: {
          quantity: {
            increment: quantity,
          },
          // If was sold out, mark as available again
          status: 'AVAILABLE',
        },
      });

      this.logger.log(`Stock increased for product ${productId}: +${quantity}`);
    } catch (error) {
      this.logger.error(`Failed to increase stock for product ${productId}: ${error.message}`, error.stack);
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
      quantity: product.quantity,
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
    };
  }
}
