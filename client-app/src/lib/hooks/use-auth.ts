import { useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/auth';
import { apiClient, ApiError } from '../api/client';
import { isProfileComplete } from '../utils/profile';

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, setLoading, logout } = useAuthStore();
  const fetchedRef = useRef(false);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);

      // /users/me는 depositorName, instagramId 등 프로필 필드 포함 (auth/me는 JWT payload만 반환)
      const response = await apiClient.get<{
        id: string;
        kakaoId: string;
        email?: string;
        nickname?: string;
        profileImage?: string;
        role: string;
        phone?: string;
        depositorName?: string;
        instagramId?: string;
        shippingAddress?: {
          fullName?: string;
          address1?: string;
          address2?: string;
          city?: string;
          state?: string;
          zip?: string;
          phone?: string;
        };
        createdAt: string;
        updatedAt: string;
      }>('/users/me');
      setUser(response.data);
    } catch (error) {
      // 401: 세션 만료 → 인증 해제
      // 그 외(네트워크, 429, 5xx): 기존 상태 유지 (spurious logout 방지)
      if (error instanceof ApiError && error.statusCode === 401) {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, [setLoading, setUser]);

  useEffect(() => {
    // Skip profile fetch on /login page to avoid 401 infinite loops
    const isLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login';

    if (!isLoginPage && !fetchedRef.current && isLoading) {
      fetchedRef.current = true;

      // Zustand persist uses async/await internally: even with synchronous localStorage,
      // hydration completes on a microtask AFTER the first React render. The closure
      // value of `user` may therefore be null even when localStorage has user data.
      // Call getState() here to read the current (post-hydration) store value instead
      // of relying on the possibly-stale closure — this prevents a 30s fetchProfile()
      // call when the user is already authenticated via localStorage.
      //
      // If persist has not yet hydrated (edge case in concurrent mode / SSR), fall back
      // to subscribing via onFinishHydration to decide once hydration completes.
      if (!useAuthStore.persist.hasHydrated()) {
        const unsub = useAuthStore.persist.onFinishHydration((hydratedState) => {
          unsub();
          if (hydratedState.user) {
            setLoading(false);
          } else {
            fetchProfile();
          }
        });
        return unsub;
      }

      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        setLoading(false);
      } else {
        fetchProfile();
      }
    }
  }, [fetchProfile, user, setLoading, isLoading]);

  const handleLogout = async () => {
    // Clear client state first — prevents ProtectedRoute from rendering
    // the "확인 중" interstitial while the API call is in flight
    logout();
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout failed:', error);
      // State already cleared; navigation proceeds regardless
    }
    window.location.href = '/login';
  };

  // Authentication: user has a valid identity (kakaoId or email)
  const isUserAuthenticated = !!(user?.kakaoId || user?.email);
  // Profile completion: user has filled in required profile fields
  const isUserProfileComplete = isProfileComplete(user);
  // Convenience: needs profile if authenticated but profile incomplete (admin exempt)
  const needsProfileCompletion =
    isUserAuthenticated && !isUserProfileComplete && user?.role !== 'ADMIN';

  return {
    user,
    isAuthenticated,
    isLoading,
    logout: handleLogout,
    refreshProfile: fetchProfile,
    isUserAuthenticated,
    isProfileComplete: isUserProfileComplete,
    needsProfileCompletion,
  };
}
