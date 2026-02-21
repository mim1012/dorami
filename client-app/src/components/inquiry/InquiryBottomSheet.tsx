'use client';

import { X } from 'lucide-react';
import { useModalBehavior } from '@/lib/hooks/use-modal-behavior';

const KAKAO_CHANNEL_ID = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_ID || '';
const INSTAGRAM_ID = process.env.NEXT_PUBLIC_INSTAGRAM_ID || 'doremi.shop';

// 카카오톡 채널 채팅 URL
const KAKAO_CHANNEL_URL = KAKAO_CHANNEL_ID
  ? `https://pf.kakao.com/${KAKAO_CHANNEL_ID}/chat`
  : 'mailto:422sss@live.com';

// 인스타그램 DM 딥링크 — 모바일에서 앱으로 바로 이동
const INSTAGRAM_URL = `https://ig.me/m/${INSTAGRAM_ID}`;

interface InquiryBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InquiryBottomSheet({ isOpen, onClose }: InquiryBottomSheetProps) {
  useModalBehavior({ isOpen, onClose, lockScroll: false });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="문의하기">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 bg-content-bg rounded-t-3xl animate-slide-up pb-[env(safe-area-inset-bottom)]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-primary-text font-bold text-lg">문의하기</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-border-color transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5 text-secondary-text" />
          </button>
        </div>

        {/* Options */}
        <div className="px-5 pb-6 space-y-3">
          <button
            onClick={() => window.open(KAKAO_CHANNEL_URL, '_blank')}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-border-color hover:bg-content-bg active:scale-[0.98] transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-[#FEE500] flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#3C1E1E">
                <path d="M12 3C6.48 3 2 6.58 2 10.9c0 2.78 1.86 5.21 4.65 6.6-.15.56-.96 3.56-.99 3.78 0 0-.02.17.09.23.11.07.24.01.24.01.32-.04 3.7-2.44 4.28-2.86.56.08 1.14.13 1.73.13 5.52 0 10-3.58 10-7.9C22 6.58 17.52 3 12 3z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-primary-text font-semibold text-[15px]">카카오톡 채널 문의</p>
              <p className="text-secondary-text text-xs mt-0.5">카카오톡으로 간편하게 문의하세요</p>
            </div>
          </button>

          <button
            onClick={() => window.open(INSTAGRAM_URL, '_blank')}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-border-color hover:bg-content-bg active:scale-[0.98] transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white">
                <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.17.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.17-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-1.38-.9 3.72 3.72 0 0 1-.9-1.38c-.17-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.17 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.88 5.88 0 0 0-2.13 1.38A5.88 5.88 0 0 0 .63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.72 1.47 1.38 2.13a5.88 5.88 0 0 0 2.13 1.38c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.88 5.88 0 0 0 2.13-1.38 5.88 5.88 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.88 5.88 0 0 0-1.38-2.13A5.88 5.88 0 0 0 19.86.63C19.1.33 18.22.13 16.95.07 15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-primary-text font-semibold text-[15px]">인스타그램 문의</p>
              <p className="text-secondary-text text-xs mt-0.5">
                @{INSTAGRAM_ID} · DM으로 문의하세요
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
