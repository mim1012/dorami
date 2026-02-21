'use client';

import { useState } from 'react';
import Image from 'next/image';
import { LegalModal } from '@/components/legal/LegalModal';

const INSTAGRAM_ID = process.env.NEXT_PUBLIC_INSTAGRAM_ID || 'doremiusa';
const KAKAO_CHANNEL_ID = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_ID || '_DeEAX';

export function Footer() {
  const [legalType, setLegalType] = useState<'terms' | 'privacy' | null>(null);

  const handleKakaoChannel = () => {
    if (KAKAO_CHANNEL_ID) {
      window.open(`https://pf.kakao.com/${KAKAO_CHANNEL_ID}/chat`, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = 'mailto:422sss@live.com';
    }
  };

  return (
    <>
      <footer className="relative mt-2 pb-20">
        {/* Gradient divider */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-hot-pink/60 to-transparent mb-6" />

        <div className="px-4 space-y-5">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
              <Image
                src="/logo.png"
                alt="Doremi"
                width={36}
                height={36}
                className="object-contain w-full h-full"
              />
            </div>
            <div>
              <p className="text-sm font-black bg-gradient-to-r from-hot-pink via-[#FF4500] to-[#7928CA] bg-clip-text text-transparent leading-none">
                Doremi
              </p>
              <p className="text-[10px] text-secondary-text tracking-widest uppercase mt-0.5">
                Live Shopping Experience
              </p>
            </div>
          </div>

          {/* Tagline */}
          <p className="text-xs text-secondary-text/70">라이브로 만나는 특별한 쇼핑</p>

          {/* Social links */}
          <div className="flex gap-2">
            {/* Instagram */}
            <a
              href={`https://www.instagram.com/${INSTAGRAM_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all"
              aria-label="인스타그램 방문"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className="text-[#E1306C]"
              >
                <rect
                  x="2"
                  y="2"
                  width="20"
                  height="20"
                  rx="5"
                  ry="5"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
                <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
              </svg>
              <span className="text-[10px] font-semibold text-secondary-text">@{INSTAGRAM_ID}</span>
            </a>

            {/* KakaoTalk Channel */}
            <button
              onClick={handleKakaoChannel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-[#FEE500]/30 bg-[#FEE500]/10 hover:bg-[#FEE500]/20 active:scale-95 transition-all"
              aria-label="카카오톡 채널 상담"
            >
              {/* KakaoTalk speech bubble icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#FEE500">
                <path d="M12 3C6.48 3 2 6.92 2 11.75c0 3.03 1.76 5.7 4.44 7.3-.18.66-.67 2.38-.77 2.76-.12.46.17.45.36.33.15-.1 2.37-1.58 3.34-2.22.84.13 1.71.2 2.63.2 5.52 0 10-3.92 10-8.75C22 6.92 17.52 3 12 3z" />
              </svg>
              <span className="text-[10px] font-semibold text-[#3A1D1D]/80 dark:text-[#FEE500]">
                카카오톡 채널
              </span>
            </button>
          </div>

          {/* Business info card */}
          <div className="rounded-2xl bg-content-bg border border-white/5 px-4 py-3 space-y-2">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-1 h-3 rounded-full bg-gradient-to-b from-hot-pink to-[#7928CA]" />
              <span className="text-[10px] font-bold text-secondary-text uppercase tracking-widest">
                사업자 정보
              </span>
            </div>

            <div className="space-y-1.5 text-[11px] text-secondary-text">
              <div className="flex gap-2">
                <span className="text-secondary-text/50 w-20 flex-shrink-0">상호명</span>
                <span className="text-primary-text/80 font-medium">Doremi</span>
              </div>
              <div className="flex gap-2">
                <span className="text-secondary-text/50 w-20 flex-shrink-0">대표자</span>
                <span className="text-primary-text/80 font-medium">김민성</span>
              </div>
              <div className="flex gap-2">
                <span className="text-secondary-text/50 w-20 flex-shrink-0">개인정보책임자</span>
                <span className="text-primary-text/80 font-medium">김민성</span>
              </div>
              <div className="flex gap-2">
                <span className="text-secondary-text/50 w-20 flex-shrink-0">사업자 번호</span>
                <span className="text-primary-text/80 font-medium">194-44-00522</span>
              </div>
              <div className="flex gap-2">
                <span className="text-secondary-text/50 w-20 flex-shrink-0">통신판매업</span>
                <span className="text-primary-text/80 font-medium">제 2021-대전유성-1024 호</span>
              </div>
              <div className="flex gap-2">
                <span className="text-secondary-text/50 w-20 flex-shrink-0">문의</span>
                <a
                  href="mailto:422sss@live.com"
                  className="text-hot-pink/80 font-medium hover:text-hot-pink transition-colors"
                >
                  422sss@live.com
                </a>
              </div>
              <div className="flex gap-2">
                <span className="text-secondary-text/50 w-20 flex-shrink-0">호스팅제공자</span>
                <span className="text-primary-text/80 font-medium">(주)비즈솔루션</span>
              </div>
            </div>
          </div>

          {/* Terms links — open modals */}
          <p className="text-[10px] text-center">
            <button
              onClick={() => setLegalType('terms')}
              className="text-secondary-text/60 hover:text-hot-pink transition-colors underline"
            >
              이용약관
            </button>
            {' | '}
            <button
              onClick={() => setLegalType('privacy')}
              className="text-secondary-text/60 hover:text-hot-pink transition-colors underline"
            >
              개인정보 처리방침
            </button>
          </p>

          {/* Copyright */}
          <p className="text-[10px] text-secondary-text/40 text-center pb-1">
            © {new Date().getFullYear()} Doremi. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Legal modals */}
      <LegalModal type={legalType} onClose={() => setLegalType(null)} />
    </>
  );
}
