import { apiClient } from './client';
import { Order } from '../types/order';

/**
 * Epic 8 Story 8.2: Get order details with bank transfer info
 */
export async function getOrderById(orderId: string): Promise<Order> {
  const response = await apiClient.get<Order>(`/orders/${orderId}`);
  return response.data;
}

/**
 * Cancel an order
 */
export async function cancelOrder(orderId: string): Promise<void> {
  await apiClient.patch(`/orders/${orderId}/cancel`);
}
