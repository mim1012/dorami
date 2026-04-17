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

export type AuthStatus = 'verifying' | 'verified' | 'anonymous';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authStatus: AuthStatus;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  startVerification: () => void;
  markVerified: (user: User | null) => void;
  markAnonymous: () => void;
  deferVerification: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      authStatus: 'verifying',
      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
          authStatus: user ? 'verified' : 'anonymous',
        }),
      setLoading: (loading) => set({ isLoading: loading }),
      startVerification: () =>
        set({
          isLoading: true,
          authStatus: 'verifying',
        }),
      markVerified: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
          authStatus: user ? 'verified' : 'anonymous',
        }),
      markAnonymous: () =>
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          authStatus: 'anonymous',
        }),
      deferVerification: () =>
        set({
          isLoading: false,
          authStatus: 'verifying',
        }),
      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          authStatus: 'anonymous',
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
        if (state) {
          state.startVerification();
        }
      },
    },
  ),
);
