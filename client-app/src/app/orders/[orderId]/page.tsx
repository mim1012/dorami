'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useOrder } from '@/lib/hooks/queries/use-orders';
import { apiClient } from '@/lib/api/client';
import { OrderStatus } from '@/lib/types/order';
import Image from 'next/image';
import { CheckCircle, Clock, Package, ChevronLeft, Copy, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Display, Heading2, Body } from '@/components/common/Typography';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { useToast } from '@/components/common/Toast';
import { formatPrice } from '@/lib/utils/price';

type PaymentConfig = {
  zelleEmail: string;
  zelleRecipientName: string;
  venmoEmail: string;
  venmoRecipientName: string;
};

function OrderDetailSkeleton() {
  return (
    <div className="min-h-screen bg-primary-black py-6 px-4 pb-24 animate-pulse">
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        <div className="h-8 w-28 bg-border-color/50 rounded mb-6" />
        {/* Header card */}
        <div className="bg-content-bg rounded-2xl border border-border-color p-5 mb-4">
          <div className="h-5 bg-border-color/50 rounded w-40 mb-3" />
          <div className="h-4 bg-border-color/50 rounded w-56" />
        </div>
        {/* Timeline card */}
        <div className="bg-content-bg rounded-2xl border border-border-color p-5 mb-4">
          <div className="h-5 bg-border-color/50 rounded w-24 mb-6" />
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-border-color/50 flex-shrink-0" />
                <div className="pt-2">
                  <div className="h-4 bg-border-color/50 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Payment card */}
        <div className="bg-content-bg rounded-2xl border border-border-color p-5 mb-4">
          <div className="h-5 bg-border-color/50 rounded w-32 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-border-color/30 rounded-lg" />
            ))}
          </div>
        </div>
        {/* Items card */}
        <div className="bg-content-bg rounded-2xl border border-border-color p-5 mb-4">
          <div className="h-5 bg-border-color/50 rounded w-24 mb-4" />
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 bg-border-color/30 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = typeof params.orderId === 'string' ? params.orderId : undefined;
  const { showToast } = useToast();
  const [reordering, setReordering] = useState(false);

  const { data: order, isLoading: orderLoading, error: orderError } = useOrder(orderId ?? '');

  const handleReorder = async () => {
    if (!order) return;
    setReordering(true);
    try {
      await Promise.all(
        order.items.map((item) =>
          apiClient.post('/cart', {
            productId: item.productId,
            quantity: item.quantity,
            ...(item.color ? { color: item.color } : {}),
            ...(item.size ? { size: item.size } : {}),
          }),
        ),
      );
      showToast('장바구니에 담았습니다', 'success');
    } catch {
      showToast('장바구니 담기에 실패했습니다', 'error');
    } finally {
      setReordering(false);
    }
  };

  const { data: paymentConfig } = useQuery({
    queryKey: ['config', 'payment'],
    queryFn: async () => {
      const res = await apiClient.get<PaymentConfig>('/config/payment');
      return res.data;
    },
    staleTime: 5 * 60_000,
  });

  // Use global formatPrice from @/lib/utils/price (imported at top)

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value).then(() => showToast('복사되었습니다', 'success'));
  };

  const getStatusSteps = () => {
    if (!order) return [];

    const steps = [
      { label: '주문 완료', icon: CheckCircle, status: 'ORDER_CREATED' },
      { label: '입금 대기', icon: Clock, status: 'PENDING_PAYMENT' },
      { label: '결제 확인', icon: CheckCircle, status: 'PAYMENT_CONFIRMED' },
    ];

    const statusOrder: OrderStatus[] = [OrderStatus.PENDING_PAYMENT, OrderStatus.PAYMENT_CONFIRMED];

    const currentIndex = statusOrder.indexOf(order.status);

    return steps.map((step, index) => {
      if (index === 0) return { ...step, completed: true, current: false };
      if (index === 1)
        return { ...step, completed: currentIndex >= 0, current: currentIndex === 0 };
      if (index === 2)
        return { ...step, completed: currentIndex >= 1, current: currentIndex === 1 };
      return { ...step, completed: false, current: false };
    });
  };

  if (!orderId)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hot-pink" />
      </div>
    );

  if (orderLoading) {
    return (
      <>
        <OrderDetailSkeleton />
        <BottomTabBar />
      </>
    );
  }

  if (orderError || !order) {
    return (
      <>
        <div className="min-h-screen bg-primary-black py-12 px-4 pb-24">
          <div className="max-w-2xl mx-auto text-center">
            <Display className="text-error mb-4">주문을 찾을 수 없습니다</Display>
            <Body className="text-secondary-text mb-6">
              {orderError
                ? (orderError as any).message || '주문 정보를 불러올 수 없습니다'
                : '주문 정보를 불러올 수 없습니다'}
            </Body>
            <Button variant="primary" onClick={() => router.push('/orders')}>
              주문 목록 보기
            </Button>
          </div>
        </div>
        <BottomTabBar />
      </>
    );
  }

  const statusSteps = getStatusSteps();
  const isCancelled = order.status === OrderStatus.CANCELLED;
  const isPendingPayment = order.status === OrderStatus.PENDING_PAYMENT;
  const zelleEmail = paymentConfig?.zelleEmail ?? '';
  const zelleRecipientName = paymentConfig?.zelleRecipientName ?? '';
  const venmoEmail = paymentConfig?.venmoEmail ?? '';
  const venmoRecipientName = paymentConfig?.venmoRecipientName ?? '';

  return (
    <>
      <div className="min-h-screen bg-primary-black py-6 px-4 pb-24">
        <div className="max-w-2xl mx-auto">
          {/* Back button */}
          <button
            onClick={() => router.push('/orders')}
            className="flex items-center gap-1.5 text-secondary-text hover:text-primary-text transition-colors mb-6"
          >
            <ChevronLeft className="w-4 h-4" />
            <Body className="text-sm">주문 목록</Body>
          </button>

          {/* Header card */}
          <div className="bg-content-bg rounded-2xl border border-border-color p-5 mb-4">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-6 h-6 text-success flex-shrink-0" />
              <Heading2 className="text-primary-text">주문이 완료되었습니다</Heading2>
            </div>
            <Body className="text-secondary-text text-sm font-mono">{order.id}</Body>
            <Body className="text-secondary-text text-xs mt-1">
              {new Date(order.createdAt).toLocaleString('ko-KR')}
            </Body>
          </div>

          {/* Status Timeline */}
          <div className="bg-content-bg rounded-2xl border border-border-color p-5 mb-4">
            <Heading2 className="text-primary-text mb-5">주문 상태</Heading2>

            {isCancelled ? (
              <div className="bg-error/10 border border-error/30 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-error/20 flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-error" />
                </div>
                <Body className="text-error font-semibold">주문 취소됨</Body>
              </div>
            ) : (
              <div>
                {statusSteps.map((step, index) => {
                  const StepIcon = step.icon;
                  const isLast = index === statusSteps.length - 1;
                  return (
                    <div key={index}>
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center border-2 flex-shrink-0 ${
                              step.completed
                                ? 'bg-success border-success'
                                : step.current
                                  ? 'bg-hot-pink border-hot-pink animate-pulse'
                                  : 'bg-content-bg border-border-color'
                            }`}
                          >
                            <StepIcon
                              className={`w-5 h-5 ${
                                step.completed || step.current
                                  ? 'text-white'
                                  : 'text-secondary-text'
                              }`}
                            />
                          </div>
                          {!isLast && (
                            <div
                              className={`w-0.5 mx-auto mt-1 mb-1 h-6 ${
                                step.completed
                                  ? 'bg-success'
                                  : step.current
                                    ? 'bg-hot-pink animate-pulse'
                                    : 'bg-border-color'
                              }`}
                            />
                          )}
                        </div>
                        <div className="pt-2">
                          <Body
                            className={`text-sm font-medium ${
                              step.completed
                                ? 'text-success'
                                : step.current
                                  ? 'text-hot-pink'
                                  : 'text-secondary-text'
                            }`}
                          >
                            {step.label}
                          </Body>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment Instructions */}
          {isPendingPayment && (zelleEmail || venmoEmail) && (
            <div className="rounded-2xl border-2 border-hot-pink/30 bg-hot-pink/5 p-5 mb-4">
              <Heading2 className="text-hot-pink mb-4">결제 방법</Heading2>
              <div className="space-y-3">
                {/* Zelle */}
                {zelleEmail && (
                  <div className="bg-content-bg rounded-xl p-4 space-y-3">
                    <Body className="text-primary-text font-bold text-sm">Zelle 송금</Body>
                    <div className="flex items-center justify-between gap-2">
                      <Body className="text-secondary-text text-sm">수신자</Body>
                      <div className="flex items-center gap-2">
                        <Body className="text-primary-text font-semibold text-sm">
                          {zelleRecipientName}
                        </Body>
                        <button
                          onClick={() => copyToClipboard(zelleRecipientName)}
                          className="flex-shrink-0"
                          aria-label="수신자 복사"
                        >
                          <Copy className="w-4 h-4 text-secondary-text hover:text-hot-pink transition-colors" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Body className="text-secondary-text text-sm">Zelle 이메일</Body>
                      <div className="flex items-center gap-2">
                        <Body className="text-hot-pink font-semibold text-sm">{zelleEmail}</Body>
                        <button
                          onClick={() => copyToClipboard(zelleEmail)}
                          className="flex-shrink-0"
                          aria-label="Zelle 이메일 복사"
                        >
                          <Copy className="w-4 h-4 text-secondary-text hover:text-hot-pink transition-colors" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Venmo */}
                {venmoEmail && (
                  <div className="bg-content-bg rounded-xl p-4 space-y-3">
                    <Body className="text-primary-text font-bold text-sm">Venmo 송금</Body>
                    <div className="flex items-center justify-between gap-2">
                      <Body className="text-secondary-text text-sm">수신자</Body>
                      <div className="flex items-center gap-2">
                        <Body className="text-primary-text font-semibold text-sm">
                          {venmoRecipientName}
                        </Body>
                        <button
                          onClick={() => copyToClipboard(venmoRecipientName)}
                          className="flex-shrink-0"
                          aria-label="수신자 복사"
                        >
                          <Copy className="w-4 h-4 text-secondary-text hover:text-hot-pink transition-colors" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Body className="text-secondary-text text-sm">Venmo</Body>
                      <div className="flex items-center gap-2">
                        <Body className="text-blue-400 font-semibold text-sm">{venmoEmail}</Body>
                        <button
                          onClick={() => copyToClipboard(venmoEmail)}
                          className="flex-shrink-0"
                          aria-label="Venmo 이메일 복사"
                        >
                          <Copy className="w-4 h-4 text-secondary-text hover:text-hot-pink transition-colors" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Amount */}
                <div className="bg-content-bg rounded-xl p-4 flex items-center justify-between gap-2">
                  <Body className="text-primary-text font-semibold">송금 금액</Body>
                  <div className="flex items-center gap-2">
                    <Display className="text-hot-pink">{formatPrice(order.total)}</Display>
                    <button
                      onClick={() => copyToClipboard(String(order.total))}
                      className="flex-shrink-0"
                      aria-label="금액 복사"
                    >
                      <Copy className="w-4 h-4 text-secondary-text hover:text-hot-pink transition-colors" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-warning/10 border border-warning/20 rounded-xl p-3">
                <Body className="text-primary-text text-sm">
                  ⚠️ 주문 완료 후 위 계정으로 송금 후 스크린샷을 DM 또는 카톡 채널로 전송해주세요.
                </Body>
              </div>
            </div>
          )}

          {/* Order Items */}
          <div className="bg-content-bg rounded-2xl border border-border-color p-5 mb-4">
            <Heading2 className="text-primary-text mb-4">주문 상품</Heading2>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 py-3 border-b border-border-color last:border-0"
                >
                  <div className="w-14 h-14 rounded-lg bg-border-color/30 flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.productName}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    ) : (
                      <Package className="w-6 h-6 text-secondary-text/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <Body className="text-primary-text font-medium truncate">
                      {item.productName}
                    </Body>
                    {(item.color || item.size) && (
                      <Body className="text-secondary-text text-xs">
                        {[item.color, item.size].filter(Boolean).join(' · ')}
                      </Body>
                    )}
                    <Body className="text-secondary-text text-sm">
                      수량: {item.quantity} × {formatPrice(item.price)}
                    </Body>
                  </div>
                  <Body className="text-primary-text font-semibold flex-shrink-0">
                    {formatPrice(Number(item.price) * item.quantity)}
                  </Body>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-border-color space-y-2">
              <div className="flex justify-between gap-1">
                <Body className="text-secondary-text text-sm">소계</Body>
                <Body className="text-secondary-text text-sm">{formatPrice(order.subtotal)}</Body>
              </div>
              <div className="flex justify-between gap-1">
                <Body className="text-secondary-text text-sm">배송비</Body>
                <Body className="text-secondary-text text-sm">
                  {Number(order.shippingFee) === 0 ? '무료배송' : formatPrice(order.shippingFee)}
                </Body>
              </div>
              <div className="flex justify-between gap-1 pt-2">
                <Body className="text-primary-text font-bold">합계</Body>
                <Display className="text-hot-pink">{formatPrice(order.total)}</Display>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button variant="primary" onClick={() => router.push('/')}>
              쇼핑 계속하기
            </Button>
            {order.status === OrderStatus.PAYMENT_CONFIRMED && (
              <Button variant="outline" disabled={reordering} onClick={handleReorder}>
                <ShoppingBag className="w-4 h-4 mr-2" />
                {reordering ? '담는 중...' : '다시 주문하기'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <BottomTabBar />
    </>
  );
}
