'use client';

import { useRouter } from 'next/navigation';
import { MessageCircle, Share2, ShoppingBag } from 'lucide-react';

interface LiveQuickActionBarProps {
  streamTitle: string;
  onInquiry?: () => void;
}

export default function LiveQuickActionBar({ streamTitle, onInquiry }: LiveQuickActionBarProps) {
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
