import { apiClient } from './client';
import { Order, CreateOrderFromCartResponse } from '../types/order';

/**
 * Epic 8 Story 8.1: Create order from cart
 */
export async function createOrderFromCart(): Promise<CreateOrderFromCartResponse> {
  const response = await apiClient.post<CreateOrderFromCartResponse>('/orders/from-cart');
  return response.data;
}

/**
 * Epic 8 Story 8.2: Get order details with bank transfer info
 */
export async function getOrderById(orderId: string): Promise<Order> {
  const response = await apiClient.get<Order>(`/orders/${orderId}`);
  return response.data;
}

/**
 * Epic 8 Story 8.5: Get user's orders
 */
export async function getUserOrders(): Promise<Order[]> {
  const response = await apiClient.get<Order[]>('/orders');
  return response.data;
}

/**
 * Cancel an order
 */
export async function cancelOrder(orderId: string): Promise<void> {
  await apiClient.patch(`/orders/${orderId}/cancel`);
}
