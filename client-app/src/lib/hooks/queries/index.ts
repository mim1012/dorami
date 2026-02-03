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
export {
  streamKeys,
  useActiveStreams,
  useUpcomingStreams,
  useStream,
  type LiveStream,
} from './use-streams';

// Orders
export {
  orderKeys,
  useOrders,
  useOrder,
  useCreateOrder,
  useCancelOrder,
} from './use-orders';

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
