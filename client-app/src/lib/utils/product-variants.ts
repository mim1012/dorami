import type { Product, ProductVariant } from '@/lib/types/product';

export type VariantPriceMode = 'ADD_ON' | 'DIRECT';

export type EditableProductVariant = {
  id?: string;
  color?: string;
  size?: string;
  label?: string;
  price: string;
  stock: string;
  status: 'ACTIVE' | 'SOLD_OUT' | 'HIDDEN';
};

function normalizeOptionValue(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function buildVariantKey(color?: string | null, size?: string | null) {
  return `${normalizeOptionValue(color) ?? ''}::${normalizeOptionValue(size) ?? ''}`;
}

function buildVariantLabel(color?: string, size?: string) {
  return [color, size].filter(Boolean).join(' / ');
}

function formatEditablePrice(value: number) {
  return Number.isInteger(value) ? String(value) : String(value);
}

function toNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

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

export function parseVariantOptionCsv(input: string): string[] {
  const seen = new Set<string>();

  return input
    .split(',')
    .map((value) => value.trim())
    .filter((value) => {
      if (!value || seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
}

export function inferVariantPriceMode(
  variants: Array<Pick<ProductVariant, 'price' | 'status' | 'deletedAt'>>,
): VariantPriceMode {
  const visibleVariants = variants.filter(
    (variant) => !variant.deletedAt && variant.status !== 'HIDDEN',
  );

  if (visibleVariants.length === 0) {
    return 'ADD_ON';
  }

  // Existing persisted variant prices do not carry enough metadata to reliably distinguish
  // between "base price + add-on" and "direct price per variant" modes.
  // Default to DIRECT for edit flows so the stored final prices are preserved as-is.
  return 'DIRECT';
}

export function buildColorSizeEditableVariants({
  colors,
  sizes,
  existingRows,
  priceMode,
  basePrice,
}: {
  colors: string[];
  sizes: string[];
  existingRows: EditableProductVariant[];
  priceMode: VariantPriceMode;
  basePrice?: number;
}): EditableProductVariant[] {
  const normalizedColors = colors.map((color) => color.trim()).filter(Boolean);
  const normalizedSizes = sizes.map((size) => size.trim()).filter(Boolean);
  if (normalizedColors.length === 0 && normalizedSizes.length === 0) {
    return [];
  }

  const priceSeed =
    priceMode === 'ADD_ON' ? '0' : basePrice != null ? formatEditablePrice(basePrice) : '';

  const colorAxis = normalizedColors.length > 0 ? normalizedColors : [''];
  const sizeAxis = normalizedSizes.length > 0 ? normalizedSizes : [''];
  const combos = colorAxis.flatMap((color) => sizeAxis.map((size) => ({ color, size })));

  const existingMap = new Map(
    existingRows.map((row) => [buildVariantKey(row.color, row.size), row]),
  );

  return combos.map(({ color, size }) => {
    const existing = existingMap.get(buildVariantKey(color, size));
    if (existing) {
      return {
        ...existing,
        color,
        size,
        label: normalizeOptionValue(existing.label) ?? buildVariantLabel(color, size),
      };
    }

    return {
      color,
      size,
      label: buildVariantLabel(color, size),
      price: priceSeed,
      stock: '0',
      status: 'ACTIVE',
    };
  });
}

export function convertVariantRowsPriceMode(
  rows: EditableProductVariant[],
  {
    from,
    to,
    basePrice = 0,
  }: {
    from: VariantPriceMode;
    to: VariantPriceMode;
    basePrice?: number;
  },
): EditableProductVariant[] {
  if (from === to) {
    return rows;
  }

  return rows.map((row) => {
    const parsedPrice = toNumber(row.price);
    if (parsedPrice == null) {
      return row;
    }

    const nextPrice =
      from === 'ADD_ON' && to === 'DIRECT' ? basePrice + parsedPrice : parsedPrice - basePrice;

    return {
      ...row,
      price: formatEditablePrice(nextPrice),
    };
  });
}

export function validateColorSizeVariants(
  rows: EditableProductVariant[],
  {
    priceMode,
    requireAtLeastOneCombination,
  }: {
    priceMode: VariantPriceMode;
    requireAtLeastOneCombination: boolean;
  },
): string | null {
  if (requireAtLeastOneCombination && rows.length === 0) {
    return '색상 또는 사이즈 옵션을 입력해 조합을 하나 이상 만들어주세요.';
  }

  for (const row of rows) {
    const price = toNumber(row.price);
    const stock = Number.parseInt(row.stock, 10);

    if (price == null) {
      return '모든 옵션 조합의 가격을 입력해주세요.';
    }

    if (priceMode === 'ADD_ON' && price < 0) {
      return '옵션 추가금은 0 이상이어야 합니다.';
    }

    if (priceMode === 'DIRECT' && price <= 0) {
      return '옵션별 개별 가격은 0보다 커야 합니다.';
    }

    if (!Number.isFinite(stock) || stock < 0) {
      return '모든 옵션 조합의 재고는 0 이상의 정수여야 합니다.';
    }
  }

  return null;
}

export function normalizeEditableVariants(rows: EditableProductVariant[]) {
  return rows
    .map((row, index) => {
      const color = normalizeOptionValue(row.color);
      const size = normalizeOptionValue(row.size);
      const label = normalizeOptionValue(row.label) || buildVariantLabel(color, size) || undefined;
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

export function serializeVariantsForSubmit(
  rows: EditableProductVariant[],
  { priceMode, basePrice = 0 }: { priceMode: VariantPriceMode; basePrice?: number },
) {
  return normalizeEditableVariants(rows).map((row) => ({
    ...row,
    price: priceMode === 'ADD_ON' ? basePrice + row.price : row.price,
  }));
}

export function deriveOptionSummaries(rows: EditableProductVariant[]) {
  const normalized = normalizeEditableVariants(rows).filter((row) => row.status !== 'HIDDEN');
  const colorOptions = Array.from(
    new Set(normalized.map((row) => row.color).filter((value): value is string => Boolean(value))),
  );
  const sizeOptions = Array.from(
    new Set(normalized.map((row) => row.size).filter((value): value is string => Boolean(value))),
  );
  const totalStock = normalized
    .filter((row) => row.status === 'ACTIVE')
    .reduce((sum, row) => sum + row.stock, 0);
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
