'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button';
import { Body, Heading2 } from '@/components/common/Typography';
import { useAuthStore } from '@/lib/store/auth';

export function AdminDashboardCard() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const { isAuthenticated, user } = useAuthStore.getState();
    setIsAdmin(isAuthenticated && user?.role === 'ADMIN');
  }, []);

  if (!isAdmin) return null;

  return (
    <div className="bg-content-bg shadow-sm rounded-button p-6 mb-6 border-2 border-hot-pink">
      <div className="flex items-center justify-between mb-4">
        <Heading2 className="text-hot-pink">판매자 전용</Heading2>
        <div className="bg-hot-pink text-primary-text px-3 py-1 rounded-button text-caption font-bold">
          ADMIN
        </div>
      </div>
      <Body className="text-secondary-text mb-4">
        라이브 방송 관리, 주문 처리, 채팅 모더레이션 등 판매자 전용 기능에 접근할 수 있습니다.
      </Body>
      <Button variant="primary" fullWidth onClick={() => router.push('/admin')}>
        판매자 대시보드 시작하기
      </Button>
    </div>
  );
}
