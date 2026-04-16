'use client';

import { useAuth } from '@/lib/hooks/use-auth';
import { useTokenAutoRefresh } from '@/lib/auth/token-auto-refresh';

export function AuthSessionManager({ children }: { children: React.ReactNode }) {
  const { authStatus, isAuthenticated } = useAuth();

  useTokenAutoRefresh('global-auth-session', {
    enabled: authStatus === 'verified' && isAuthenticated,
  });

  return <>{children}</>;
}
