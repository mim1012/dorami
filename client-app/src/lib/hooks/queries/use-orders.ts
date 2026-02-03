'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { Order, OrderStatus } from '@/lib/types';

// Query Keys
export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters: { status?: OrderStatus; page?: number }) =>
    [...orderKeys.lists(), filters] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
};

// Fetch user's orders
export function useOrders(status?: OrderStatus, page = 1, limit = 20) {
  return useQuery({
    queryKey: orderKeys.list({ status, page }),
    queryFn: async () => {
      const params: Record<string, any> = { page, limit };
      if (status) params.status = status;
      const response = await apiClient.get<{ items: Order[]; total: number }>(
        '/v1/orders',
        { params }
      );
      return response.data;
    },
  });
}

// Fetch single order
export function useOrder(orderId: string) {
  return useQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: async () => {
      const response = await apiClient.get<Order>(`/v1/orders/${orderId}`);
      return response.data;
    },
    enabled: !!orderId,
  });
}

// Create order mutation
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      cartItemIds: string[];
      depositorName: string;
      instagramId: string;
    }) => {
      const response = await apiClient.post<Order>('/v1/orders', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });
}

// Cancel order mutation
export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await apiClient.patch(`/v1/orders/${orderId}/cancel`);
      return response.data;
    },
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}
