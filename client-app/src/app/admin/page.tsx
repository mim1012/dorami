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
    <div className="flex items-center justify-center py-24">
      <Body className="text-secondary-text">관리자 대시보드로 이동 중...</Body>
    </div>
  );
}
