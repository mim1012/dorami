import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateProductDto,
  UpdateProductDto,
  UpdateStockDto,
  ProductResponseDto,
} from './dto/product.dto';
import {
  ProductNotFoundException,
  InsufficientStockException,
} from '../../common/exceptions/business.exception';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(createDto: CreateProductDto): Promise<ProductResponseDto> {
    const product = await this.prisma.product.create({
      data: {
        streamKey: createDto.streamKey,
        name: createDto.name,
        price: new Decimal(createDto.price),
        quantity: createDto.stock || 0,
        colorOptions: [],
        sizeOptions: [],
        shippingFee: new Decimal(0),
        timerEnabled: false,
        timerDuration: 10,
      },
    });

    this.eventEmitter.emit('product:created', { productId: product.id });

    return this.mapToResponseDto(product);
  }

  async findAll(status?: string): Promise<ProductResponseDto[]> {
    const products = await this.prisma.product.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return products.map((p) => this.mapToResponseDto(p));
  }

  async findById(id: string): Promise<ProductResponseDto> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new ProductNotFoundException(id);
    }

    return this.mapToResponseDto(product);
  }

  async update(
    id: string,
    updateDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: updateDto.name,
        price: updateDto.price ? new Decimal(updateDto.price) : undefined,
        quantity: updateDto.stock,
        status: updateDto.status,
      },
    });

    this.eventEmitter.emit('product:updated', { productId: product.id });

    return this.mapToResponseDto(product);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.product.delete({
      where: { id },
    });

    this.eventEmitter.emit('product:deleted', { productId: id });
  }

  async updateStock(
    id: string,
    updateStockDto: UpdateStockDto,
  ): Promise<ProductResponseDto> {
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

    // Emit stock update event for WebSocket broadcast
    this.eventEmitter.emit('product:stock:updated', {
      productId: updatedProduct.id,
      oldStock: product.quantity,
      newStock: updatedProduct.quantity,
    });

    return this.mapToResponseDto(updatedProduct);
  }

  private mapToResponseDto(product: any): ProductResponseDto {
    return {
      id: product.id,
      name: product.name,
      description: undefined,
      price: Number(product.price),
      stock: product.quantity,
      status: product.status,
      metadata: undefined,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
