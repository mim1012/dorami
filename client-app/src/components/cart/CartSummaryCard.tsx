'use client';

import { Heading1, Heading2, Body } from '@/components/common/Typography';
import { formatPrice } from '@/lib/utils/format';

interface CartSummaryCardProps {
  itemCount: number;
  subtotal: number;
  totalShippingFee: number;
  grandTotal: number;
}

export function CartSummaryCard({
  itemCount,
  subtotal,
  totalShippingFee,
  grandTotal,
}: CartSummaryCardProps) {
  return (
    <div className="bg-content-bg rounded-xl p-6 border border-border-color mb-6">
      <Heading2 className="text-primary-text mb-4">주문 요약</Heading2>
      <div className="space-y-2">
        <div className="flex justify-between">
          <Body className="text-secondary-text">상품 금액 ({itemCount}개)</Body>
          <Body className="text-primary-text">{formatPrice(subtotal)}</Body>
        </div>
        <div className="flex justify-between">
          <Body className="text-secondary-text">배송비</Body>
          <Body className="text-primary-text">{formatPrice(totalShippingFee)}</Body>
        </div>
        <div className="border-t border-border-color pt-2 mt-2">
          <div className="flex justify-between items-center">
            <Heading2 className="text-primary-text">총 결제 금액</Heading2>
            <Heading1 className="text-hot-pink">{formatPrice(grandTotal)}</Heading1>
          </div>
        </div>
      </div>
    </div>
  );
}
