'use client';

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/components/common/Toast';
import type { Order, OrderStatus } from '@/lib/types';

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters: { status?: OrderStatus; page?: number }) =>
    [...orderKeys.lists(), filters] as const,
  listInfinite: (status?: OrderStatus, startDate?: string, endDate?: string) =>
    [...orderKeys.lists(), 'infinite', { status, startDate, endDate }] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
};

type OrdersPage = {
  items: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// Fetch user's orders (paginated)
export function useOrders(status?: OrderStatus, page = 1, limit = 20) {
  return useQuery({
    queryKey: orderKeys.list({ status, page }),
    queryFn: async () => {
      const params: Record<string, any> = { page, limit };
      if (status) params.status = status;
      const response = await apiClient.get<OrdersPage>('/orders', { params });
      return response.data;
    },
  });
}

// Infinite scroll version
export function useOrdersInfinite(status?: OrderStatus, startDate?: string, endDate?: string) {
  return useInfiniteQuery<OrdersPage, Error>({
    queryKey: orderKeys.listInfinite(status, startDate, endDate),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const params: Record<string, any> = { page: pageParam, limit: 10 };
      if (status) params.status = status;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const response = await apiClient.get<OrdersPage>('/orders', { params });
      return response.data;
    },
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
  });
}

// Fetch all orders for status counts (cached, used for badge display)
export function useAllOrdersForCounts() {
  return useQuery({
    queryKey: [...orderKeys.lists(), 'all-for-counts'] as const,
    queryFn: async () => {
      const response = await apiClient.get<OrdersPage>('/orders', {
        params: { page: 1, limit: 200 },
      });
      return response.data;
    },
    staleTime: 30_000,
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
