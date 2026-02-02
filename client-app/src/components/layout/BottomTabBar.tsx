'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, ShoppingCart, Video, User } from 'lucide-react';
import { useCart } from '@/lib/contexts/CartContext';

interface TabItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  emoji?: string;
  path?: string;
  onClick?: () => void;
}

const KAKAO_INQUIRY_URL = 'https://pf.kakao.com/_your_kakao_channel'; // 실제 카카오톡 채널 URL로 변경 필요

// 개발/테스트 모드에서는 My Page를 관리자 페이지로 연결
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_ENV === 'development';

const tabs: TabItem[] = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'shop', label: 'Shop', icon: ShoppingCart, path: '/shop' },
  { id: 'live', label: 'Live', icon: Video, path: '/live' },
  {
    id: 'inquiry',
    label: '문의',
    emoji: '💬',
    onClick: () => {
      window.open(KAKAO_INQUIRY_URL, '_blank');
    }
  },
  { id: 'mypage', label: 'My Page', icon: User, path: isDevelopment ? '/admin' : '/my-page' },
];

export function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { getTotalItems } = useCart();
  const cartItemCount = getTotalItems();

  const handleTabClick = (tab: TabItem) => {
    if (tab.onClick) {
      tab.onClick();
    } else if (tab.path) {
      router.push(tab.path);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#1E1E1E]/95 backdrop-blur-sm border-t border-white/10 z-50 shadow-lg pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-screen-xl mx-auto">
        <div className="flex items-center justify-around h-16 px-2">
          {tabs.map((tab) => {
            const isActive = tab.path ? pathname === tab.path : false;
            const Icon = tab.icon;
            const showBadge = tab.id === 'cart' && cartItemCount > 0;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className="flex flex-col items-center justify-center flex-1 gap-1 transition-colors relative min-h-[44px] min-w-[44px]"
              >
                {Icon ? (
                  <div className="relative">
                    <Icon
                      className={`w-6 h-6 ${
                        isActive ? 'text-hot-pink' : 'text-secondary-text'
                      }`}
                    />
                    {showBadge && (
                      <div className="absolute -top-2 -right-2 w-5 h-5 bg-hot-pink rounded-full flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white">
                          {cartItemCount > 9 ? '9+' : cartItemCount}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-2xl">{tab.emoji}</span>
                )}
                <span
                  className={`text-[11px] font-medium ${
                    isActive ? 'text-hot-pink' : 'text-secondary-text'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
