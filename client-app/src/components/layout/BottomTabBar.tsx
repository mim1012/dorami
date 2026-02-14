'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, ShoppingCart, Video, User, MessageCircle } from 'lucide-react';
import { useCart } from '@/lib/contexts/CartContext';
import { useAuth } from '@/lib/hooks/use-auth';
import { InquiryBottomSheet } from '@/components/inquiry/InquiryBottomSheet';

interface TabItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  emoji?: string;
  path?: string;
  isInquiry?: boolean;
}

const tabs: TabItem[] = [
  { id: 'home', label: '홈', icon: Home, path: '/' },
  { id: 'shop', label: '상품', icon: ShoppingCart, path: '/shop' },
  { id: 'live', label: '라이브', icon: Video, path: '/live' },
  { id: 'inquiry', label: '문의', icon: MessageCircle, isInquiry: true },
  { id: 'mypage', label: '마이', icon: User, path: '/my-page' },
];

export function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { getTotalItems } = useCart();
  const { user } = useAuth();
  const cartItemCount = getTotalItems();
  const [isInquiryOpen, setIsInquiryOpen] = useState(false);

  const handleTabClick = (tab: TabItem) => {
    if (tab.isInquiry) {
      setIsInquiryOpen(true);
    } else if (tab.path) {
      const path = tab.id === 'mypage' && user?.role === 'ADMIN' ? '/admin' : tab.path;
      router.push(path);
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
          </div>
        </div>
      </nav>

      <InquiryBottomSheet isOpen={isInquiryOpen} onClose={() => setIsInquiryOpen(false)} />
    </>
  );
}
