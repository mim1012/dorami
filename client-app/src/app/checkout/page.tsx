'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useCart, cartKeys } from '@/lib/hooks/queries/use-cart';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePointBalance } from '@/lib/hooks/queries/use-points';
import { Display, Heading2, Body, Caption } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { apiClient } from '@/lib/api/client';
import { AlertCircle, CheckCircle, Coins, DollarSign, MapPin } from 'lucide-react';

interface PointsConfig {
  pointsEnabled: boolean;
  pointEarningRate: number;
  pointMinRedemption: number;
  pointMaxRedemptionPct: number;
}

export default function CheckoutPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: cartData } = useCart();
  const queryClient = useQueryClient();
  const items = cartData?.items ?? [];
  const { user } = useAuth();
  const { data: balance } = usePointBalance();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pointsConfig, setPointsConfig] = useState<PointsConfig | null>(null);
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [orderCompleted, setOrderCompleted] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [zelleEmail, setZelleEmail] = useState('');
  const [zelleRecipientName, setZelleRecipientName] = useState('');

  useEffect(() => {
    // cartData 로딩 중엔 리다이렉트 방지, 로드 후 빈 경우만 /cart로 이동
    if (cartData && items.length === 0 && !orderCompleted) {
      router.push('/cart');
    }
  }, [cartData, items, router, orderCompleted]);

  // Load points config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await apiClient.get<PointsConfig>('/admin/config/points');
        setPointsConfig(response.data);
      } catch {
        // Points config unavailable, silently ignore
      }
    };
    loadConfig();
  }, []);

  // Load Zelle settings
  useEffect(() => {
    const loadZelleSettings = async () => {
      try {
        const response = await apiClient.get<{ zelleEmail: string; zelleRecipientName: string }>(
          '/config/payment',
        );
        setZelleEmail(response.data.zelleEmail || '');
        setZelleRecipientName(response.data.zelleRecipientName || '');
      } catch {
        // silently ignore
      }
    };
    loadZelleSettings();
  }, []);

  const orderSubtotal = cartData?.subtotal ?? 0;
  const shippingFee = cartData?.totalShippingFee ?? 0;
  const orderTotal = orderSubtotal + shippingFee;

  const maxPointsAllowed = pointsConfig
    ? Math.floor(orderTotal * (pointsConfig.pointMaxRedemptionPct / 100))
    : 0;

  const maxUsablePoints = Math.min(balance?.currentBalance || 0, maxPointsAllowed);

  const canUsePoints =
    pointsConfig?.pointsEnabled &&
    balance &&
    balance.currentBalance >= (pointsConfig?.pointMinRedemption || 0) &&
    maxUsablePoints > 0;

  const effectivePointsUsed = usePoints ? pointsToUse : 0;
  const finalTotal = orderTotal - effectivePointsUsed;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const handleUseAllPoints = () => {
    setPointsToUse(maxUsablePoints);
  };

  const handlePointsInputChange = (value: string) => {
    const num = parseInt(value) || 0;
    setPointsToUse(Math.min(Math.max(0, num), maxUsablePoints));
  };

  const handleSubmitOrder = async () => {
    if (!user) {
      const safePath = pathname.startsWith('/') ? pathname : '/';
      router.push(`/login?reason=session_expired&returnTo=${encodeURIComponent(safePath)}`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const body: { pointsToUse?: number } = {};
      if (usePoints && pointsToUse > 0) {
        body.pointsToUse = pointsToUse;
      }

      const response = await apiClient.post<{ id: string }>('/orders/from-cart', body);

      setOrderCompleted(true);
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
      router.push(`/orders/${response.data.id}`);
    } catch (err: any) {
      console.error('Order creation failed:', err);
      setError(
        err.response?.data?.message || '주문 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!cartData || items.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-primary-black py-12 px-4 pb-24">
      <div className="w-full md:max-w-3xl md:mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Display className="text-hot-pink mb-2">주문하기</Display>
          <Body className="text-secondary-text">주문 정보를 확인하고 결제를 진행해주세요</Body>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-error/10 border border-error rounded-2xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
            <Body className="text-error flex-1 min-w-0 break-words">{error}</Body>
          </div>
        )}

        {/* Order Summary */}
        <div className="bg-content-bg rounded-2xl p-6 border border-border-color mb-6">
          <Heading2 className="text-hot-pink mb-4">주문 상품</Heading2>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between items-center">
                <div className="flex-1 min-w-0">
                  <Body className="text-primary-text truncate">{item.productName}</Body>
                  <Body className="text-secondary-text text-sm">
                    {formatPrice(item.price)} x {item.quantity}개
                  </Body>
                </div>
                <Body className="text-primary-text font-bold">{formatPrice(item.subtotal)}</Body>
              </div>
            ))}
          </div>

          <div className="h-px bg-border-color my-4" />

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Body className="text-secondary-text">상품 금액</Body>
              <Body className="text-primary-text">{formatPrice(orderSubtotal)}</Body>
            </div>
            <div className="flex justify-between items-center">
              <Body className="text-secondary-text">배송비</Body>
              <Body className="text-primary-text">
                {shippingFee === 0 ? '무료' : formatPrice(shippingFee)}
              </Body>
            </div>
            {effectivePointsUsed > 0 && (
              <div className="flex justify-between items-center">
                <Body className="text-secondary-text">포인트 할인</Body>
                <Body className="text-success">-{formatPrice(effectivePointsUsed)}</Body>
              </div>
            )}
            <div className="h-px bg-border-color my-3" />
            <div className="flex justify-between items-center">
              <Heading2 className="text-primary-text">총 결제 금액</Heading2>
              <Display className="text-hot-pink">{formatPrice(finalTotal)}</Display>
            </div>
          </div>
        </div>

        {/* Points Usage Section */}
        {canUsePoints && (
          <div className="bg-content-bg rounded-2xl p-6 border border-border-color mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Coins className="w-5 h-5 text-hot-pink" />
              <Heading2 className="text-hot-pink">포인트 사용</Heading2>
            </div>

            <div className="flex items-center justify-between mb-3">
              <Body className="text-secondary-text">
                보유 포인트:{' '}
                <span className="text-hot-pink font-bold">
                  {new Intl.NumberFormat('ko-KR').format(balance!.currentBalance)} P
                </span>
              </Body>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usePoints}
                  onChange={(e) => {
                    setUsePoints(e.target.checked);
                    if (!e.target.checked) setPointsToUse(0);
                  }}
                  className="w-5 h-5 rounded border-2 border-hot-pink bg-transparent checked:bg-hot-pink focus:ring-hot-pink"
                />
                <Body className="text-primary-text text-sm">포인트 사용</Body>
              </label>
            </div>

            {usePoints && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="number"
                      value={pointsToUse || ''}
                      onChange={(e) => handlePointsInputChange(e.target.value)}
                      placeholder="사용할 포인트 입력"
                      min={0}
                      max={maxUsablePoints}
                      className="w-full px-4 py-3 bg-primary-black border border-border-color rounded-xl text-primary-text placeholder:text-secondary-text focus:border-hot-pink focus:outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary-text text-sm">
                      P
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleUseAllPoints}>
                    전액 사용
                  </Button>
                </div>
                <Caption className="text-secondary-text">
                  최소 {new Intl.NumberFormat('ko-KR').format(pointsConfig!.pointMinRedemption)}P
                  이상 사용 가능 / 최대 주문금액의 {pointsConfig!.pointMaxRedemptionPct}% (
                  {new Intl.NumberFormat('ko-KR').format(maxUsablePoints)}P)
                </Caption>
              </div>
            )}
          </div>
        )}

        {/* Shipping Address */}
        {user?.shippingAddress && (
          <div className="bg-content-bg rounded-2xl p-6 border border-border-color mb-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-hot-pink" />
              <Heading2 className="text-hot-pink">배송지</Heading2>
            </div>
            <div className="space-y-1">
              {(() => {
                const addr = user.shippingAddress as Record<string, string>;
                if (typeof addr !== 'object' || !addr.fullName) return null;
                return (
                  <>
                    {addr.fullName && (
                      <Body className="text-primary-text font-semibold">{addr.fullName}</Body>
                    )}
                    <Body className="text-secondary-text text-sm">
                      {[addr.address1, addr.address2].filter(Boolean).join(', ')}
                    </Body>
                    <Body className="text-secondary-text text-sm">
                      {[addr.city, addr.state, addr.zip].filter(Boolean).join(', ')}
                    </Body>
                    {addr.phone && (
                      <Body className="text-secondary-text text-sm">{addr.phone}</Body>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Payment Method - Zelle */}
        <div className="bg-content-bg rounded-2xl p-6 border border-border-color mb-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-hot-pink" />
            <Heading2 className="text-hot-pink">결제 방법 — Zelle</Heading2>
          </div>
          <div className="bg-hot-pink/10 rounded-xl p-4 border border-hot-pink/30 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-hot-pink flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <Heading2 className="text-primary-text">Zelle 송금</Heading2>
            </div>
            {zelleEmail && (
              <div className="space-y-1 pl-9">
                <Body className="text-secondary-text text-sm">
                  수신인:{' '}
                  <span className="text-primary-text font-semibold">{zelleRecipientName}</span>
                </Body>
                <Body className="text-secondary-text text-sm">
                  Zelle 이메일: <span className="text-hot-pink font-semibold">{zelleEmail}</span>
                </Body>
              </div>
            )}
            <Body className="text-secondary-text text-sm leading-relaxed pl-9">
              주문 완료 후 위 Zelle 계정으로 송금 후 스크린샷을 DM 또는 카톡 채널로 전송해주세요.
            </Body>
          </div>
        </div>

        {/* Terms Agreement */}
        <div className="bg-content-bg rounded-2xl p-6 border border-border-color mb-6">
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-2 border-hot-pink bg-transparent checked:bg-hot-pink focus:ring-hot-pink focus:ring-2"
              />
              <Body className="text-primary-text text-sm flex-1">
                주문 내용을 확인했으며, 결제에 동의합니다.
              </Body>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={privacyAgreed}
                onChange={(e) => setPrivacyAgreed(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-2 border-hot-pink bg-transparent checked:bg-hot-pink focus:ring-hot-pink focus:ring-2"
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
            disabled={isSubmitting || !termsAgreed || !privacyAgreed}
          >
            {isSubmitting ? '주문 처리 중...' : `${formatPrice(finalTotal)} 주문하기`}
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
