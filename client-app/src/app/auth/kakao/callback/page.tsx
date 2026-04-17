'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { useAuthStore } from '@/lib/store/auth';
import { isProfileComplete } from '@/lib/utils/profile';
import {
  buildProfileRegisterRedirect,
  consumeStoredPostLoginReturnTo,
  readStoredPostLoginReturnTo,
  resolveAuthenticatedRedirect,
} from '@/lib/auth/navigation';

function KakaoCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshProfile } = useAuth();

  useEffect(() => {
    let cancelled = false;

    const finalizeCallback = async () => {
      const profileCompleteFromCallback = searchParams.get('profileComplete') === 'true';
      const kakaoName = searchParams.get('kakaoName');
      const preservedReturnTo = readStoredPostLoginReturnTo();

      try {
        await refreshProfile();
      } catch {
        if (!cancelled) {
          router.replace('/login?error=auth_failed');
        }
        return;
      }

      if (cancelled) return;

      const refreshedUser = useAuthStore.getState().user;
      if (!refreshedUser) {
        router.replace('/login?error=auth_failed');
        return;
      }

      const role = refreshedUser.role;
      const profileComplete = role === 'ADMIN' ? true : profileCompleteFromCallback || isProfileComplete(refreshedUser);

      if (!profileComplete) {
        router.replace(buildProfileRegisterRedirect(kakaoName, preservedReturnTo));
        return;
      }

      const nextPath = resolveAuthenticatedRedirect(
        role,
        consumeStoredPostLoginReturnTo(),
        role === 'ADMIN' ? '/admin' : '/',
      );
      router.replace(nextPath);
    };

    void finalizeCallback();

    return () => {
      cancelled = true;
    };
  }, [refreshProfile, router, searchParams]);

  return (
    <div className="min-h-screen bg-primary-black flex items-center justify-center">
      <div className="w-10 h-10 border-3 border-hot-pink/20 border-t-hot-pink rounded-full animate-spin" />
    </div>
  );
}

export default function KakaoCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-primary-black flex items-center justify-center">
          <div className="w-10 h-10 border-3 border-hot-pink/20 border-t-hot-pink rounded-full animate-spin" />
        </div>
      }
    >
      <KakaoCallbackHandler />
    </Suspense>
  );
}
