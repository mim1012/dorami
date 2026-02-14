'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Body } from '@/components/common/Typography';

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <Body className="text-secondary-text">Redirecting to dashboard...</Body>
    </div>
  );
}
