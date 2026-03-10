'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getOrderById, cancelOrder } from '@/lib/api/orders';
import { Order, OrderStatus } from '@/lib/types/order';
import { apiClient } from '@/lib/api/client';
import { CheckCircle, Clock, Package, Truck, Home } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useToast } from '@/components/common/Toast';

export default function OrderConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const { showToast } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zelleEmail, setZelleEmail] = useState('');
  const [zelleRecipientName, setZelleRecipientName] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  useEffect(() => {
    apiClient
      .get<{ zelleEmail: string; zelleRecipientName: string }>('/config/payment')
      .then((res) => {
        setZelleEmail(res.data.zelleEmail || '');
        setZelleRecipientName(res.data.zelleRecipientName || '');
      })
      .catch(() => {});
  }, []);

  const fetchOrder = async () => {
    try {
      setIsLoading(true);
      const data = await getOrderById(orderId);
      setOrder(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load order');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!window.confirm('주문을 취소하시겠습니까?')) return;
    setIsCancelling(true);
    try {
      await cancelOrder(orderId);
      showToast('주문이 취소되었습니다', 'success');
      await fetchOrder();
    } catch (err: any) {
      showToast(err.message || '주문 취소에 실패했습니다', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getStatusSteps = () => {
    const steps = [
      { label: '주문 완료', icon: CheckCircle, status: 'ORDER_CREATED' },
      { label: '입금 대기', icon: Clock, status: 'PENDING_PAYMENT' },
      { label: '결제 확인', icon: CheckCircle, status: 'PAYMENT_CONFIRMED' },
      { label: '배송중', icon: Truck, status: 'SHIPPED' },
      { label: '배송 완료', icon: Home, status: 'DELIVERED' },
    ];

    const statusOrder: OrderStatus[] = [
      OrderStatus.PENDING_PAYMENT,
      OrderStatus.PAYMENT_CONFIRMED,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];

    const currentIndex = statusOrder.indexOf(order!.status);

    return steps.map((step, index) => {
      if (index === 0) return { ...step, completed: true, current: false };
      if (index === 1)
        return { ...step, completed: currentIndex >= 0, current: currentIndex === 0 };
      if (index === 2)
        return { ...step, completed: currentIndex >= 1, current: currentIndex === 1 };
      if (index === 3)
        return { ...step, completed: currentIndex >= 2, current: currentIndex === 2 };
      if (index === 4)
        return { ...step, completed: currentIndex >= 3, current: currentIndex === 3 };
      return { ...step, completed: false, current: false };
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-primary-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-info"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-primary-black flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-content-bg rounded-lg shadow-lg p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-primary-text mb-2">주문을 찾을 수 없습니다</h1>
            <p className="text-secondary-text mb-6">{error || '주문 정보를 불러올 수 없습니다'}</p>
            <button
              onClick={() => router.push('/orders')}
              className="px-6 py-2 bg-info text-white rounded-lg hover:bg-info/80"
            >
              주문 목록 보기
            </button>
          </div>
        </div>
      </div>
    );
  }

  const statusSteps = getStatusSteps();

  return (
    <div className="min-h-screen bg-primary-black py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Success Message */}
        <div className="bg-success-bg border border-success/20 rounded-lg p-6 mb-6">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-success mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-primary-text">주문이 완료되었습니다!</h1>
              <p className="text-success mt-1">
                주문번호: {order.id} • {new Date(order.createdAt).toLocaleString('ko-KR')}
              </p>
            </div>
          </div>
        </div>

        {/* Status Timeline */}
        <div className="bg-content-bg rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-primary-text mb-6">주문 상태</h2>
          <div className="relative">
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-border-color"></div>
            <div className="relative flex flex-nowrap overflow-x-auto gap-2">
              {statusSteps.map((step, index) => (
                <div key={index} className="flex flex-col items-center min-w-0 flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                      step.completed
                        ? 'bg-success border-success'
                        : step.current
                          ? 'bg-hot-pink border-hot-pink animate-pulse'
                          : 'bg-content-bg border-border-color'
                    }`}
                  >
                    <step.icon
                      className={`w-5 h-5 ${
                        step.completed || step.current ? 'text-white' : 'text-secondary-text'
                      }`}
                    />
                  </div>
                  <p
                    className={`text-xs mt-2 text-center break-words ${
                      step.completed || step.current
                        ? 'text-primary-text font-medium'
                        : 'text-secondary-text'
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Zelle Payment Instructions */}
        {order.status === OrderStatus.PENDING_PAYMENT && zelleEmail && (
          <div className="bg-hot-pink/10 rounded-lg shadow-md p-6 mb-6 border-2 border-hot-pink/30">
            <h2 className="text-xl font-semibold text-hot-pink mb-4">💳 결제 방법 — Zelle</h2>
            <div className="bg-content-bg rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap justify-between items-center gap-1">
                <span className="text-secondary-text">수신자</span>
                <span className="font-semibold text-primary-text">{zelleRecipientName}</span>
              </div>
              <div className="flex flex-wrap justify-between items-center gap-1">
                <span className="text-secondary-text">Zelle 이메일</span>
                <span className="font-semibold text-hot-pink">{zelleEmail}</span>
              </div>
              <div className="flex flex-wrap justify-between items-center gap-1 pt-3 border-t border-border-color">
                <span className="text-primary-text font-semibold">송금 금액</span>
                <span className="text-2xl font-bold text-hot-pink">{formatPrice(order.total)}</span>
              </div>
            </div>
            <div className="mt-4 bg-warning-bg border border-warning/20 rounded-lg p-3">
              <p className="text-sm text-primary-text">
                ⚠️ 주문 완료 후 위 Zelle 계정으로 송금 후 스크린샷을 DM 또는 카톡 채널로
                전송해주세요.
              </p>
            </div>
          </div>
        )}

        {/* Order Items */}
        <div className="bg-content-bg rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-primary-text mb-4">주문 상품</h2>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center py-3 border-b border-border-color last:border-0"
              >
                <div className="flex-1">
                  <p className="font-medium text-primary-text">{item.productName}</p>
                  <p className="text-sm text-secondary-text">
                    수량: {item.quantity} × {formatPrice(item.price)}
                  </p>
                </div>
                <p className="font-semibold text-primary-text">
                  {formatPrice(item.price * item.quantity)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border-color space-y-2">
            <div className="flex flex-wrap justify-between gap-1 text-secondary-text">
              <span>소계</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-1 text-secondary-text">
              <span>배송비</span>
              <span>{formatPrice(order.shippingFee)}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-1 text-xl font-bold text-primary-text pt-2">
              <span>합계</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <Button variant="secondary" onClick={() => router.push('/orders')}>
            내 주문 보기
          </Button>
          <Button variant="primary" onClick={() => router.push('/')}>
            쇼핑 계속하기
          </Button>
          {order.status === OrderStatus.PENDING_PAYMENT && (
            <button
              onClick={handleCancelOrder}
              disabled={isCancelling}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              {isCancelling ? '취소 중...' : '주문 취소'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
