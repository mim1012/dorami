import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { User } from '../types/user';

// WebView environments (Instagram, Facebook, LINE) may block localStorage.
// This wrapper falls back gracefully so the app still functions without persistence.
const safeLocalStorage: Storage = {
  get length() {
    try {
      return localStorage.length;
    } catch {
      return 0;
    }
  },
  key: (index: number) => {
    try {
      return localStorage.key(index);
    } catch {
      return null;
    }
  },
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Silently ignore — storage unavailable in restricted WebView
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently ignore
    }
  },
  clear: () => {
    try {
      localStorage.clear();
    } catch {
      // Silently ignore
    }
  },
};

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        }),
      setLoading: (loading) => set({ isLoading: loading }),
      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      storage: createJSONStorage(() => safeLocalStorage),
      onRehydrateStorage: () => (state) => {
        // Reset loading state after rehydration to prevent infinite loading.
        // Must call setLoading (Zustand setState) instead of direct mutation,
        // otherwise React subscribers are not notified and the spinner persists.
        if (state) {
          state.setLoading(false);
        }
      },
    },
  ),
);
