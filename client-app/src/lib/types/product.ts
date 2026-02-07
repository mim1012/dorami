/**
 * Frontend Product Types
 * Uses shared-types enums with frontend-specific interfaces
 * (numeric types for decimals after API transformation)
 */
import { ProductStatus } from '@live-commerce/shared-types';

// Re-export enum for convenience
export { ProductStatus } from '@live-commerce/shared-types';

/**
 * Frontend Product interface
 * Matches API response after transformation (decimals as numbers)
 */
export interface Product {
  id: string;
  streamKey: string;
  name: string;
  price: number;
  stock: number;
  colorOptions: string[];
  sizeOptions: string[];
  shippingFee: number;
  freeShippingMessage?: string;
  timerEnabled: boolean;
  timerDuration: number;
  imageUrl?: string;
  isNew?: boolean;
  discountRate?: number;
  originalPrice?: number;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Product list item (minimal info for lists)
 */
export interface ProductListItem {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  status: ProductStatus;
  stock: number;
}

/**
 * Add to cart request
 */
export interface AddToCartRequest {
  productId: string;
  quantity: number;
  color?: string;
  size?: string;
}
