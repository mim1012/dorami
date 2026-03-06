import type { User } from '@/lib/types/user';

export interface ShippingAddress {
  fullName?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
}

/**
 * Unified profile completion check across the app
 * Returns true only if user has ALL required profile fields:
 * - instagramId (string)
 * - depositorName (string)
 * - shippingAddress (object with fullName)
 */
export function isProfileComplete(user: User | null): boolean {
  if (!user) return false;

  const hasBasicInfo = !!(user.instagramId && user.depositorName);

  if (!hasBasicInfo) return false;

  const shippingAddress = user.shippingAddress as ShippingAddress | undefined;
  const hasShippingAddress = !!shippingAddress?.fullName;

  return hasShippingAddress;
}

/**
 * Check if user needs to complete their profile
 * (Authenticated but profile incomplete)
 */
export function needsProfileCompletion(user: User | null): boolean {
  if (!user) return false;
  const isAuthenticated = !!(user.kakaoId || user.email);
  return isAuthenticated && !isProfileComplete(user);
}
