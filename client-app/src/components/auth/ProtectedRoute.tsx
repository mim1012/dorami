'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'USER' | 'ADMIN';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  // Treat as authenticated if we have a persisted user even while verifying
  const hasUser = !!user;

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated && !hasUser) {
        router.push('/login');
      } else if (requiredRole && user?.role !== requiredRole) {
        router.push('/'); // Redirect to home if role doesn't match
      }
    }
  }, [isAuthenticated, isLoading, hasUser, user, requiredRole, router]);

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
