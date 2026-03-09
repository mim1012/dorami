'use client';

import { useState, type KeyboardEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, ShoppingCart, Video, User, MessageCircle, Bell, Store, Menu } from 'lucide-react';
import { useCart } from '@/lib/hooks/queries/use-cart';
import { useAuth } from '@/lib/hooks/use-auth';
import { useToast } from '@/components/common/Toast';
import { InquiryBottomSheet } from '@/components/inquiry/InquiryBottomSheet';
import { NoticeModal } from '@/components/notices/NoticeModal';
import { getActiveStreams } from '@/lib/api/streaming';

interface TabItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  emoji?: string;
  path?: string;
  isInquiry?: boolean;
  isNotice?: boolean;
}

interface MoreTabItem extends TabItem {
  description?: string;
  tag?: string;
}

const mainTabs: TabItem[] = [
  { id: 'home', label: '홈', icon: Home, path: '/' },
  { id: 'live', label: '라이브', icon: Video },
  { id: 'store', label: '지난상품', icon: Store, path: '/store' },
  { id: 'cart', label: '장바구니', icon: ShoppingCart, path: '/cart' },
  { id: 'mypage', label: '마이', icon: User, path: '/my-page' },
];

const moreTabs: MoreTabItem[] = [
  {
    id: 'notice',
    label: '공지',
    icon: Bell,
    isNotice: true,
    description: '운영 공지와 이벤트를 빠르게 확인',
    tag: '바로보기',
  },
  {
    id: 'inquiry',
    label: '문의',
    icon: MessageCircle,
    isInquiry: true,
    description: '1:1 문의를 빠르게 등록하고 답변 확인',
    tag: '지원',
  },
];

export function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { data: cartData } = useCart({ enabled: isAuthenticated && !isLoading });
  const cartItemCount = cartData?.itemCount ?? 0;
  const [isInquiryOpen, setIsInquiryOpen] = useState(false);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [noLiveToast, setNoLiveToast] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { showToast } = useToast();

  const handleTabClick = async (tab: TabItem) => {
    if (tab.isInquiry) {
      setIsInquiryOpen(true);
      return;
    }

    if (tab.isNotice) {
      setIsNoticeOpen(true);
      return;
    }

    if (tab.id === 'live') {
      try {
        const streams = await getActiveStreams();
        const liveStream = streams.find((s) => s.isLive && s.streamKey);
        if (liveStream?.streamKey) {
          router.push(`/live/${liveStream.streamKey}`);
        } else {
          setNoLiveToast(true);
          setTimeout(() => setNoLiveToast(false), 2500);
        }
      } catch {
        setNoLiveToast(true);
        setTimeout(() => setNoLiveToast(false), 2500);
      }
      return;
    }

    if (tab.id === 'mypage') {
      if (!isAuthenticated && !isLoading) {
        showToast('로그인 후 이용해주세요', 'error', {
          label: '로그인',
          onClick: () => router.push('/login'),
        });
        return;
      }
    }

    if (tab.path) {
      router.push(tab.path);
    }
  };

  const handleMoreTabClick = (tab: TabItem) => {
    setIsMoreOpen(false);
    if (tab.isInquiry) {
      setIsInquiryOpen(true);
      return;
    }

    if (tab.isNotice) {
      setIsNoticeOpen(true);
      return;
    }

    if (tab.path) {
      router.push(tab.path);
    }
  };

  const handleMoreClose = () => {
    setIsMoreOpen(false);
  };

  const handleMoreBackdropKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      handleMoreClose();
    }
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 bg-[#1E1E1E]/95 backdrop-blur-sm border-t border-white/10 z-50 shadow-lg pb-[env(safe-area-inset-bottom)]"
        role="navigation"
        aria-label="메인 내비게이션"
      >
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-center h-16 px-2">
            {mainTabs.map((tab) => {
              const isActive =
                tab.id === 'live'
                  ? pathname.startsWith('/live')
                  : tab.path
                    ? pathname === tab.path
                    : false;
              const Icon = tab.icon;
              const showBadge = tab.id === 'cart' && cartItemCount > 0;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab)}
                  className="flex flex-col items-center justify-center flex-1 gap-1 transition-colors relative min-h-[44px] min-w-[44px]"
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={tab.label}
                >
                  {Icon && (
                    <div className="relative">
                      <Icon
                        className={`w-6 h-6 ${isActive ? 'text-hot-pink' : 'text-gray-500'}`}
                        aria-hidden="true"
                      />
                      {showBadge && (
                        <div className="absolute -top-2 -right-2 w-5 h-5 bg-hot-pink rounded-full flex items-center justify-center">
                          <span className="text-[10px] font-bold text-white">
                            {cartItemCount > 9 ? '9+' : cartItemCount}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <span
                    className={`text-[11px] font-medium ${
                      isActive ? 'text-hot-pink' : 'text-gray-500'
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setIsMoreOpen(true);
              }}
              aria-expanded={isMoreOpen}
              aria-controls="more-menu"
              className="flex-1 min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-1 transition-colors relative"
              aria-label="더보기"
            >
              <div className="relative">
                <Menu className="w-6 h-6 text-gray-500" aria-hidden="true" />
              </div>
              <span className="text-[11px] font-medium text-gray-500">더보기</span>
            </button>
          </div>
        </div>

        {noLiveToast && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-2 bg-[#2A2A2A] text-white text-xs rounded-full whitespace-nowrap border border-white/10 shadow-lg pointer-events-none">
            현재 진행 중인 라이브가 없어요
          </div>
        )}
      </nav>

      {isMoreOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/45 animate-fade-in-backdrop"
          role="presentation"
          onClick={handleMoreClose}
          onKeyDown={handleMoreBackdropKeyDown}
          tabIndex={0}
        >
          <div
            id="more-menu"
            role="dialog"
            aria-modal="true"
            aria-label="더보기 메뉴"
            className="absolute left-2 right-2 bottom-4 bg-[#1E1E1E] border border-white/10 rounded-2xl p-3 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] shadow-2xl animate-slide-up-sheet"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/25" />
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-sm font-semibold text-white">더보기</p>
              <button
                type="button"
                className="text-xs text-gray-300"
                onClick={handleMoreClose}
                aria-label="더보기 닫기"
              >
                닫기
              </button>
            </div>
            <p className="px-1 pb-2 text-xs text-gray-400">기타 메뉴</p>
            <div className="flex flex-col gap-2">
              {moreTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleMoreTabClick(tab)}
                  className="w-full rounded-xl bg-[#2A2A2A] text-left px-3 py-3.5 flex items-center gap-2.5 text-sm text-white hover:bg-[#343434] active:scale-[0.98] transition-all"
                >
                  {tab.icon && <tab.icon className="w-5 h-5 text-hot-pink shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{tab.label}</span>
                      {tab.tag && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-hot-pink/20 text-hot-pink">
                          {tab.tag}
                        </span>
                      )}
                    </div>
                    {tab.description && (
                      <p className="mt-0.5 text-xs text-gray-400 leading-snug line-clamp-2">
                        {tab.description}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <InquiryBottomSheet isOpen={isInquiryOpen} onClose={() => setIsInquiryOpen(false)} />
      <NoticeModal isOpen={isNoticeOpen} onClose={() => setIsNoticeOpen(false)} />
    </>
  );
}
