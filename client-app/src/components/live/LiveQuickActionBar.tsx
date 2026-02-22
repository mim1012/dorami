'use client';

import { useRouter } from 'next/navigation';
import { MessageCircle, Share2, ShoppingBag, Megaphone, ShoppingCart } from 'lucide-react';

interface LiveQuickActionBarProps {
  streamTitle: string;
  onInquiry?: () => void;
  onNotice?: () => void;
  onCartOpen?: () => void;
  cartCount?: number;
}

export default function LiveQuickActionBar({
  streamTitle,
  onInquiry,
  onNotice,
  onCartOpen,
  cartCount,
}: LiveQuickActionBarProps) {
  const router = useRouter();

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try {
        await navigator.share({ title: streamTitle, text: `${streamTitle} - 도레LIVE`, url });
      } catch {
        await copyToClipboard(url);
      }
    } else {
      await copyToClipboard(url);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center justify-around bg-[rgba(0,0,0,0.85)] border-t border-white/10 h-[var(--live-quick-action-h)]">
      <button
        onClick={onNotice}
        className="flex flex-col items-center gap-0.5 text-white/70 hover:text-white active:scale-90 transition-all flex-1 py-2"
        aria-label="공지사항"
      >
        <Megaphone className="w-5 h-5" />
        <span className="text-[10px] font-medium">공지</span>
      </button>
      <div className="w-px h-5 bg-white/10" />
      <button
        onClick={onInquiry}
        className="flex flex-col items-center gap-0.5 text-white/70 hover:text-white active:scale-90 transition-all flex-1 py-2"
        aria-label="문의하기"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="text-[10px] font-medium">문의</span>
      </button>
      <div className="w-px h-5 bg-white/10" />
      <button
        onClick={handleShare}
        className="flex flex-col items-center gap-0.5 text-white/70 hover:text-white active:scale-90 transition-all flex-1 py-2"
        aria-label="공유하기"
      >
        <Share2 className="w-5 h-5" />
        <span className="text-[10px] font-medium">공유</span>
      </button>
      <div className="w-px h-5 bg-white/10" />
      <button
        onClick={onCartOpen}
        className="flex flex-col items-center gap-0.5 text-white/70 hover:text-white active:scale-90 transition-all flex-1 py-2"
        aria-label="장바구니"
      >
        <div className="relative">
          <ShoppingCart className="w-5 h-5" />
          {cartCount != null && cartCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-hot-pink rounded-full text-[9px] font-black text-white flex items-center justify-center">
              {cartCount > 9 ? '9+' : cartCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-medium">장바구니</span>
      </button>
      <div className="w-px h-5 bg-white/10" />
      <button
        onClick={() => router.push('/orders')}
        className="flex flex-col items-center gap-0.5 text-white/70 hover:text-white active:scale-90 transition-all flex-1 py-2"
        aria-label="주문내역"
      >
        <ShoppingBag className="w-5 h-5" />
        <span className="text-[10px] font-medium">주문내역</span>
      </button>
    </div>
  );
}
