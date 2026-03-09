'use client';

import { useProfileGuard } from '@/lib/hooks/use-profile-guard';

interface ProfileGuardBoundaryProps {
  children: React.ReactNode;
}

export function ProfileGuardBoundary({ children }: ProfileGuardBoundaryProps) {
  useProfileGuard();
  return <>{children}</>;
}
