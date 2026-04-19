import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './use-auth';
import { isProfileComplete } from '../utils/profile';

/**
 * Hook to guard routes that require completed profile.
 * Two-step check: authentication first, then profile completion.
 * Redirects to /login if not authenticated, /profile/register if profile is incomplete.
 */
export function useProfileGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isSessionVerified, isVerifying } = useAuth();

  const normalizedPath = pathname && pathname.startsWith('/') ? pathname : '/';
  const shouldSkipGuard = (() => {
    const prefixSkips = [
      '/login',
      '/auth',
      '/profile/register',
      '/terms',
      '/privacy',
      '/403',
      '/live',
    ];
    if (normalizedPath === '/') return true;
    return prefixSkips.some(
      (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
    );
  })();
  const guardPending = isLoading || isVerifying;

  useEffect(() => {
    if (guardPending) return;
    if (shouldSkipGuard) return;

    // Step 1: Authentication check
    const hasIdentity = !!(user?.kakaoId || user?.email);
    if (!isSessionVerified || !hasIdentity) {
      const safeReturnTo = normalizedPath.startsWith('/') ? normalizedPath : '/';
      router.replace(`/login?reason=session_expired&returnTo=${encodeURIComponent(safeReturnTo)}`);
      return;
    }

    // Step 2: Admin users skip profile completion
    if (user?.role === 'ADMIN') return;

    // Step 3: Profile completion check — redirect to /profile/register so user can fill in missing fields
    const userProfileComplete = isProfileComplete(user);
    if (!userProfileComplete) {
      const returnTo =
        normalizedPath !== '/' ? `?returnTo=${encodeURIComponent(normalizedPath)}` : '';
      router.replace(`/profile/register${returnTo}`);
    }
  }, [user, guardPending, isSessionVerified, router, normalizedPath, shouldSkipGuard]);

  return {
    isLoading: guardPending,
    isProfileComplete: isProfileComplete(user),
  };
}
