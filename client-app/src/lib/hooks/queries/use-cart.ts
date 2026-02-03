'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

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
export const cartKeys = {
  all: ['cart'] as const,
  summary: () => [...cartKeys.all, 'summary'] as const,
};

// Fetch cart summary
export function useCart() {
  return useQuery({
    queryKey: cartKeys.summary(),
    queryFn: async () => {
      const response = await apiClient.get<CartSummary>('/v1/cart');
      return response.data;
    },
    refetchInterval: (query) => {
      // Refetch more frequently if there are timer-enabled items
      const data = query.state.data;
      if (data?.items?.some((item) => item.timerEnabled && item.remainingSeconds)) {
        return 10000; // 10 seconds
      }
      return 60000; // 1 minute
    },
  });
}

// Update cart item mutation
export function useUpdateCartItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      const response = await apiClient.patch(`/v1/cart/${itemId}`, { quantity });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
  });
}

// Remove cart item mutation
export function useRemoveCartItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const response = await apiClient.delete(`/v1/cart/${itemId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
  });
}

// Clear cart mutation
export function useClearCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.delete('/v1/cart');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
  });
}
