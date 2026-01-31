'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Display, Heading2, Body } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { apiClient } from '@/lib/api/client';
import { ArrowLeft, Package, Truck, CheckCircle, Clock, Copy } from 'lucide-react';

interface OrderDetail {
  id: string;
  userId: string;
  userEmail: string;
  depositorName: string;
  instagramId: string;
  status: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  paymentStatus: string;
  shippingStatus: string;
  createdAt: string;
  updatedAt: string;
  items: {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    shippingFee: number;
  }[];
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await apiClient.get<OrderDetail>(`/orders/${orderId}`);
        setOrder(response.data);
      } catch (err: any) {
        console.error('Failed to fetch order:', err);
        setError('주문 정보를 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Body className="text-secondary-text">주문 정보를 불러오는 중...</Body>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-white py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <Display className="text-error mb-4">오류</Display>
          <Body className="text-secondary-text mb-6">
            {error || '주문 정보를 찾을 수 없습니다.'}
          </Body>
          <Button variant="primary" onClick={() => router.push('/orders')}>
            주문 내역으로 이동
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-6 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-secondary-text hover:text-primary-text transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <Body>돌아가기</Body>
        </button>

        {/* Header */}
        <div className="mb-6">
          <Display className="text-hot-pink mb-2">주문 상세</Display>
          <Body className="text-secondary-text text-sm font-mono">
            주문번호: {order.id}
          </Body>
        </div>

        {/* Order Status */}
        <div className="bg-content-bg rounded-2xl p-6 border border-white/5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <Heading2 className="text-primary-text">주문 상태</Heading2>
            {order.paymentStatus === 'PENDING' && (
              <div className="bg-yellow-500/20 text-yellow-500 px-4 py-2 rounded-full flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <Body className="font-semibold">입금 대기</Body>
              </div>
            )}
            {order.paymentStatus === 'PAID' && (
              <div className="bg-success/20 text-success px-4 py-2 rounded-full flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <Body className="font-semibold">결제 완료</Body>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Body className="text-secondary-text">주문일시</Body>
              <Body className="text-primary-text">{formatDate(order.createdAt)}</Body>
            </div>
            {order.shippingStatus && (
              <div className="flex justify-between items-center">
                <Body className="text-secondary-text">배송 상태</Body>
                <div className="flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-hot-pink" />
                  <Body className="text-primary-text">{order.shippingStatus}</Body>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment Info (if pending) */}
        {order.paymentStatus === 'PENDING' && (
          <div className="bg-gradient-to-br from-hot-pink/20 to-error/10 border-2 border-hot-pink/50 rounded-2xl p-6 mb-6">
            <Heading2 className="text-hot-pink mb-4">입금 정보</Heading2>

            <div className="space-y-3">
              <div className="bg-white/80 rounded-xl p-4">
                <Body className="text-secondary-text text-sm mb-1">은행</Body>
                <Heading2 className="text-primary-text">국민은행</Heading2>
              </div>

              <div className="bg-white/80 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <Body className="text-secondary-text text-sm">계좌번호</Body>
                  <button
                    onClick={() => copyToClipboard('123-456-789012')}
                    className="flex items-center gap-1 text-hot-pink hover:text-hot-pink/80 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    <Body className="text-xs">{copied ? '복사됨!' : '복사'}</Body>
                  </button>
                </div>
                <Heading2 className="text-primary-text font-mono">123-456-789012</Heading2>
              </div>

              <div className="bg-white/80 rounded-xl p-4">
                <Body className="text-secondary-text text-sm mb-1">예금주</Body>
                <Heading2 className="text-primary-text">라이브커머스(주)</Heading2>
              </div>

              <div className="bg-white/80 rounded-xl p-4">
                <Body className="text-secondary-text text-sm mb-1">입금 금액</Body>
                <Display className="text-hot-pink">{formatPrice(order.total)}</Display>
              </div>
            </div>
          </div>
        )}

        {/* Order Items */}
        <div className="bg-content-bg rounded-2xl p-6 border border-white/5 mb-6">
          <Heading2 className="text-hot-pink mb-4">주문 상품</Heading2>
          <div className="space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between items-start">
                <div className="flex-1">
                  <Body className="text-primary-text font-semibold mb-1">
                    {item.productName}
                  </Body>
                  <Body className="text-secondary-text text-sm">
                    {formatPrice(item.price)} × {item.quantity}개
                  </Body>
                </div>
                <Body className="text-primary-text font-bold">
                  {formatPrice(item.price * item.quantity)}
                </Body>
              </div>
            ))}

            <div className="h-px bg-white/10 my-4" />

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Body className="text-secondary-text">상품 금액</Body>
                <Body className="text-primary-text">{formatPrice(order.subtotal)}</Body>
              </div>
              <div className="flex justify-between items-center">
                <Body className="text-secondary-text">배송비</Body>
                <Body className="text-primary-text">
                  {order.shippingFee > 0 ? formatPrice(order.shippingFee) : '무료'}
                </Body>
              </div>
              <div className="h-px bg-white/10 my-3" />
              <div className="flex justify-between items-center">
                <Heading2 className="text-primary-text">총 결제 금액</Heading2>
                <Display className="text-hot-pink">{formatPrice(order.total)}</Display>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="bg-content-bg rounded-2xl p-6 border border-white/5 mb-6">
          <Heading2 className="text-hot-pink mb-4">주문자 정보</Heading2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Body className="text-secondary-text">이름</Body>
              <Body className="text-primary-text">{order.depositorName || '-'}</Body>
            </div>
            <div className="flex justify-between items-center">
              <Body className="text-secondary-text">이메일</Body>
              <Body className="text-primary-text">{order.userEmail}</Body>
            </div>
            {order.instagramId && (
              <div className="flex justify-between items-center">
                <Body className="text-secondary-text">인스타그램</Body>
                <Body className="text-primary-text">@{order.instagramId}</Body>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => router.push('/orders')}
          >
            주문 내역으로 이동
          </Button>
          <Button
            variant="outline"
            size="lg"
            fullWidth
            onClick={() => router.push('/')}
          >
            홈으로 이동
          </Button>
        </div>
      </div>
    </div>
  );
}
