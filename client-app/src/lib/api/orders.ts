import { apiClient } from './client';
import { Order, CreateOrderFromCartResponse } from '../types/order';

/**
 * Epic 8 Story 8.1: Create order from cart
 */
export async function createOrderFromCart(): Promise<CreateOrderFromCartResponse> {
  const response = await apiClient.post<CreateOrderFromCartResponse>('/orders/from-cart');
  return response.data;
}
