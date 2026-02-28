'use client';

import { Bell, Search, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { getActiveStreams } from '@/lib/api/streaming';

export default function Header() {
  const { user } = useAuth();
  const [isLiveActive, setIsLiveActive] = useState(false);

  useEffect(() => {
    const checkLiveStatus = async () => {
      try {
        const streams = await getActiveStreams();
        setIsLiveActive(streams.length > 0);
      } catch {
        // Silently ignore — live indicator is non-critical
      }
    };

    checkLiveStatus();
    const interval = setInterval(checkLiveStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const displayName = user?.nickname || '관리자';
  const displayInitial = displayName.charAt(0).toUpperCase();

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-[240px] h-16 bg-white border-b border-gray-200 z-30">
      <div className="h-full px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
        {/* Search Bar */}
        <div className="flex-1 min-w-0 max-w-full sm:max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="상품, 주문, 고객 검색..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-100 focus:border-pink-500 transition-colors"
            />
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Live Indicator */}
          {isLiveActive && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-red-600">LIVE</span>
            </div>
          )}

          {/* Notifications */}
          <button
            className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="알림"
          >
            <Bell className="w-5 h-5 text-gray-600" />
            <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-pink-500 rounded-full" />
          </button>

          {/* Admin Profile */}
          <button className="flex items-center gap-3 pl-2 sm:pl-3 pr-2 py-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-gray-900">{displayName}</div>
              <div className="text-xs text-gray-500">{user?.email || '관리자'}</div>
            </div>
            <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-400 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{displayInitial}</span>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </header>
  );
}
