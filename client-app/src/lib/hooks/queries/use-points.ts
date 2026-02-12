'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { createQueryKeys } from './create-query-keys';

const pointKeys = createQueryKeys('points');

interface PointBalanceResponse {
  currentBalance: number;
  lifetimeEarned: number;
  lifetimeUsed: number;
  lifetimeExpired: number;
}

interface PointTransaction {
  id: string;
  transactionType: string;
  amount: number;
  balanceAfter: number;
  orderId?: string;
  reason?: string;
  expiresAt?: string;
  createdAt: string;
}

interface PointHistoryResponse {
  items: PointTransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PointHistoryQuery {
  page?: number;
  limit?: number;
  transactionType?: string;
  startDate?: string;
  endDate?: string;
}

export function usePointBalance(userId?: string) {
  return useQuery({
    queryKey: [...pointKeys.all, 'balance', userId ?? 'me'],
    queryFn: async () => {
      const endpoint = userId ? `/users/${userId}/points` : '/users/me/points';
      const response = await apiClient.get<PointBalanceResponse>(endpoint);
      return response.data;
    },
  });
}

export function usePointHistory(userId?: string, query?: PointHistoryQuery) {
  return useQuery({
    queryKey: [...pointKeys.all, 'history', userId ?? 'me', query],
    queryFn: async () => {
      const endpoint = userId ? `/users/${userId}/points/history` : '/users/me/points/history';

      const params: Record<string, any> = {};
      if (query?.page) params.page = query.page;
      if (query?.limit) params.limit = query.limit;
      if (query?.transactionType) params.transactionType = query.transactionType;
      if (query?.startDate) params.startDate = query.startDate;
      if (query?.endDate) params.endDate = query.endDate;

      const response = await apiClient.get<PointHistoryResponse>(endpoint, { params });
      return response.data;
    },
  });
}
