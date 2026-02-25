'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Display, Heading2, Body } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { apiClient } from '@/lib/api/client';
import { useKakaoShare } from '@/hooks/useKakaoShare';
import { CheckCircle, Copy, MessageCircle, Package } from 'lucide-react';

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

function OrderCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [bankInfo] = useState({
    bank: 'Zelle',
    accountNumber: '422sss@live.com',
    accountHolder: 'MIN KIM',
  });

  const { isInitialized, shareOrder } = useKakaoShare();

  useEffect(() => {
    if (!orderId) {
      router.push('/');
      return;
    }

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
  }, [orderId, router]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKakaoShare = () => {
    if (!order) return;

    const deadlineDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    shareOrder({
      orderId: order.id,
      orderNumber: order.id,
      totalAmount: order.total,
      depositorName: order.depositorName || '주문자',
      bankName: bankInfo.bank,
      accountNumber: bankInfo.accountNumber,
      accountHolder: bankInfo.accountHolder,
      deadlineDate,
      items: order.items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
      })),
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-primary-black flex items-center justify-center">
        <Body className="text-secondary-text">주문 정보를 불러오는 중...</Body>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-primary-black flex items-center justify-center px-4">
        <div className="text-center">
          <Display className="text-error mb-4">오류</Display>
          <Body className="text-secondary-text mb-6">
            {error || '주문 정보를 찾을 수 없습니다.'}
          </Body>
          <Button variant="primary" onClick={() => router.push('/')}>
            홈으로 이동
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-black py-12 px-4 pb-24">
      <div className="w-full md:max-w-3xl md:mx-auto">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-content-bg rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-hot-pink" />
          </div>
          <Display className="text-hot-pink mb-2">주문이 완료되었습니다!</Display>
          <Body className="text-secondary-text">입금 확인 후 배송이 시작됩니다.</Body>
        </div>

        {/* Order Number */}
        <div className="bg-content-bg rounded-2xl p-6 border border-border-color mb-6 text-center">
          <Body className="text-secondary-text text-sm mb-2">주문번호</Body>
          <Heading2 className="text-primary-text font-mono">{order.id}</Heading2>
        </div>

        {/* Payment Info */}
        <div className="bg-content-bg border border-border-color rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-hot-pink" />
            <Heading2 className="text-hot-pink">결제 안내</Heading2>
          </div>

          <div className="space-y-4">
            <div className="bg-content-bg rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <Body className="text-secondary-text text-sm">Zelle</Body>
                <button
                  onClick={() => copyToClipboard('422sss@live.com')}
                  className="flex items-center gap-1 text-hot-pink hover:text-hot-pink/80 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  <Body className="text-xs">{copied ? '복사됨!' : '복사'}</Body>
                </button>
              </div>
              <Heading2 className="text-primary-text font-mono">422sss@live.com</Heading2>
            </div>

            <div className="bg-content-bg rounded-xl p-4">
              <Body className="text-secondary-text text-sm mb-1">Name</Body>
              <Heading2 className="text-primary-text">MIN KIM</Heading2>
            </div>

            <div className="bg-content-bg rounded-xl p-4">
              <Body className="text-secondary-text text-sm mb-1">입금 금액</Body>
              <Display className="text-hot-pink">{formatPrice(order.total)}</Display>
            </div>

            <div className="bg-content-bg rounded-xl p-4">
              <Body className="text-secondary-text text-sm mb-1">입금자명</Body>
              <Heading2 className="text-primary-text">{order.depositorName || '주문자명'}</Heading2>
            </div>
          </div>

          <div className="mt-4 p-4 bg-warning-bg/60 rounded-xl border border-warning/20 space-y-1">
            <Body className="text-primary-text text-sm">▶ Zelle: 422sss@live.com</Body>
            <Body className="text-primary-text text-sm">▶ Name: MIN KIM</Body>
            <Body className="text-primary-text text-sm font-medium">
              ▶ 입금 후 스크린샷 DM 또는 카톡 채널 전송 필수{' '}
              <span className="text-warning">(미확인 시 누락)</span>
            </Body>
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-content-bg rounded-2xl p-6 border border-border-color mb-6">
          <Heading2 className="text-hot-pink mb-4">주문 상품</Heading2>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between items-center">
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
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" size="lg" fullWidth onClick={() => router.push('/')}>
              홈으로 이동
            </Button>
            <Button variant="primary" size="lg" fullWidth onClick={() => router.push('/my-page')}>
              주문 내역 확인
            </Button>
          </div>

          {/* KakaoTalk Share Button */}
          <button
            className="w-full bg-[#FEE500] text-[#000000] hover:bg-[#FEE500]/90 font-bold py-4 rounded-xl text-body transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleKakaoShare}
            disabled={!isInitialized}
          >
            <MessageCircle className="w-5 h-5" />
            {isInitialized ? '카카오톡으로 입금 정보 받기' : '카카오톡 로딩 중...'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrderCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-primary-black flex items-center justify-center">
          <Body>Loading...</Body>
        </div>
      }
    >
      <OrderCompleteContent />
    </Suspense>
  );
}
