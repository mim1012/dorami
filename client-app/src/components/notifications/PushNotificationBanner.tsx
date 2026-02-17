'use client';

import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { usePushNotification } from '@/lib/hooks/use-push-notification';
import { useAuth } from '@/lib/hooks/use-auth';

const DISMISS_KEY = 'push-banner-dismissed-at';
const DISMISS_DAYS = 7;

export function PushNotificationBanner() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { permission, isSubscribed, isLoading, subscribe } = usePushNotification();
  const [dismissed, setDismissed] = useState(true); // default hidden until check

  useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - Number(dismissedAt);
      if (elapsed < DISMISS_DAYS * 24 * 60 * 60 * 1000) {
        setDismissed(true);
        return;
      }
    }
    setDismissed(false);
  }, []);

  // Don't show if: not authenticated, already subscribed, denied, unsupported, dismissed, loading
  if (
    authLoading ||
    !isAuthenticated ||
    isSubscribed ||
    permission === 'denied' ||
    permission === 'unsupported' ||
    dismissed
  ) {
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  const handleSubscribe = async () => {
    await subscribe();
  };

  return (
    <div className="fixed bottom-[calc(var(--bottom-nav-height,64px)+8px)] left-4 right-4 z-40 animate-slide-up">
      <div className="bg-content-bg border border-border-color rounded-2xl p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full gradient-hot-pink flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-primary-text">알림을 받아보세요</p>
            <p className="text-xs text-secondary-text mt-0.5">
              라이브 방송, 주문 상태, 특가 소식을 놓치지 마세요!
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-primary-black/50 transition-colors shrink-0"
            aria-label="닫기"
          >
            <X className="w-4 h-4 text-secondary-text" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleSubscribe}
            disabled={isLoading}
            className="flex-1 py-2.5 bg-gradient-to-r from-hot-pink to-[#7928CA] text-white text-sm font-bold rounded-full active:scale-95 transition-all disabled:opacity-50"
          >
            {isLoading ? '설정 중...' : '알림 받기'}
          </button>
          <button
            onClick={handleDismiss}
            className="px-5 py-2.5 border border-border-color text-secondary-text text-sm font-semibold rounded-full hover:border-hot-pink/50 transition-all"
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  );
}
