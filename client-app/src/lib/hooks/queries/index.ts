/**
 * React Query Hooks
 * Centralized data fetching with caching and automatic refetching
 */

// Products
export {
  productKeys,
  useProducts,
  useProduct,
  useFeaturedProducts,
  useAddToCart,
} from './use-products';

// Streams
export { streamKeys, useActiveStreams, useUpcomingStreams, type LiveStream } from './use-streams';

// Orders
export { orderKeys, useOrders, useOrder, useCancelOrder } from './use-orders';

// Cart
export {
  cartKeys,
  useCart,
  useUpdateCartItem,
  useRemoveCartItem,
  useClearCart,
  type CartItem,
  type CartSummary,
} from './use-cart';

// Reservations
export {
  reservationKeys,
  useReservations,
  useCreateReservation,
  useCancelReservation,
} from './use-reservations';

// Points
export { usePointBalance, usePointHistory, type PointHistoryQuery } from './use-points';

// Query Key Factory
export { createQueryKeys } from './create-query-keys';
