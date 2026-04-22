import { apiClient } from './client';
import type { Product } from '@/lib/types/product';

export type { Product };

export async function getProducts(status?: string): Promise<Product[]> {
  const query = status ? `?status=${status}` : '';
  const response = await apiClient.get<Product[]>(`/products${query}`);
  return response.data;
}

export async function getProductById(id: string): Promise<Product> {
  const response = await apiClient.get<Product>(`/products/${id}`);
  return response.data;
}

export async function getFeaturedProducts(limit: number = 6): Promise<Product[]> {
  const response = await apiClient.get<Product[]>(`/products/featured?limit=${limit}`);
  return response.data;
}

export async function getProductsByStreamKey(streamKey: string): Promise<Product[]> {
  const response = await apiClient.get<Product[]>('/products', {
    params: { streamKey, status: 'AVAILABLE', take: 100 },
  });
  return response.data;
}

export async function getPopularProducts(
  page: number = 1,
  limit: number = 8,
): Promise<{
  data: Product[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}> {
  const response = await apiClient.get<{
    data: Product[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }>(`/products/popular?page=${page}&limit=${limit}`);
  return response.data;
}

export async function getStoreProducts(
  page: number = 1,
  limit: number = 8,
): Promise<{
  data: Product[];
  meta: { total: number; page: number; totalPages: number };
}> {
  const response = await apiClient.get<{
    data: Product[];
    meta: { total: number; page: number; totalPages: number };
  }>(`/products/store?page=${page}&limit=${limit}`);
  return response.data;
}

export async function getLiveDeals(): Promise<{
  products: Product[];
  streamTitle: string;
  streamKey: string;
} | null> {
  const response = await apiClient.get<{
    products: Product[];
    streamTitle: string;
    streamKey: string;
  } | null>(`/products/live-deals`);
  return response.data;
}
