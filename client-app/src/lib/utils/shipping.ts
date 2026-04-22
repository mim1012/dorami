/**
 * Shared shipping fee calculation logic.
 *
 * Three modes (per-broadcast setting on LiveStream):
 *   UNCONDITIONAL — always free
 *   THRESHOLD     — free when cumulative subtotal >= threshold
 *   DISABLED      — always charge defaultShippingFee
 *
 * Used by: /cart page, LiveCartPanel, useCheckoutFlow
 */

export interface ShippingCalcItem {
  price: string | number;
  quantity: number;
  streamKey?: string;
}

export interface ShippingCalcCart {
  shippingWaived?: boolean;
  freeShippingMode?: string;
  freeShippingThreshold?: number | null;
  cumulativePreviousSubtotal?: string;
  defaultShippingFee?: string;
}

/**
 * Calculate dynamic shipping fee for selected cart items.
 *
 * @param selectedItems  Items the user has checked / is ordering
 * @param cart           Cart-level metadata from GET /cart (shipping config)
 * @returns              Shipping fee in dollars (0 = free shipping)
 */
export function calculateDynamicShipping(
  selectedItems: ShippingCalcItem[],
  cart: ShippingCalcCart | null | undefined,
): number {
  if (selectedItems.length === 0 || !cart) return 0;

  const freeShippingMode = cart.freeShippingMode ?? 'DISABLED';
  const freeShippingThreshold = cart.freeShippingThreshold ?? null;
  const cumulativePrevious = parseFloat(cart.cumulativePreviousSubtotal ?? '0');
  const defaultFee = parseFloat(cart.defaultShippingFee ?? '10');

  if (cart.shippingWaived) return 0;
  if (freeShippingMode === 'UNCONDITIONAL') return 0;

  if (freeShippingMode === 'THRESHOLD' && freeShippingThreshold !== null) {
    const thresholdItems = selectedItems.filter((i) => i.streamKey);
    if (thresholdItems.length === 0) return defaultFee;

    const thresholdSubtotal =
      thresholdItems.reduce((sum, i) => sum + Math.round(Number(i.price) * 100) * i.quantity, 0) /
      100;

    return thresholdSubtotal + cumulativePrevious >= freeShippingThreshold ? 0 : defaultFee;
  }

  return defaultFee;
}
