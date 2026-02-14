import { apiClient } from './client';

export interface Product {
  id: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  originalPrice?: number;
  stockQuantity?: number;
  stock?: number;
  imageUrl?: string;
  isNew?: boolean;
  discountRate?: number;
  colorOptions?: string[];
  sizeOptions?: string[];
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
  const response = await apiClient.get<Product[]>(`/products/featured?limit=${limit}`);
  return response.data;
}
