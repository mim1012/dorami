import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './use-auth';

/**
 * Hook to guard routes that require completed profile
 * Redirects to /profile/register if profile is incomplete
 */
export function useProfileGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      // Not authenticated — redirect to login with return target.
      // Pass reason so login page can show "세션이 만료되었습니다".
      const returnTo = pathname || '/';
      const safeReturnTo = returnTo.startsWith('/') ? returnTo : '/';
      router.push(`/login?reason=session_expired&returnTo=${encodeURIComponent(safeReturnTo)}`);
      return;
    }

    // Admin users skip profile completion
    if (user.role === 'ADMIN') return;

    // Check if profile is complete
    const needsProfileCompletion = !user.instagramId || !user.depositorName;

    if (needsProfileCompletion) {
      router.push('/profile/register');
    }
  }, [user, isLoading, router]);

  return {
    isLoading,
    isProfileComplete: user ? !!(user.instagramId && user.depositorName) : false,
  };
}
