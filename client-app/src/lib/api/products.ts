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
