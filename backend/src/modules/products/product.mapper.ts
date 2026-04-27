import { Product, ProductVariant, VariantStatus } from '@prisma/client';
import {
  ProductResponseDto,
  ProductStatus,
  ProductVariantResponseDto,
  VariantStatus as DtoVariantStatus,
} from './dto/product.dto';

export type ProductWithVariants = Product & {
  variants?: ProductVariant[];
};

function mapVariantToDto(variant: ProductVariant): ProductVariantResponseDto {
  return {
    id: variant.id,
    productId: variant.productId,
    color: variant.color ?? undefined,
    size: variant.size ?? undefined,
    label: variant.label ?? undefined,
    price: parseFloat(variant.price.toString()),
    stock: variant.stock,
    status: variant.status as DtoVariantStatus,
    sortOrder: variant.sortOrder,
    deletedAt: variant.deletedAt ?? null,
    createdAt: variant.createdAt,
    updatedAt: variant.updatedAt,
  };
}

function distinctDefined(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function getSortedVariants(product: ProductWithVariants): ProductVariant[] {
  return [...(product.variants ?? [])].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

function getActiveVariants(variants: ProductVariant[]): ProductVariant[] {
  return variants.filter(
    (variant) => variant.deletedAt === null && variant.status === VariantStatus.ACTIVE,
  );
}

/**
 * Maps a Prisma Product model to ProductResponseDto.
 * Used by both ProductsService and ProductEventsListener to ensure
 * consistent shape for API responses and WebSocket broadcasts.
 */
export function mapProductToDto(product: ProductWithVariants): ProductResponseDto {
  const variants = getSortedVariants(product);
  const activeVariants = getActiveVariants(variants);
  const hasActiveVariants = activeVariants.length > 0;
  const activeVariantPrices = activeVariants.map((variant) => parseFloat(variant.price.toString()));
  const derivedMinPrice = hasActiveVariants ? Math.min(...activeVariantPrices) : undefined;
  const derivedMaxPrice = hasActiveVariants ? Math.max(...activeVariantPrices) : undefined;

  return {
    id: product.id,
    streamKey: product.streamKey,
    name: product.name,
    price: derivedMinPrice ?? parseFloat(product.price.toString()),
    stock: hasActiveVariants
      ? activeVariants.reduce((total, variant) => total + variant.stock, 0)
      : product.quantity,
    colorOptions: hasActiveVariants
      ? distinctDefined(activeVariants.map((variant) => variant.color))
      : Array.isArray(product.colorOptions)
        ? product.colorOptions
        : [],
    sizeOptions: hasActiveVariants
      ? distinctDefined(activeVariants.map((variant) => variant.size))
      : Array.isArray(product.sizeOptions)
        ? product.sizeOptions
        : [],
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
    variants: variants.map(mapVariantToDto),
    minPrice: derivedMinPrice,
    maxPrice: derivedMaxPrice,
    status: product.status as ProductStatus,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    expiresAt: product.expiresAt?.toISOString() ?? null,
    description: undefined,
    metadata: undefined,
  };
}
