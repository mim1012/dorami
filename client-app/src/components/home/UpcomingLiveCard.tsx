'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { Timer } from 'lucide-react';

interface UpcomingLiveCardProps {
  id: string;
  title: string;
  scheduledTime: Date;
  thumbnailUrl: string;
  isLive?: boolean;
  onClick?: () => void;
  size?: 'normal' | 'small';
}

export function UpcomingLiveCard({
  title,
  scheduledTime,
  thumbnailUrl,
  isLive = false,
  onClick,
  size = 'normal',
}: UpcomingLiveCardProps) {
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (isLive) return;
    const update = () => {
      const now = Date.now();
      const target = new Date(scheduledTime).getTime();
      const diff = target - now;
      if (diff <= 0) {
        setCountdown('곧 시작');
        return;
      }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [scheduledTime, isLive]);

  const formatTime = (date: Date) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${month}/${day} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-2xl overflow-hidden bg-[var(--card-bg)] border border-[var(--border-color)] transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 hover:border-hot-pink/40 active:scale-[0.98]"
    >
      <div className="relative aspect-[16/10] bg-primary-black overflow-hidden">
        <Image
          src={thumbnailUrl}
          alt={title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 50vw"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {isLive ? (
          <>
            {/* Animated live ring */}
            <div className="absolute top-3 left-3">
              <div className="relative flex items-center gap-1.5 bg-[#FF3B30] text-white text-xs px-3 py-1.5 rounded-full font-bold shadow-lg">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                LIVE<span className="sr-only"> 현재 생방송 중</span>
              </div>
            </div>
          </>
        ) : (
          <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full font-mono font-bold tracking-wider">
            <Timer className="w-3.5 h-3.5 inline-block mr-1" aria-hidden="true" />
            {countdown}
          </div>
        )}

        {/* Bottom info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-white font-bold text-sm line-clamp-1 drop-shadow-lg mb-1">{title}</h3>
          <div className="flex items-center gap-1.5 text-white/80 text-xs">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{formatTime(scheduledTime)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
