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
 * Returns true only if user has ALL 4 required profile fields:
 * 1. phone (string)
 * 2. email (string)
 * 3. instagramId (string)
 * 4. shippingAddress (object with fullName)
 *
 * This ensures comprehensive user data capture for live commerce service.
 */
export function isProfileComplete(user: User | null): boolean {
  if (!user) return false;

  // Check all 4 required fields
  const hasPhone = !!user.phone;
  const hasEmail = !!user.email;
  const hasInstagramId = !!user.instagramId;

  if (!hasPhone || !hasEmail || !hasInstagramId) return false;

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
