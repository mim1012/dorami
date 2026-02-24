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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Treat as authenticated if we have a persisted user even while verifying
  const hasUser = !!user;

  useEffect(() => {
    if (!mounted || isLoading) return;
    if (!isAuthenticated && !hasUser) {
      router.push('/login');
    } else if (requiredRole && user?.role !== requiredRole) {
      router.push('/'); // Redirect to home if role doesn't match
    }
  }, [mounted, isAuthenticated, isLoading, hasUser, user, requiredRole, router]);

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
    return null; // Will redirect
  }

  if (requiredRole && user?.role !== requiredRole) {
    return null; // Will redirect
  }

  return <>{children}</>;
}
