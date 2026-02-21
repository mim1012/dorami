/**
 * Price display utilities
 *
 * Backend contract: `price` is the final selling price (after discount).
 * `originalPrice` is the pre-discount price. `discountRate` is display-only.
 * Frontend should NEVER recalculate prices — just display `price` directly.
 */

export function getDisplayPrice(product: {
  price: number;
  originalPrice?: number;
  discountRate?: number;
}) {
  return {
    sellingPrice: product.price,
    originalPrice:
      product.discountRate && product.discountRate > 0
        ? (product.originalPrice ?? product.price)
        : undefined,
    discountRate:
      product.discountRate && product.discountRate > 0 ? product.discountRate : undefined,
    hasDiscount: !!(product.discountRate && product.discountRate > 0),
  };
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}
