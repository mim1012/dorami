'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useCart } from '@/lib/hooks/queries/use-cart';
import { useModalBehavior } from '@/lib/hooks/use-modal-behavior';
import { useCheckoutFlow } from '@/lib/hooks/use-checkout-flow';
import { useAuth } from '@/lib/hooks/use-auth';
import { apiClient } from '@/lib/api/client';
import type { ShippingAddress } from '@live-commerce/shared-types';
import LiveCartPanel from '@/components/live/checkout/LiveCartPanel';
import LiveCheckoutPanel from '@/components/live/checkout/LiveCheckoutPanel';
import LiveOrderSuccessPanel from '@/components/live/checkout/LiveOrderSuccessPanel';

type CheckoutStep = 'cart' | 'checkout' | 'success';

interface LiveCartSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LiveCartSheet({ isOpen, onClose }: LiveCartSheetProps) {
  const router = useRouter();
  const { data: cartData } = useCart();
  const { user, isAuthenticated, refreshProfile } = useAuth();

  const [step, setStep] = useState<CheckoutStep>('cart');
  const [toast, setToast] = useState<string | null>(null);
  const [successOrderId, setSuccessOrderId] = useState('');
  const [successTotal, setSuccessTotal] = useState('');

  const checkoutFlow = useCheckoutFlow({ cartData });

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    [],
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const handleClose = useCallback(() => {
    setStep('cart');
    onClose();
  }, [onClose]);

  useModalBehavior({ isOpen, onClose: handleClose });

  const handleProceedToCheckout = useCallback(async () => {
    if (!isAuthenticated || !user) {
      showToast('로그인이 필요합니다');
      return;
    }
    // Fetch full profile (includes decrypted shippingAddress, unlike /users/me)
    try {
      const res = await apiClient.get<{ shippingAddress?: unknown }>('/users/profile/me');
      const addr = res.data?.shippingAddress as ShippingAddress | null | undefined;
      if (!addr || !('fullName' in addr) || !addr.fullName) {
        showToast('배송지를 먼저 등록해주세요');
        return;
      }
    } catch {
      showToast('사용자 정보를 확인할 수 없습니다');
      return;
    }
    setStep('checkout');
  }, [isAuthenticated, user, showToast]);

  const handleCheckoutSuccess = useCallback((orderId: string, total: string) => {
    setSuccessOrderId(orderId);
    setSuccessTotal(total);
    setStep('success');
  }, []);

  const handleViewOrder = useCallback(
    (orderId: string) => {
      handleClose();
      router.push(`/orders/${orderId}`);
    },
    [handleClose, router],
  );

  const cartItemCount = cartData?.items?.filter((i) => i.status === 'ACTIVE').length ?? 0;

  // Step-specific max height
  const maxH = step === 'cart' ? 'max-h-[75dvh]' : 'max-h-[85dvh]';

  // Panel animation class by step
  const panelAnimation =
    step === 'checkout'
      ? 'animate-slide-left'
      : step === 'success'
        ? 'animate-scale-fade-in'
        : 'animate-slide-right';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Sheet */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-[#111] rounded-t-3xl animate-slide-up ${maxH} flex flex-col pb-[env(safe-area-inset-bottom)] transition-[max-height] duration-300`}
      >
        {/* Close button — always visible */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white active:scale-90 transition-all"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 bg-white/10 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-full border border-white/20 animate-slide-up-toast whitespace-nowrap">
            {toast}
          </div>
        )}

        {/* Panel body — keyed by step so each mounts fresh with its animation */}
        <div key={step} className={`flex-1 min-h-0 ${panelAnimation}`}>
          {step === 'cart' && <LiveCartPanel onProceedToCheckout={handleProceedToCheckout} />}
          {step === 'checkout' && (
            <LiveCheckoutPanel
              checkoutFlow={checkoutFlow}
              user={user}
              cartItemCount={cartItemCount}
              onBack={() => setStep('cart')}
              onSuccess={handleCheckoutSuccess}
            />
          )}
          {step === 'success' && (
            <LiveOrderSuccessPanel
              orderId={successOrderId}
              totalAmount={successTotal}
              onViewOrder={handleViewOrder}
              onClose={handleClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
