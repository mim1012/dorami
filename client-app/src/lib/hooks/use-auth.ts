import { useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/auth';
import { apiClient, ApiError } from '../api/client';
import { isProfileComplete } from '../utils/profile';

let authBootstrapPromise: Promise<void> | null = null;
let authBootstrapAttempted = false;

type CurrentUserResponse = {
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
};

async function verifyServerSession(force = false): Promise<void> {
  if (authBootstrapPromise) {
    return authBootstrapPromise;
  }

  if (authBootstrapAttempted && !force) {
    return;
  }

  authBootstrapAttempted = true;
  useAuthStore.getState().startVerification();

  authBootstrapPromise = apiClient
    .get<CurrentUserResponse>('/users/me')
    .then((response) => {
      useAuthStore.getState().markVerified(response.data);
    })
    .catch((error) => {
      if (error instanceof ApiError && error.statusCode === 401) {
        useAuthStore.getState().markAnonymous();
        return;
      }

      // Network/5xx/timeout failures should not immediately evict persisted auth.
      // Keep the UI in an explicit verifying state so guarded flows can wait.
      useAuthStore.getState().deferVerification();
    })
    .finally(() => {
      authBootstrapPromise = null;
    });

  return authBootstrapPromise;
}

export function useAuth() {
  const { user, isAuthenticated, authStatus, isLoading, logout } = useAuthStore();
  const bootstrappedRef = useRef(false);

  const refreshProfile = useCallback(async () => {
    await verifyServerSession(true);
  }, []);

  useEffect(() => {
    if (bootstrappedRef.current) return;

    const runBootstrap = () => {
      if (bootstrappedRef.current) return;
      bootstrappedRef.current = true;
      void verifyServerSession();
    };

    if (useAuthStore.persist.hasHydrated()) {
      runBootstrap();
      return;
    }

    const unsub = useAuthStore.persist.onFinishHydration(() => {
      unsub();
      runBootstrap();
    });

    return unsub;
  }, []);

  const handleLogout = async () => {
    logout();
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout failed:', error);
    }
    window.location.href = '/login';
  };

  const isUserAuthenticated = !!(user?.kakaoId || user?.email);
  const isUserProfileComplete = isProfileComplete(user);
  const needsProfileCompletion =
    isUserAuthenticated && !isUserProfileComplete && user?.role !== 'ADMIN';
  const isSessionVerified = authStatus === 'verified';
  const isVerifying = authStatus === 'verifying';

  return {
    user,
    isAuthenticated,
    authStatus,
    isLoading,
    logout: handleLogout,
    refreshProfile,
    isUserAuthenticated,
    isProfileComplete: isUserProfileComplete,
    needsProfileCompletion,
    isSessionVerified,
    isVerifying,
  };
}
