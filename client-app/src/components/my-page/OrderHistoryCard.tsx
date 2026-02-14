'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button';
import { Body, Heading2 } from '@/components/common/Typography';

export function OrderHistoryCard() {
  const router = useRouter();

  return (
    <div className="bg-content-bg shadow-sm border border-border-color rounded-button p-6">
      <div className="flex items-center justify-between mb-4">
        <Heading2 className="text-hot-pink">주문 내역</Heading2>
        <Button variant="outline" size="sm" onClick={() => router.push('/orders')}>
          전체 보기
        </Button>
      </div>
      <Body className="text-secondary-text mb-4">
        주문하신 상품의 배송 상태를 확인하세요
      </Body>
      <Button variant="primary" fullWidth onClick={() => router.push('/orders')}>
        내 주문 확인하기
      </Button>
    </div>
  );
}
