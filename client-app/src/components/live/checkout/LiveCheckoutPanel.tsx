'use client';

import { useEffect } from 'react';
import { AlertCircle, ChevronLeft, Coins, MapPin, DollarSign } from 'lucide-react';
import { formatPrice } from '@/lib/utils/price';
import type { CheckoutFlowState } from '@/lib/hooks/use-checkout-flow';
import type { User } from '@/lib/types/user';
import type { ShippingAddress } from '@live-commerce/shared-types';

function isShippingAddress(addr: unknown): addr is ShippingAddress {
  return typeof addr === 'object' && addr !== null && 'fullName' in addr;
}

interface LiveCheckoutPanelProps {
  checkoutFlow: CheckoutFlowState;
  user: User | null;
  cartItemCount: number;
  onBack: () => void;
  onSuccess: (orderId: string, total: string) => void;
}

export default function LiveCheckoutPanel({
  checkoutFlow,
  user,
  cartItemCount,
  onBack,
  onSuccess,
}: LiveCheckoutPanelProps) {
  const {
    paymentSettings,
    usePoints,
    pointsToUse,
    maxUsablePoints,
    canUsePoints,
    effectivePointsUsed,
    finalTotal,
    shippingFee,
    termsAgreed,
    privacyAgreed,
    isSubmitting,
    error,
    isSuccess,
    orderId,
    pointBalance,
    pointsConfig,
    setUsePoints,
    handlePointsInputChange,
    handleUseAllPoints,
    setTermsAgreed,
    setPrivacyAgreed,
    submitOrder,
  } = checkoutFlow;

  // Notify parent on success
  useEffect(() => {
    if (isSuccess && orderId) {
      onSuccess(orderId, formatPrice(finalTotal));
    }
  }, [isSuccess, orderId, finalTotal, onSuccess]);

  const canSubmit = termsAgreed && privacyAgreed && !isSubmitting;

  const addr = isShippingAddress(user?.shippingAddress) ? user.shippingAddress : null;
  const hasAddress = !!addr;

  return (
    <div className="flex flex-col max-h-[75dvh]">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-3 flex-shrink-0">
        <button
          onClick={onBack}
          className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white active:scale-90 transition-all"
          aria-label="뒤로"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-white font-bold text-base">주문하기</h2>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 space-y-4 pb-4">
        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-xs leading-relaxed">{error}</p>
          </div>
        )}

        {/* Order summary */}
        <div className="bg-white/5 rounded-2xl p-4 space-y-2">
          <p className="text-white/60 text-xs uppercase tracking-wide">주문 요약</p>
          <div className="flex justify-between text-sm">
            <span className="text-white/60">상품 ({cartItemCount}개)</span>
            <span className="text-white font-semibold">
              {formatPrice(checkoutFlow.orderSubtotal)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/60">배송비</span>
            <span className="text-white">
              {shippingFee === 0 ? '무료' : formatPrice(shippingFee)}
            </span>
          </div>
          {effectivePointsUsed > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-white/60">포인트 할인</span>
              <span className="text-green-400">-{formatPrice(effectivePointsUsed)}</span>
            </div>
          )}
          <div className="h-px bg-white/10" />
          <div className="flex justify-between">
            <span className="text-white font-bold text-sm">총 결제금액</span>
            <span className="text-hot-pink font-bold text-base">{formatPrice(finalTotal)}</span>
          </div>
        </div>

        {/* Shipping address */}
        {hasAddress && (
          <div className="bg-white/5 rounded-2xl p-4 space-y-1">
            <div className="flex items-center gap-1.5 mb-2">
              <MapPin className="w-3.5 h-3.5 text-hot-pink" />
              <p className="text-white/60 text-xs uppercase tracking-wide">배송지</p>
            </div>
            <p className="text-white text-sm font-semibold">{addr.fullName}</p>
            <p className="text-white/50 text-xs">
              {[addr.address1, addr.address2].filter(Boolean).join(', ')}
            </p>
            <p className="text-white/50 text-xs">
              {[addr.city, addr.state, addr.zip].filter(Boolean).join(', ')}
            </p>
          </div>
        )}

        {/* Payment method */}
        {(paymentSettings.zelleEmail || paymentSettings.venmoEmail) && (
          <div className="bg-white/5 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-1.5 mb-2">
              <DollarSign className="w-3.5 h-3.5 text-hot-pink" />
              <p className="text-white/60 text-xs uppercase tracking-wide">결제 방법</p>
            </div>
            {paymentSettings.zelleEmail && (
              <div className="bg-hot-pink/10 rounded-xl p-3 border border-hot-pink/20">
                <p className="text-white text-xs font-semibold">Zelle</p>
                <p className="text-white/60 text-xs">{paymentSettings.zelleRecipientName}</p>
                <p className="text-hot-pink text-xs font-mono">{paymentSettings.zelleEmail}</p>
              </div>
            )}
            {paymentSettings.venmoEmail && (
              <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20">
                <p className="text-white text-xs font-semibold">Venmo</p>
                <p className="text-white/60 text-xs">{paymentSettings.venmoRecipientName}</p>
                <p className="text-blue-400 text-xs font-mono">{paymentSettings.venmoEmail}</p>
              </div>
            )}
          </div>
        )}

        {/* Points section */}
        {canUsePoints && (
          <div className="bg-white/5 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-hot-pink" />
                <p className="text-white/60 text-xs uppercase tracking-wide">포인트</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-white/60 text-xs">
                  보유 {new Intl.NumberFormat('ko-KR').format(pointBalance)}P
                </span>
                <input
                  type="checkbox"
                  checked={usePoints}
                  onChange={(e) => setUsePoints(e.target.checked)}
                  className="w-4 h-4 rounded border-2 border-hot-pink bg-transparent checked:bg-hot-pink focus:ring-hot-pink"
                />
              </label>
            </div>
            {usePoints && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={pointsToUse || ''}
                    onChange={(e) => handlePointsInputChange(e.target.value)}
                    placeholder="사용할 포인트"
                    min={0}
                    max={maxUsablePoints}
                    className="flex-1 px-3 py-2 bg-black/30 border border-white/20 rounded-xl text-white text-sm placeholder:text-white/30 focus:border-hot-pink focus:outline-none"
                  />
                  <button
                    onClick={handleUseAllPoints}
                    className="px-3 py-2 text-xs text-hot-pink border border-hot-pink/40 rounded-xl active:scale-95 transition-transform"
                  >
                    전액
                  </button>
                </div>
                {pointsConfig && (
                  <p className="text-white/30 text-[10px]">
                    최대 {new Intl.NumberFormat('ko-KR').format(maxUsablePoints)}P (주문금액의{' '}
                    {pointsConfig.pointMaxRedemptionPct}%)
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Terms checkboxes */}
        <div className="bg-white/5 rounded-2xl p-4 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAgreed}
              onChange={(e) => setTermsAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-2 border-hot-pink bg-transparent checked:bg-hot-pink focus:ring-hot-pink"
            />
            <span className="text-white/70 text-xs leading-relaxed">
              주문 내용을 확인했으며, 결제에 동의합니다.
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={privacyAgreed}
              onChange={(e) => setPrivacyAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-2 border-hot-pink bg-transparent checked:bg-hot-pink focus:ring-hot-pink"
            />
            <span className="text-white/70 text-xs leading-relaxed">
              개인정보 수집 및 이용에 동의합니다.
            </span>
          </label>
        </div>
      </div>

      {/* Footer buttons */}
      <div className="px-5 pt-3 pb-5 flex-shrink-0 border-t border-white/10 space-y-2">
        <button
          onClick={submitOrder}
          disabled={!canSubmit}
          className="w-full py-3.5 bg-hot-pink text-white font-bold rounded-2xl text-sm active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSubmitting ? '주문 처리 중...' : `${formatPrice(finalTotal)} 주문하기`}
        </button>
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="w-full py-2.5 text-white/50 text-sm hover:text-white/80 transition-colors disabled:opacity-40"
        >
          뒤로
        </button>
      </div>
    </div>
  );
}
