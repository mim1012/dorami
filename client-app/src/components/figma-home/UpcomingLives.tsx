'use client';

import { Clock, Calendar, Bell, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ImageWithFallback } from './figma/ImageWithFallback';
import type { UpcomingLiveDto } from '@live-commerce/shared-types';

type UpcomingLivesProps = {
  upcomingLives: UpcomingLiveDto[];
  isLoading?: boolean;
};

const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1749448621946-5dd68de99664?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&auto=format';

function formatLiveSchedule(isoDate: string) {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return { dayLabel: '예약', timeLabel: '시간 미정' };
  }

  const dayLabel = date.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
  const timeLabel = date.toLocaleTimeString('ko-KR', {
    hour: 'numeric',
    minute: 'numeric',
  });

  return { dayLabel, timeLabel };
}

export function UpcomingLives({ upcomingLives, isLoading = false }: UpcomingLivesProps) {
  const router = useRouter();
  const sliderRef = useRef<HTMLDivElement>(null);

  const goLiveDetail = (streamKey: string) => {
    router.push(`/live/${streamKey}`);
  };

  const scrollPrev = () => {
    sliderRef.current?.scrollBy({ left: -320, behavior: 'smooth' });
  };

  const scrollNext = () => {
    sliderRef.current?.scrollBy({ left: 320, behavior: 'smooth' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#B084CC]" />
            <h3 className="text-xl md:text-2xl font-bold text-gray-900">곧 시작하는 라이브</h3>
          </div>
          <p className="text-sm text-gray-600">
            놓치지 마세요! 알림을 설정하고 특가 혜택을 받으세요
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={scrollPrev}
            className="w-10 h-10 rounded-full bg-white border-2 border-[#FFE5EE] flex items-center justify-center hover:bg-[#FFF0F5] hover:border-[#FF4D8D] transition-all duration-200 shadow-md"
          >
            <ChevronLeft className="w-5 h-5 text-[#FF4D8D]" />
          </button>
          <button
            onClick={scrollNext}
            className="w-10 h-10 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#FF6BA0] flex items-center justify-center hover:scale-105 transition-all duration-200 shadow-lg"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {isLoading && upcomingLives.length === 0 && (
        <p className="rounded-lg border border-[#FFE5EE] bg-[#FFF0F5] px-4 py-2 text-sm text-[#B084CC]">
          예정 라이브를 불러오는 중입니다...
        </p>
      )}

      {upcomingLives.length === 0 && !isLoading && (
        <p className="text-sm text-gray-500">현재 예정된 라이브가 없습니다.</p>
      )}

      <div className="relative -mx-4">
        <div className="px-4">
          {upcomingLives.length > 0 && (
            <div
              ref={sliderRef}
              className="overflow-x-auto flex gap-3 pb-2 snap-x snap-mandatory scrollbar-hide"
            >
              {upcomingLives.map((show) => {
                const { dayLabel, timeLabel } = formatLiveSchedule(show.scheduledAt);

                return (
                  <div
                    key={show.id}
                    className="min-w-[85%] sm:min-w-[55%] md:min-w-[40%] snap-start"
                  >
                    <div
                      onClick={() => goLiveDetail(show.streamKey)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          goLiveDetail(show.streamKey);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className="group w-full text-left bg-gradient-to-br from-white to-[#FFF9FC] rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-[#FFE5EE] cursor-pointer"
                    >
                      <div className="relative aspect-[3/4] overflow-hidden bg-gray-50">
                        <ImageWithFallback
                          src={show.thumbnailUrl ?? PLACEHOLDER_IMAGE}
                          alt={show.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />

                        <div className="absolute top-2 right-2">
                          <div className="px-3 py-1 bg-gradient-to-r from-[#FF4D8D] to-[#FF6BA0] text-white rounded-full shadow-lg">
                            <span className="text-xs font-bold">{dayLabel}</span>
                          </div>
                        </div>

                        {show.host?.name && (
                          <div className="absolute top-2 left-2">
                            <div className="flex items-center gap-1 px-2 py-1 bg-white/95 backdrop-blur-sm rounded-full shadow-md">
                              <TrendingUp className="w-3 h-3 text-[#FF4D8D]" />
                              <span className="text-xs font-bold text-[#FF4D8D]">
                                {show.host.name}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-3">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-white" />
                            <span className="text-white font-bold text-base">{timeLabel}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 space-y-3 h-[180px] flex flex-col">
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-medium text-[#B084CC]">
                            {show.host?.name ?? '라이브'}
                          </span>
                        </div>

                        <div className="flex-1 min-h-0 overflow-hidden">
                          <h4 className="font-bold text-gray-900 text-base mb-1.5 line-clamp-2">
                            {show.title}
                          </h4>
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {show.description ?? '라이브 방송 미리보기'}
                          </p>
                        </div>

                        <button
                          onClick={() => goLiveDetail(show.streamKey)}
                          className="w-full py-2.5 bg-white border-2 border-[#FF4D8D] text-[#FF4D8D] rounded-full font-bold text-sm hover:bg-[#FF4D8D] hover:text-white transition-all duration-200 flex items-center justify-center gap-1.5 group/btn shrink-0"
                        >
                          <Bell className="w-4 h-4 group-hover/btn:animate-bounce" />
                          <span>라이브 보기</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
