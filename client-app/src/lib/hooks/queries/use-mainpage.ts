'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { socketInstance } from '@/lib/socket';
import { getMainPageData, getPopularProducts } from '@/lib/api/mainpage';
import type { MainPageData, PopularProductDto } from '@live-commerce/shared-types';

export const mainpageKeys = {
  all: ['mainpage'] as const,
  data: () => [...mainpageKeys.all, 'data'] as const,
  popular: (page: number, limit: number) =>
    [...mainpageKeys.all, 'popular', { page, limit }] as const,
};

export function useMainPageData() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socketInstance) return;

    const ws = socketInstance;

    ws.on('upcoming:updated', () => {
      queryClient.invalidateQueries({ queryKey: mainpageKeys.data() });
    });

    return () => {
      ws.off('upcoming:updated');
    };
  }, [queryClient]);

  return useQuery<MainPageData>({
    queryKey: mainpageKeys.data(),
    queryFn: getMainPageData,
    staleTime: 10_000,
    refetchInterval: 30_000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
  });
}

export function usePopularProducts(page = 1, limit = 8) {
  return useQuery<{
    data: PopularProductDto[];
    meta: { page: number; limit: number; total: number };
  }>({
    queryKey: mainpageKeys.popular(page, limit),
    queryFn: () => getPopularProducts(page, limit),
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
  });
}
