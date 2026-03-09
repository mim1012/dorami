import type { User } from '@/lib/types/user';
import type { ShippingAddress } from '@live-commerce/shared-types';
export type { ShippingAddress };

/**
 * Unified profile completion check across the app
 * Returns true only if user has ALL required profile fields.
 * Prefers the boolean `profileComplete` flag from the server (JWT/API).
 * Fallback check uses: email + shippingAddress.fullName (instagramId and phone are optional).
 */
export function isProfileComplete(user: User | null): boolean {
  if (!user) return false;
  if (typeof user.profileComplete === 'boolean') {
    return user.profileComplete;
  }

  // Fallback: check required fields only (instagramId and phone are optional)
  const hasEmail = !!user.email;

  if (!hasEmail) return false;

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
  if (!isAuthenticated) {
    return false;
  }
  if (typeof user.profileComplete === 'boolean') {
    return !user.profileComplete;
  }
  return !isProfileComplete(user);
}
