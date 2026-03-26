import { OrderStatus, PaymentStatus } from '@live-commerce/shared-types';

// Re-export for convenience
export { OrderStatus, PaymentStatus } from '@live-commerce/shared-types';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  shippingFee: number;
  color?: string;
  size?: string;
  imageUrl?: string;
}

export interface BankTransferInfo {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  amount: number;
  depositorName: string;
}

export interface Order {
  id: string;
  userId: string;
  userEmail: string;
  depositorName: string;
  instagramId: string;
  status: OrderStatus;
  subtotal: number;
  shippingFee: number;
  total: number;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  bankTransferInfo?: BankTransferInfo;
}

export interface CreateOrderFromCartResponse {
  id: string;
  userId: string;
  userEmail: string;
  depositorName: string;
  instagramId: string;
  status: OrderStatus;
  subtotal: number;
  shippingFee: number;
  total: number;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}
