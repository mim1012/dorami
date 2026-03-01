'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/components/common/Toast';
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
      const response = await apiClient.get<{ items: Order[]; total: number }>('/orders', {
        params,
      });
      return response.data;
    },
  });
}

// Fetch single order
export function useOrder(orderId: string) {
  return useQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: async () => {
      const response = await apiClient.get<Order>(`/orders/${orderId}`);
      return response.data;
    },
    enabled: !!orderId,
  });
}

// Create order mutation
export function useCreateOrder() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      cartItemIds: string[];
      depositorName: string;
      instagramId: string;
    }) => {
      const response = await apiClient.post<Order>('/orders', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
    onError: (error: any) => {
      if (error.statusCode === 401) {
        showToast('로그인 세션이 만료되었습니다', 'error');
        router.push('/login?reason=session_expired');
      } else if (error.statusCode === 400) {
        showToast(error.message || '요청 실패', 'error');
      } else {
        showToast(error.message || '알 수 없는 오류', 'error');
      }
    },
  });
}

// Cancel order mutation
export function useCancelOrder() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await apiClient.patch(`/orders/${orderId}/cancel`);
      return response.data;
    },
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
    onError: (error: any) => {
      if (error.statusCode === 401) {
        showToast('로그인 세션이 만료되었습니다', 'error');
        router.push('/login?reason=session_expired');
      } else if (error.statusCode === 400) {
        showToast(error.message || '주문 취소 실패', 'error');
      } else {
        showToast(error.message || '알 수 없는 오류', 'error');
      }
    },
  });
}
