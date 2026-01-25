import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './use-auth';

/**
 * Hook to guard routes that require completed profile
 * Redirects to /profile/register if profile is incomplete
 */
export function useProfileGuard() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      // Not authenticated, redirect to login
      router.push('/login');
      return;
    }

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
