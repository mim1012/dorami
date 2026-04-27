import type { Product, ProductVariant } from '@/lib/types/product';

export type EditableProductVariant = {
  id?: string;
  color?: string;
  size?: string;
  label?: string;
  price: string;
  stock: string;
  status: 'ACTIVE' | 'SOLD_OUT' | 'HIDDEN';
};

export function createEmptyEditableVariant(): EditableProductVariant {
  return {
    color: '',
    size: '',
    label: '',
    price: '',
    stock: '',
    status: 'ACTIVE',
  };
}

export function normalizeEditableVariants(rows: EditableProductVariant[]) {
  return rows
    .map((row, index) => {
      const color = row.color?.trim() || undefined;
      const size = row.size?.trim() || undefined;
      const label = row.label?.trim() || [color, size].filter(Boolean).join(' / ') || undefined;
      const price = Number.parseFloat(row.price);
      const stock = Number.parseInt(row.stock, 10);

      if (!Number.isFinite(price) || !Number.isFinite(stock)) {
        return null;
      }

      return {
        ...(row.id ? { id: row.id } : {}),
        color,
        size,
        label,
        price,
        stock,
        status: row.status,
        sortOrder: index,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

export function deriveOptionSummaries(rows: EditableProductVariant[]) {
  const normalized = normalizeEditableVariants(rows).filter((row) => row.status !== 'HIDDEN');
  const colorOptions = [...new Set(normalized.map((row) => row.color).filter(Boolean))] as string[];
  const sizeOptions = [...new Set(normalized.map((row) => row.size).filter(Boolean))] as string[];
  const totalStock = normalized.reduce((sum, row) => sum + row.stock, 0);
  const activeRows = normalized.filter((row) => row.status === 'ACTIVE');
  const minPrice =
    activeRows.length > 0 ? Math.min(...activeRows.map((row) => row.price)) : undefined;

  return { colorOptions, sizeOptions, totalStock, minPrice };
}

export function resolveSelectedVariant(
  product: Pick<Product, 'variants'>,
  selectedColor?: string | null,
  selectedSize?: string | null,
): ProductVariant | undefined {
  const activeVariants = (product.variants ?? []).filter(
    (variant) => variant.status === 'ACTIVE' && !variant.deletedAt,
  );

  return activeVariants.find((variant) => {
    const colorMatches = selectedColor ? variant.color === selectedColor : true;
    const sizeMatches = selectedSize ? variant.size === selectedSize : true;
    const colorRequired = Boolean(variant.color) || activeVariants.some((item) => item.color);
    const sizeRequired = Boolean(variant.size) || activeVariants.some((item) => item.size);

    if (colorRequired && selectedColor && !colorMatches) return false;
    if (sizeRequired && selectedSize && !sizeMatches) return false;
    if (colorRequired && !selectedColor && variant.color) return false;
    if (sizeRequired && !selectedSize && variant.size) return false;
    return colorMatches && sizeMatches;
  });
}

export function getDisplayPrice(product: Product, variant?: ProductVariant) {
  return variant?.price ?? product.price;
}

export function getDisplayStock(product: Product, variant?: ProductVariant) {
  return variant?.stock ?? product.stock;
}
