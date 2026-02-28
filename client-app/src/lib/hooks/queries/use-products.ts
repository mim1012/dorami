'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { Product, AddToCartRequest } from '@/lib/types';

// Query Keys
export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: { streamKey?: string; status?: string }) =>
    [...productKeys.lists(), filters] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
  featured: (limit: number) => [...productKeys.all, 'featured', limit] as const,
};

// Fetch products by stream key
export function useProducts(streamKey: string, status?: string) {
  return useQuery({
    queryKey: productKeys.list({ streamKey, status }),
    queryFn: async () => {
      const params: Record<string, string> = { streamKey };
      if (status) params.status = status;
      const response = await apiClient.get<Product[]>('/products', { params });
      return response.data;
    },
    enabled: !!streamKey,
  });
}

// Fetch single product
export function useProduct(id: string) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: async () => {
      const response = await apiClient.get<Product>(`/products/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

// Fetch featured products
export function useFeaturedProducts(limit = 6) {
  return useQuery({
    queryKey: productKeys.featured(limit),
    queryFn: async () => {
      const response = await apiClient.get<Product[]>('/products/featured', {
        params: { limit },
      });
      return response.data;
    },
  });
}

// Add to cart mutation
export function useAddToCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddToCartRequest) => {
      const response = await apiClient.post('/cart', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
    onError: (error: any) => {
      // Error will be handled by the component using this hook
      // The component can access error via the mutation.error property
      console.error('Add to cart error:', error);
    },
  });
}
