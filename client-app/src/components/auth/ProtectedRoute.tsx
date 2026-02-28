'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'USER' | 'ADMIN';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const currentPath =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search || ''}`
      : '/';
  const safeCurrentPath = currentPath.startsWith('/') ? currentPath : '/';
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Treat as authenticated if we have a persisted user even while verifying
  const hasUser = !!user;

  useEffect(() => {
    if (!mounted || isLoading) return;
    if (!isAuthenticated && !hasUser) {
      router.push(`/login?redirect=${encodeURIComponent(safeCurrentPath)}`);
    } else if (requiredRole && user?.role !== requiredRole) {
      router.push('/'); // Redirect to home if role doesn't match
    }
  }, [mounted, isAuthenticated, isLoading, hasUser, user, requiredRole, router, safeCurrentPath]);

  // During SSR and initial hydration, always render children to avoid server/client mismatch.
  // Zustand's persist reads localStorage (client-only), causing different `hasUser` values
  // between server (null) and client (persisted user), which breaks hydration.
  if (!mounted) {
    return <>{children}</>;
  }

  // Show loading only if we have no persisted user at all
  if (isLoading && !hasUser) {
    return (
      <div className="min-h-screen bg-primary-black flex items-center justify-center">
        <p className="text-primary-text">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated && !hasUser) {
    return (
      <div className="min-h-screen bg-primary-black text-primary-text flex items-center justify-center px-6">
        <p>로그인 세션을 확인하는 중입니다. 잠시만 기다려 주세요.</p>
      </div>
    );
  }

  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div className="min-h-screen bg-primary-black text-primary-text flex items-center justify-center px-6">
        <p>해당 계정으로는 접근할 수 없는 페이지입니다.</p>
      </div>
    );
  }

  return <>{children}</>;
}
