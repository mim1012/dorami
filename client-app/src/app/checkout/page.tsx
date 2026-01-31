'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/contexts/CartContext';
import { useAuth } from '@/lib/hooks/use-auth';
import { Display, Heading2, Body } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { apiClient } from '@/lib/api/client';
import { AlertCircle, CheckCircle } from 'lucide-react';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, getTotalPrice, clearCart } = useCart();
  const { user } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) {
      router.push('/cart');
    }
  }, [items, router]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(price);
  };

  const handleSubmitOrder = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Create order
      const orderData = {
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        streamId: 'live-stream-1', // TODO: Get actual streamId
      };

      const response = await apiClient.post<{ id: string }>('/orders', orderData);

      // Clear cart
      clearCart();

      // Navigate to order complete page
      router.push(`/order-complete?orderId=${response.data.id}`);
    } catch (err: any) {
      console.error('Order creation failed:', err);
      setError(
        err.response?.data?.message || '주문 처리 중 오류가 발생했습니다. 다시 시도해주세요.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#121212] py-12 px-4 pb-24">
      <div className="w-full md:max-w-3xl md:mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Display className="text-hot-pink mb-2">주문하기</Display>
          <Body className="text-secondary-text">
            주문 정보를 확인하고 결제를 진행해주세요
          </Body>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-error/10 border border-error rounded-2xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
            <Body className="text-error flex-1">{error}</Body>
          </div>
        )}

        {/* Order Summary */}
        <div className="bg-content-bg rounded-2xl p-6 border border-white/5 mb-6">
          <Heading2 className="text-hot-pink mb-4">주문 상품</Heading2>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.productId} className="flex justify-between items-center">
                <div className="flex-1">
                  <Body className="text-primary-text">{item.productName}</Body>
                  <Body className="text-secondary-text text-sm">
                    {formatPrice(item.price)} x {item.quantity}개
                  </Body>
                </div>
                <Body className="text-primary-text font-bold">
                  {formatPrice(item.price * item.quantity)}
                </Body>
              </div>
            ))}
          </div>

          <div className="h-px bg-white/10 my-4" />

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Body className="text-secondary-text">상품 금액</Body>
              <Body className="text-primary-text">{formatPrice(getTotalPrice())}</Body>
            </div>
            <div className="flex justify-between items-center">
              <Body className="text-secondary-text">배송비</Body>
              <Body className="text-primary-text">무료</Body>
            </div>
            <div className="h-px bg-white/10 my-3" />
            <div className="flex justify-between items-center">
              <Heading2 className="text-primary-text">총 결제 금액</Heading2>
              <Display className="text-hot-pink">{formatPrice(getTotalPrice())}</Display>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-content-bg rounded-2xl p-6 border border-white/5 mb-6">
          <Heading2 className="text-hot-pink mb-4">결제 방법</Heading2>
          <div className="bg-white/50 rounded-xl p-4 border border-hot-pink/30">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-6 h-6 rounded-full bg-hot-pink flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <Heading2 className="text-primary-text">무통장 입금</Heading2>
            </div>
            <Body className="text-secondary-text text-sm leading-relaxed">
              주문 완료 후 입금 정보가 제공됩니다. 입금 확인 후 배송이 시작됩니다.
            </Body>
          </div>
        </div>

        {/* Terms Agreement */}
        <div className="bg-content-bg rounded-2xl p-6 border border-white/5 mb-6">
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="mt-1 w-5 h-5 rounded border-2 border-hot-pink bg-white checked:bg-hot-pink focus:ring-hot-pink focus:ring-2"
              />
              <Body className="text-primary-text text-sm flex-1">
                주문 내용을 확인했으며, 결제에 동의합니다.
              </Body>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="mt-1 w-5 h-5 rounded border-2 border-hot-pink bg-white checked:bg-hot-pink focus:ring-hot-pink focus:ring-2"
              />
              <Body className="text-primary-text text-sm flex-1">
                개인정보 수집 및 이용에 동의합니다.
              </Body>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleSubmitOrder}
            disabled={isSubmitting}
          >
            {isSubmitting ? '주문 처리 중...' : `${formatPrice(getTotalPrice())} 주문하기`}
          </Button>
          <Button
            variant="outline"
            size="lg"
            fullWidth
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            이전으로
          </Button>
        </div>
      </div>
    </div>
  );
}
