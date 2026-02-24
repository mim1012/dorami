'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { createQueryKeys } from './create-query-keys';

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  color?: string;
  size?: string;
  shippingFee: number;
  timerEnabled: boolean;
  expiresAt?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'COMPLETED';
  subtotal: number;
  total: number;
  remainingSeconds?: number;
  product?: {
    imageUrl?: string;
    status: 'AVAILABLE' | 'SOLD_OUT';
  };
}

export interface CartSummary {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  totalShippingFee: number;
  grandTotal: number;
  earliestExpiration?: string;
}

// Query Keys
const baseKeys = createQueryKeys('cart');
export const cartKeys = {
  ...baseKeys,
  summary: () => [...baseKeys.all, 'summary'] as const,
};

// Fetch cart summary
export function useCart() {
  return useQuery({
    queryKey: cartKeys.summary(),
    queryFn: async () => {
      const response = await apiClient.get<CartSummary>('/cart');
      return response.data;
    },
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
        const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
        return {
          ...old,
          items,
          itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
          subtotal,
          grandTotal: subtotal + old.totalShippingFee,
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
        const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
        return {
          ...old,
          items,
          itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
          subtotal,
          grandTotal: subtotal + old.totalShippingFee,
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
          subtotal: 0,
          totalShippingFee: 0,
          grandTotal: 0,
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
