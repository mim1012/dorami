import { Role } from '@live-commerce/shared-types';

// Re-export for convenience
export { Role } from '@live-commerce/shared-types';

export interface ShippingAddress {
  fullName?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
}

export interface User {
  id: string;
  kakaoId: string;
  email?: string;
  name?: string;
  nickname?: string;
  profileImage?: string;
  role: Role | string;
  phone?: string;
  depositorName?: string;
  instagramId?: string;
  shippingAddress?: ShippingAddress | object;
  createdAt: string;
  updatedAt: string;
}

export interface CompleteProfileData {
  depositorName: string;
  instagramId: string;
  fullName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}
