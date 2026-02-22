'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { X, ShoppingCart } from 'lucide-react';
import { useCart, type CartItem } from '@/lib/hooks/queries/use-cart';
import { useModalBehavior } from '@/lib/hooks/use-modal-behavior';
import { formatPrice } from '@/lib/utils/price';

interface LiveCartSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function CartItemRow({ item }: { item: CartItem }) {
  const optionParts = [item.color, item.size].filter(Boolean);
  const optionLabel = optionParts.length > 0 ? `${optionParts.join(' · ')} · ` : '';

  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-white/5 relative">
        {item.product?.imageUrl ? (
          <Image
            src={item.product.imageUrl}
            alt={item.productName}
            fill
            className="object-cover"
            sizes="56px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-white/20" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate">{item.productName}</p>
        <p className="text-white/40 text-xs">
          {optionLabel}
          {item.quantity}개
        </p>
      </div>
      <p className="text-white font-bold text-sm flex-shrink-0">{formatPrice(item.subtotal)}</p>
    </div>
  );
}

export default function LiveCartSheet({ isOpen, onClose }: LiveCartSheetProps) {
  const router = useRouter();
  const { data: cartData } = useCart();
  useModalBehavior({ isOpen, onClose });

  const items = cartData?.items?.filter((item) => item.status === 'ACTIVE') ?? [];
  const grandTotal = cartData?.grandTotal ?? 0;

  const timerItems = items.filter((item) => item.timerEnabled && item.expiresAt);
  const earliestExpiresAt =
    timerItems.length > 0 ? timerItems.map((item) => item.expiresAt!).sort()[0] : null;

  const [localRemaining, setLocalRemaining] = useState(0);
  useEffect(() => {
    if (!earliestExpiresAt) {
      setLocalRemaining(0);
      return;
    }
    const tick = () => {
      const diff = new Date(earliestExpiresAt).getTime() - Date.now();
      setLocalRemaining(Math.max(0, Math.floor(diff / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [earliestExpiresAt]);

  const progressPercent = localRemaining > 0 ? Math.min(100, (localRemaining / 600) * 100) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 bg-[#111] rounded-t-3xl animate-slide-up max-h-[75dvh] flex flex-col pb-[env(safe-area-inset-bottom)]">
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-base flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />내 장바구니
            </h2>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white active:scale-90 transition-all"
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Timer progress bar — only shown when timer-enabled items exist */}
          {timerItems.length > 0 && (
            <>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-hot-pink transition-all duration-1000"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-white/40 mt-1">
                {formatTime(localRemaining)} 내 결제 필요
              </p>
            </>
          )}
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto px-5">
          {items.length > 0 ? (
            items.map((item) => <CartItemRow key={item.id} item={item} />)
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-white/40">
              <ShoppingCart className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">아직 담은 상품이 없어요 👜</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-white/60">합계</span>
            <span className="text-white font-semibold">{formatPrice(grandTotal)}</span>
          </div>
          <div className="flex justify-between text-xs text-white/40 mb-4">
            <span>배송비</span>
            <span>무료</span>
          </div>
          <button
            onClick={() => {
              onClose();
              router.push('/checkout');
            }}
            disabled={items.length === 0}
            className="w-full py-3.5 bg-hot-pink text-white font-bold rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {items.length > 0 ? `${formatPrice(grandTotal)} 결제하기 →` : '장바구니가 비어있어요'}
          </button>
        </div>
      </div>
    </div>
  );
}
