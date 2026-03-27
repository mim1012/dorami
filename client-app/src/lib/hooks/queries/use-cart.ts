'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth';
import { createQueryKeys } from './create-query-keys';

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  price: string; // Backend returns Decimal as string (Lesson #9)
  quantity: number;
  color?: string;
  size?: string;
  shippingFee: string; // Backend returns Decimal as string
  timerEnabled: boolean;
  expiresAt?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'COMPLETED';
  subtotal: string; // Backend returns Decimal as string
  total: string; // Backend returns Decimal as string
  remainingSeconds?: number;
  product?: {
    imageUrl?: string;
    status: 'AVAILABLE' | 'SOLD_OUT';
  };
}

export interface CartSummary {
  items: CartItem[];
  itemCount: number;
  subtotal: string; // From backend as string, needs parseFloat()
  totalShippingFee: string; // From backend as string, needs parseFloat()
  grandTotal: string; // From backend as string, needs parseFloat()
  earliestExpiration?: string;
  shippingWaived?: boolean;
  freeShippingMode?: string;
  freeShippingThreshold?: number | null;
  cumulativePreviousSubtotal?: string;
  defaultShippingFee?: string;
}

// Query Keys
const baseKeys = createQueryKeys('cart');
export const cartKeys = {
  ...baseKeys,
  summary: () => [...baseKeys.all, 'summary'] as const,
};

// Fetch cart summary
export function useCart(options: { enabled?: boolean } = {}) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { enabled = true } = options;
  return useQuery({
    queryKey: cartKeys.summary(),
    queryFn: async () => {
      const response = await apiClient.get<CartSummary>('/cart');
      return response.data;
    },
    enabled: isAuthenticated && enabled,
    refetchInterval: (query) => {
      // Refetch more frequently if there are timer-enabled items
      const data = query.state.data;
      if (data?.items?.some((item) => item.timerEnabled && item.remainingSeconds)) {
        return 10000; // 10 seconds
      }
      return 30000; // 30 seconds (reduced from 60s to keep cart in sync with live stream activity)
    },
  });
}

// Update cart item mutation
export function useUpdateCartItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      const response = await apiClient.patch(`/cart/${itemId}`, { quantity });
      return response.data;
    },
    onMutate: async ({ itemId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: cartKeys.summary() });
      const previous = queryClient.getQueryData<CartSummary>(cartKeys.summary());

      queryClient.setQueryData<CartSummary>(cartKeys.summary(), (old) => {
        if (!old) return old;
        const items = old.items.map((item) => (item.id === itemId ? { ...item, quantity } : item));
        const subtotalCents = items.reduce(
          (sum, i) => sum + Math.round(Number(i.price) * 100) * i.quantity,
          0,
        );
        const shippingFeeCents = Math.round(parseFloat(old.totalShippingFee) * 100);
        return {
          ...old,
          items,
          itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
          subtotal: (subtotalCents / 100).toFixed(2),
          grandTotal: ((subtotalCents + shippingFeeCents) / 100).toFixed(2),
        };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(cartKeys.summary(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
  });
}

// Remove cart item mutation
export function useRemoveCartItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const response = await apiClient.delete(`/cart/${itemId}`);
      return response.data;
    },
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: cartKeys.summary() });
      const previous = queryClient.getQueryData<CartSummary>(cartKeys.summary());

      queryClient.setQueryData<CartSummary>(cartKeys.summary(), (old) => {
        if (!old) return old;
        const items = old.items.filter((item) => item.id !== itemId);
        const subtotalCents = items.reduce(
          (sum, i) => sum + Math.round(Number(i.price) * 100) * i.quantity,
          0,
        );
        const shippingFeeCents = Math.round(parseFloat(old.totalShippingFee) * 100);
        return {
          ...old,
          items,
          itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
          subtotal: (subtotalCents / 100).toFixed(2),
          grandTotal: ((subtotalCents + shippingFeeCents) / 100).toFixed(2),
        };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(cartKeys.summary(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
  });
}

// Clear cart mutation
export function useClearCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.delete('/cart');
      return response.data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: cartKeys.summary() });
      const previous = queryClient.getQueryData<CartSummary>(cartKeys.summary());

      queryClient.setQueryData<CartSummary>(cartKeys.summary(), (old) => {
        if (!old) return old;
        return {
          ...old,
          items: [],
          itemCount: 0,
          subtotal: '0',
          totalShippingFee: '0',
          grandTotal: '0',
          earliestExpiration: undefined,
        };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(cartKeys.summary(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
  });
}
