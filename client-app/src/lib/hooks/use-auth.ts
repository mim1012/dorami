import { useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/auth';
import { apiClient } from '../api/client';

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
        depositorName?: string;
        instagramId?: string;
        shippingAddress?: object;
        createdAt: string;
        updatedAt: string;
      }>('/users/me');
      setUser(response.data);
    } catch {
      // API 실패 시 인증 해제 (mock user 사용하지 않음)
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setUser]);

  useEffect(() => {
    // Skip profile fetch on /login page to avoid 401 infinite loops
    const isLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login';

    if (!isLoginPage && !fetchedRef.current && isLoading) {
      fetchedRef.current = true;
      fetchProfile();
    }
  }, [fetchProfile]);

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
      logout();
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
      logout();
    }
  };

  const needsProfileCompletion = user && (!user.instagramId || !user.depositorName);

  return {
    user,
    isAuthenticated,
    isLoading,
    logout: handleLogout,
    refreshProfile: fetchProfile,
    needsProfileCompletion,
  };
}
