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
      // Development 환경: API 실패 시 Mock 사용자 사용
      console.log('[DEV] API failed, using mock user for development');
      const mockUser = {
        id: 'dev-user-001',
        kakaoId: '9999999999',
        email: 'dev@dorami.test',
        nickname: '개발자 테스트',
        profileImage: 'https://via.placeholder.com/150',
        role: 'USER',
        depositorName: '테스트 예금주',
        instagramId: '@dev_test',
        shippingAddress: {
          fullName: 'Test User',
          address1: '123 Test Street',
          address2: 'Apt 456',
          city: 'Seoul',
          state: 'Seoul',
          zip: '12345',
          phone: '(555) 123-4567',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setUser(mockUser);
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
