'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ShoppingBag, Bell, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { useCart } from '@/lib/hooks/queries/use-cart';
import { useQuery } from '@tanstack/react-query';
import { getActiveNotices, type Notice } from '@/lib/api/notices';
import { NoticeModal } from '@/components/notices/NoticeModal';

export function Header() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const cartCount = useCart({ enabled: isAuthenticated && !isLoading }).data?.itemCount ?? 0;
  const { data: notices = [] } = useQuery<Notice[]>({
    queryKey: ['notices', 'active', 'preview'],
    queryFn: getActiveNotices,
    staleTime: 60_000,
  });
  // Prefer IMPORTANT notice in banner; fall back to latest
  const latestNotice = notices.find((n) => n.category === 'IMPORTANT') ?? notices[0];
  const hasUnread = notices.length > 0;

  useEffect(() => {
    setIsAdmin(isAuthenticated && user?.role === 'ADMIN');
  }, [isAuthenticated, user?.role]);

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    const keyword = searchKeyword.trim();

    if (!keyword) {
      router.push('/store');
      return;
    }

    router.push(`/store?search=${encodeURIComponent(keyword)}&page=1`);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-screen-2xl mx-auto px-4 py-3 md:py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-[#FF4D8D] to-[#B084CC] flex items-center justify-center">
              <span className="text-white font-bold text-sm md:text-base">D</span>
            </div>
            <h1 className="font-bold text-lg md:text-xl bg-gradient-to-r from-[#FF4D8D] to-[#B084CC] bg-clip-text text-transparent">
              도레미
            </h1>
          </Link>

          {/* Icons */}
          <div className="flex items-center gap-3 md:gap-4">
            <button
              onClick={() => setIsNoticeOpen(true)}
              className="p-2 hover:bg-gray-50 rounded-full transition-colors relative"
              aria-label="공지사항 보기"
            >
              <Bell className="w-5 h-5 md:w-4 md:h-4 text-gray-600" />
              {hasUnread && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF4D8D] rounded-full" />
              )}
            </button>
            <Link
              href="/cart"
              className="p-2 hover:bg-gray-50 rounded-full transition-colors relative"
            >
              <ShoppingBag className="w-5 h-5 md:w-4 md:h-4 text-gray-600" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF4D8D] text-white text-xs rounded-full flex items-center justify-center">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="flex px-3 py-1.5 md:px-4 md:py-2 bg-gray-900 text-white text-xs md:text-sm font-semibold rounded-full hover:bg-gray-800 transition-colors"
              >
                관리자
              </Link>
            )}
          </div>
        </div>

        {/* Tagline */}
        <p className="text-center text-xs md:text-sm text-gray-500 mt-3 mb-3">
          지금, 당신만을 위한 패션 라이브
        </p>

        {latestNotice && (
          <button
            type="button"
            className="mb-3 w-full flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#FF007A]/8 to-[#FF4D8D]/5 border border-[#FF4D8D]/25 px-3.5 py-2.5 text-left overflow-hidden active:scale-[0.99] transition-transform"
            onClick={() => setIsNoticeOpen(true)}
            aria-label="공지사항 미리보기"
          >
            {/* Category pill */}
            {latestNotice.category === 'IMPORTANT' ? (
              <span className="flex-shrink-0 text-[10px] font-bold text-white bg-[#FF007A] px-2 py-0.5 rounded-full tracking-wide">
                중요
              </span>
            ) : (
              <span className="flex-shrink-0 text-[10px] font-bold text-[#FF007A] bg-[#FF007A]/10 border border-[#FF007A]/20 px-2 py-0.5 rounded-full tracking-wide">
                공지
              </span>
            )}

            {/* Title — truncated */}
            <span className="flex-1 min-w-0 text-xs font-semibold text-[#990050] truncate">
              {latestNotice.title}
            </span>

            {/* Chevron hint */}
            <svg
              className="flex-shrink-0 w-3.5 h-3.5 text-[#FF4D8D]/50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative max-w-2xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="search"
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder="어떤 스타일을 찾으시나요?"
            inputMode="search"
            className="w-full pl-12 pr-4 py-3 md:py-3.5 bg-gray-50 rounded-full border-none focus:outline-none focus:ring-2 focus:ring-[#FF4D8D]/30 transition-all"
          />
        </form>
        <NoticeModal isOpen={isNoticeOpen} onClose={() => setIsNoticeOpen(false)} />
      </div>
    </header>
  );
}
