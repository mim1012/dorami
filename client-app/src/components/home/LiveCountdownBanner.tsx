'use client';

import { useState, useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/components/common/Toast';

interface LiveCountdownBannerProps {
  liveStartTime?: Date;
  isLive?: boolean;
  onLiveClick?: () => void;
  liveStreamId?: string;
}

export function LiveCountdownBanner({
  liveStartTime,
  isLive = false,
  onLiveClick,
  liveStreamId
}: LiveCountdownBannerProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const { isSupported, permission, subscribe } = useNotifications();
  const { showToast } = useToast();

  const handleNotificationClick = async () => {
    const success = await subscribe(liveStreamId);
    if (success) {
      showToast('라이브 알림이 설정되었습니다!', 'success');
    } else {
      showToast('알림 설정에 실패했습니다. 브라우저 설정을 확인해주세요.', 'error');
    }
  };

  useEffect(() => {
    if (!liveStartTime || isLive) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const target = new Date(liveStartTime).getTime();
      const difference = target - now;

      if (difference <= 0) {
        setTimeLeft('LIVE NOW');
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [liveStartTime, isLive]);

  if (isLive) {
    return (
      <div
        onClick={onLiveClick}
        className="relative w-full aspect-video bg-gray-900 rounded-[12px] overflow-hidden cursor-pointer group"
      >
        {/* 라이브 비디오 영역 (실제로는 비디오가 여기 들어감) */}
        <div className="absolute inset-0 bg-gradient-to-br from-hot-pink/30 to-purple-600/30" />

        {/* 오버레이 정보 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-4 h-4 bg-hot-pink rounded-full animate-pulse" />
            <span className="text-display text-white font-bold drop-shadow-lg">LIVE NOW</span>
          </div>
          <p className="text-h2 text-white/90 mb-6 drop-shadow-lg">실시간 라이브 방송 중</p>
          <button className="bg-hot-pink text-white px-8 py-4 rounded-[8px] font-bold hover:bg-hot-pink/90 transition-all transform group-hover:scale-105">
            입장하기
          </button>
        </div>
      </div>
    );
  }

  if (!liveStartTime) {
    return (
      <div className="relative w-full aspect-video bg-content-bg rounded-[12px] overflow-hidden">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
          <h2 className="text-h1 text-primary-text mb-2">예정된 라이브가 없습니다</h2>
          <p className="text-body text-secondary-text">곧 새로운 라이브가 시작됩니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-6 p-6 rounded-2xl gradient-hot-pink text-white shadow-hot-pink" aria-live="polite">
      <p className="text-sm font-semibold mb-2 opacity-90">다음 라이브</p>
      <p className="text-5xl font-bold mb-4 tracking-wider" aria-label={`남은 시간 ${timeLeft}`}>{timeLeft}</p>
      <p className="text-sm mb-4 opacity-90">라이브 시작까지</p>
      <button
        onClick={handleNotificationClick}
        disabled={!isSupported}
        className="bg-white text-hot-pink px-6 py-3 rounded-full font-semibold btn-hover disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {permission === 'granted' ? '알림 설정됨' : '알림 받기'}
      </button>
    </div>
  );
}
