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
      router.push('/403');
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
        <div className="text-center max-w-md">
          <h1 className="text-6xl font-bold text-hot-pink mb-4">403</h1>
          <h2 className="text-2xl font-semibold mb-2">접근 권한 없음</h2>
          <p className="text-secondary-text mb-8">
            해당 페이지에 접근할 수 있는 권한이 없습니다. 관리자 계정으로 로그인하세요.
          </p>
          <a
            href="/"
            className="inline-block bg-hot-pink hover:bg-hot-pink/80 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
          >
            홈으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
