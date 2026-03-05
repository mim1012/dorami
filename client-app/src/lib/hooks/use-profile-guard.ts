import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './use-auth';

/**
 * Hook to guard routes that require completed profile.
 * Two-step check: authentication first, then profile completion.
 * Redirects to /login if not authenticated, /profile/register if profile is incomplete.
 */
export function useProfileGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    // Step 1: Authentication check
    const isAuthenticated = !!(user?.kakaoId || user?.email);
    if (!isAuthenticated) {
      const returnTo = pathname || '/';
      const safeReturnTo = returnTo.startsWith('/') ? returnTo : '/';
      router.replace(`/login?reason=session_expired&returnTo=${encodeURIComponent(safeReturnTo)}`);
      return;
    }

    // Step 2: Admin users skip profile completion
    if (user?.role === 'ADMIN') return;

    // Step 3: Profile completion check
    const isProfileComplete = !!(user?.instagramId && user?.depositorName);
    if (!isProfileComplete) {
      router.replace('/profile/register');
    }
  }, [user, isLoading, router, pathname]);

  return {
    isLoading,
    isProfileComplete: !!(user?.instagramId && user?.depositorName),
  };
}
