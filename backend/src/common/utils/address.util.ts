export function isCaliforniaAddress(shippingAddress: unknown): boolean {
  if (!shippingAddress || typeof shippingAddress !== 'object') {
    return false;
  }
  const state = (shippingAddress as Record<string, unknown>).state;
  return typeof state === 'string' && state.toUpperCase() === 'CA';
}
