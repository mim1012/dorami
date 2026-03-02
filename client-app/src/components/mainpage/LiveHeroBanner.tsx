'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import type { CurrentLiveDto, UpcomingLiveDto } from '@live-commerce/shared-types';

interface LiveHeroBannerProps {
  currentLive: CurrentLiveDto;
}

export function LiveHeroBanner({ currentLive }: LiveHeroBannerProps) {
  const router = useRouter();

  const handleNavigate = () => router.push(`/live/${currentLive.streamKey}`);

  return (
    <section data-testid="live-banner" className="bg-[#FFF0F5] px-4 py-8 md:px-10 md:py-12">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center gap-8">
        {/* Left: text content */}
        <div className="flex-1 flex flex-col items-start gap-4">
          {/* LIVE NOW badge */}
          <div className="flex items-center gap-1.5 bg-[#FF3B30] text-white text-xs px-3 py-1.5 rounded-full font-bold shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            LIVE NOW
          </div>

          {/* Host name */}
          <p className="text-[#FF3B30] text-sm font-semibold">{currentLive.host.name}</p>

          {/* Title */}
          <h2 className="text-gray-900 text-2xl md:text-3xl font-black leading-tight line-clamp-3">
            {currentLive.title}
          </h2>

          {/* Viewer count */}
          <div className="flex items-center gap-1.5 text-gray-500 text-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
            </svg>
            <span>{currentLive.viewerCount.toLocaleString()}명 시청 중</span>
          </div>

          {/* CTA button */}
          <button
            className="mt-2 px-8 py-3 bg-[#FF3B30] text-white font-bold rounded-full text-sm active:scale-95 transition-transform shadow-md hover:bg-[#e0352a]"
            onClick={handleNavigate}
          >
            지금 시청하기
          </button>
        </div>

        {/* Right: image with play overlay */}
        <div
          className="relative w-full md:w-[480px] aspect-[16/9] rounded-2xl overflow-hidden cursor-pointer flex-shrink-0 shadow-lg"
          onClick={handleNavigate}
        >
          {currentLive.thumbnailUrl ? (
            <Image
              src={currentLive.thumbnailUrl}
              alt={currentLive.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 480px"
              unoptimized={currentLive.thumbnailUrl.startsWith('/uploads/')}
              priority
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#FF4D8D]/20 to-[#7928CA]/20 flex items-center justify-center">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-gray-400 opacity-40"
              >
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
          )}

          {/* Dark scrim */}
          <div className="absolute inset-0 bg-black/25" />

          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#FF3B30">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface UpcomingCountdownProps {
  nextLive?: UpcomingLiveDto | null;
}

export function UpcomingCountdown({ nextLive }: UpcomingCountdownProps) {
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!nextLive?.scheduledAt) return;
    const update = () => {
      const diff = new Date(nextLive.scheduledAt!).getTime() - Date.now();
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
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [nextLive?.scheduledAt]);

  return (
    <section
      data-testid="upcoming-countdown"
      className="relative overflow-hidden bg-gradient-to-br from-[#FF007A]/10 via-white to-[#7928CA]/10 px-4 py-8 text-center"
    >
      <div className="mb-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-100 text-pink-500 text-xs font-bold border border-pink-200">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          다음 라이브까지
        </span>
      </div>
      {countdown && (
        <p className="text-4xl font-black tracking-widest text-gray-900 mb-3 font-mono">
          {countdown}
        </p>
      )}
      {nextLive ? (
        <p className="text-gray-500 text-sm line-clamp-2">{nextLive.title}</p>
      ) : (
        <p className="text-gray-500 text-sm">예정된 라이브가 없습니다</p>
      )}
    </section>
  );
}
