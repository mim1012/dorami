import { apiClient } from './client';

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stockQuantity: number;
  imageUrl?: string;
  status: 'AVAILABLE' | 'SOLD_OUT';
  createdAt: string;
  updatedAt: string;
}

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
  const response = await apiClient.get<any>(`/products/featured?limit=${limit}`);
  // Backend returns { data: [...] } wrapped in another { data: ... }
  // apiClient extracts first layer, so response.data is { data: [...] }
  return response.data.data || response.data;
}
