import { Product } from '@prisma/client';
import { ProductResponseDto, ProductStatus } from './dto/product.dto';

/**
 * Maps a Prisma Product model to ProductResponseDto.
 * Used by both ProductsService and ProductEventsListener to ensure
 * consistent shape for API responses and WebSocket broadcasts.
 */
export function mapProductToDto(product: Product): ProductResponseDto {
  return {
    id: product.id,
    streamKey: product.streamKey,
    name: product.name,
    price: parseFloat(product.price.toString()),
    stock: product.quantity,
    colorOptions: Array.isArray(product.colorOptions) ? product.colorOptions : [],
    sizeOptions: Array.isArray(product.sizeOptions) ? product.sizeOptions : [],
    shippingFee: parseFloat(product.shippingFee.toString()),
    freeShippingMessage: product.freeShippingMessage ?? undefined,
    timerEnabled: product.timerEnabled,
    timerDuration: product.timerDuration,
    imageUrl: product.imageUrl ?? undefined,
    images: Array.isArray(product.images) ? product.images : [],
    sortOrder: product.sortOrder ?? 0,
    isNew: product.isNew ?? false,
    discountRate: product.discountRate ? parseFloat(product.discountRate.toString()) : undefined,
    originalPrice: product.originalPrice ? parseFloat(product.originalPrice.toString()) : undefined,
    status: product.status as ProductStatus,
    excludeFromStore: product.excludeFromStore ?? false,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    expiresAt: product.expiresAt?.toISOString() ?? null,
    description: undefined,
    metadata: undefined,
  };
}
