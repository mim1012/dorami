'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { UpcomingLiveDto } from '@live-commerce/shared-types';

interface UpcomingLiveSliderProps {
  liveStreams: UpcomingLiveDto[];
}

function formatScheduledAt(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${mins}`;
}

export function UpcomingLiveSlider({ liveStreams }: UpcomingLiveSliderProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  if (liveStreams.length === 0) return null;

  const scrollBy = (direction: 'prev' | 'next') => {
    if (!scrollRef.current) return;
    const cardWidth = scrollRef.current.querySelector('[data-card]')?.clientWidth ?? 280;
    scrollRef.current.scrollBy({
      left: direction === 'next' ? cardWidth + 16 : -(cardWidth + 16),
      behavior: 'smooth',
    });
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between px-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-[#7928CA] to-pink-500" />
          <h2 className="text-xl font-black text-gray-900">곧 시작하는 라이브</h2>
          <span className="px-2.5 py-1 text-xs font-bold bg-pink-100 text-pink-500 rounded-full border border-pink-200">
            {liveStreams.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            data-testid="slider-prev"
            onClick={() => scrollBy('prev')}
            className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 hover:border-pink-300 transition-colors active:scale-95"
            aria-label="이전"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            data-testid="slider-next"
            onClick={() => scrollBy('next')}
            className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 hover:border-pink-300 transition-colors active:scale-95"
            aria-label="다음"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4 snap-x snap-mandatory"
      >
        {liveStreams.map((stream) => (
          <div
            key={stream.id}
            data-card
            data-testid="upcoming-card"
            className="min-w-[280px] max-w-[300px] snap-start flex-shrink-0 group cursor-pointer rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-sm active:scale-[0.97] transition-transform hover:border-pink-300"
            onClick={() => router.push(`/live/${stream.streamKey}`)}
          >
            <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
              {stream.thumbnailUrl ? (
                <Image
                  src={stream.thumbnailUrl}
                  alt={stream.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="300px"
                  unoptimized={stream.thumbnailUrl.startsWith('/uploads/')}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#7928CA]/20 to-pink-500/20" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              {stream.scheduledAt && (
                <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full font-mono">
                  {formatScheduledAt(stream.scheduledAt)}
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-white/70 text-[10px] mb-0.5">{stream.host.name}</p>
                <h3 className="text-white font-bold text-sm line-clamp-1">{stream.title}</h3>
              </div>
            </div>
            {stream.description && (
              <div className="px-3 py-2">
                <p className="text-gray-500 text-xs line-clamp-2">{stream.description}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
