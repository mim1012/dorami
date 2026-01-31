'use client';

import { useState, useEffect } from 'react';

interface LiveCountdownBannerProps {
  liveStartTime?: Date;
  isLive?: boolean;
  onLiveClick?: () => void;
}

export function LiveCountdownBanner({
  liveStartTime,
  isLive = false,
  onLiveClick
}: LiveCountdownBannerProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');

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

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [liveStartTime, isLive]);

  if (isLive) {
    return (
      <div
        onClick={onLiveClick}
        className="relative w-full aspect-video bg-primary-black rounded-[12px] overflow-hidden cursor-pointer group"
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
    <div className="relative w-full aspect-video bg-primary-black rounded-[12px] overflow-hidden">
      {/* 배경 이미지 또는 그라데이션 */}
      <div className="absolute inset-0 bg-gradient-to-br from-content-bg via-primary-black to-content-bg" />

      {/* 오버레이 정보 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-black/40">
        <h2 className="text-h2 text-white mb-4 drop-shadow-lg">다음 라이브 방송까지</h2>
        <p className="text-display text-hot-pink font-bold mb-8 drop-shadow-lg">{timeLeft}</p>
        <button className="bg-hot-pink text-white px-8 py-4 rounded-[8px] font-bold hover:opacity-90 transition-opacity shadow-hot-pink">
          알림받기
        </button>
      </div>
    </div>
  );
}
