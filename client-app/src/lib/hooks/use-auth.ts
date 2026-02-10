import { useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/auth';
import { apiClient } from '../api/client';

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, setLoading, logout } = useAuthStore();

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);

      // Staging/Production 환경에서는 실제 API 호출
      const response = await apiClient.get<{ id: string; kakaoId: string; email?: string; nickname?: string; profileImage?: string; role: string; depositorName?: string; instagramId?: string; shippingAddress?: object; createdAt: string; updatedAt: string }>('/auth/me');
      setUser(response.data);
    } catch {
      // API 실패 시 인증 해제 (mock user 사용하지 않음)
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setUser]);

  useEffect(() => {
    // Fetch user profile on mount if not loaded
    if (isLoading && !user) {
      fetchProfile();
    }
  }, [isLoading, user, fetchProfile]);

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
