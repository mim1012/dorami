'use client';

import { useRouter } from 'next/navigation';
import { Heading2, Body } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { ShoppingCart } from 'lucide-react';

export function CartEmptyState() {
  const router = useRouter();

  return (
    <div className="text-center py-16">
      <ShoppingCart className="w-24 h-24 text-secondary-text mx-auto mb-4 opacity-30" />
      <Heading2 className="text-primary-text mb-2">장바구니가 비어있습니다</Heading2>
      <Body className="text-secondary-text mb-6">라이브 방송에서 상품을 담아보세요!</Body>
      <Button variant="primary" onClick={() => router.push('/')}>
        홈으로 가기
      </Button>
    </div>
  );
}
