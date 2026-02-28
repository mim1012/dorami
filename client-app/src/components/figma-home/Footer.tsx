'use client';

import { Instagram, MessageCircle } from 'lucide-react';
import Link from 'next/link';

const INSTAGRAM_ID = process.env.NEXT_PUBLIC_INSTAGRAM_ID || 'doremiusa';
const KAKAO_CHANNEL_ID = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_ID || '_DeEAX';

export function Footer() {
  const handleKakaoChannel = () => {
    if (KAKAO_CHANNEL_ID) {
      window.open(`https://pf.kakao.com/${KAKAO_CHANNEL_ID}/chat`, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <footer className="bg-gray-50 border-t border-gray-100 mt-20">
      <div className="max-w-screen-2xl mx-auto px-4 py-12 md:py-16">
        {/* Logo & Description */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF4D8D] to-[#B084CC] flex items-center justify-center">
              <span className="text-white font-bold">L</span>
            </div>
            <h1 className="font-bold text-xl bg-gradient-to-r from-[#FF4D8D] to-[#B084CC] bg-clip-text text-transparent">
              LIVE
            </h1>
          </div>
          <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">라이브로 만나는 특별한 쇼핑</p>

          {/* Social Links */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <a
              href={`https://www.instagram.com/${INSTAGRAM_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 bg-white rounded-full flex items-center justify-center hover:bg-[#FF4D8D] hover:text-white transition-colors shadow-sm"
              aria-label="Instagram"
            >
              <Instagram className="w-4 h-4" />
            </a>
            <button
              onClick={handleKakaoChannel}
              className="w-9 h-9 bg-white rounded-full flex items-center justify-center hover:bg-[#FEE500] transition-colors shadow-sm"
              aria-label="KakaoTalk Channel"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Links */}
        <div className="border-t border-gray-200 pt-8">
          <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-4 text-sm text-gray-600 mb-6">
            <Link href="/notices" className="hover:text-[#FF4D8D] transition-colors">
              공지사항
            </Link>
            <span className="hidden sm:inline text-gray-300">·</span>
            <Link href="/support" className="hover:text-[#FF4D8D] transition-colors">
              1:1 문의
            </Link>
            <span className="hidden sm:inline text-gray-300">·</span>
            <Link href="/my-page" className="hover:text-[#FF4D8D] transition-colors">
              마이페이지
            </Link>
            <span className="hidden sm:inline text-gray-300">·</span>
            <Link href="/terms" className="hover:text-[#FF4D8D] transition-colors">
              이용약관
            </Link>
            <span className="hidden sm:inline text-gray-300">·</span>
            <Link href="/privacy" className="hover:text-[#FF4D8D] transition-colors">
              개인정보처리방침
            </Link>
          </div>

          <p className="text-xs text-gray-500 text-center">
            © {new Date().getFullYear()} LIVE. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
