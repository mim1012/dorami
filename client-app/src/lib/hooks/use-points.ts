'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';

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

interface PointHistoryQuery {
  page?: number;
  limit?: number;
  transactionType?: string;
  startDate?: string;
  endDate?: string;
}

export function usePointBalance(userId?: string) {
  const [balance, setBalance] = useState<PointBalanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const endpoint = userId
        ? `/users/${userId}/points`
        : '/users/me/points';
      const response = await apiClient.get<PointBalanceResponse>(endpoint);
      setBalance(response.data);
    } catch (err: any) {
      console.error('Failed to fetch point balance:', err);
      setError(err.message || 'Failed to load points');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, isLoading, error, refetch: fetchBalance };
}

export function usePointHistory(userId?: string, initialQuery?: PointHistoryQuery) {
  const [data, setData] = useState<PointHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<PointHistoryQuery>(initialQuery || { page: 1, limit: 20 });

  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const endpoint = userId
        ? `/users/${userId}/points/history`
        : '/users/me/points/history';

      const params: Record<string, any> = {};
      if (query.page) params.page = query.page;
      if (query.limit) params.limit = query.limit;
      if (query.transactionType) params.transactionType = query.transactionType;
      if (query.startDate) params.startDate = query.startDate;
      if (query.endDate) params.endDate = query.endDate;

      const response = await apiClient.get<PointHistoryResponse>(endpoint, { params });
      setData(response.data);
    } catch (err: any) {
      console.error('Failed to fetch point history:', err);
      setError(err.message || 'Failed to load point history');
    } finally {
      setIsLoading(false);
    }
  }, [userId, query]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { data, isLoading, error, query, setQuery, refetch: fetchHistory };
}
