import { useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { apiClient } from '../api/client';

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, setLoading, logout } = useAuthStore();

  useEffect(() => {
    // Fetch user profile on mount if not loaded
    if (isLoading && !user) {
      fetchProfile();
    }
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/auth/me');
      setUser(response.data.data);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

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
