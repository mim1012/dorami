'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, Bell, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import type { UpcomingLiveDto } from '@live-commerce/shared-types';
import { ImageWithFallback } from '@/components/figma-home/figma/ImageWithFallback';

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

function CountdownBadge({ scheduledAt }: { scheduledAt: string }) {
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const scheduledDate = new Date(scheduledAt);
      const target = scheduledDate.getTime();
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
  }, [scheduledAt]);

  return <span className="text-white font-bold text-base">{countdown || '--:--:--'}</span>;
}

interface UpcomingLiveCard {
  id: string;
  streamKey: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  thumbnailUrl: string | null;
  host: { id: string; name: string };
}

export default function UpcomingPage() {
  const router = useRouter();
  const [upcomingLives, setUpcomingLives] = useState<UpcomingLiveCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    const fetchUpcomingLives = async () => {
      try {
        setIsLoading(true);
        setError(null);
        // Fetch all upcoming lives (or with a higher limit)
        const response = await apiClient.get<UpcomingLiveCard[]>('/streaming/upcoming', {
          params: { limit: 100 },
        });
        setUpcomingLives(response.data || []);
      } catch (err) {
        console.error('Failed to fetch upcoming lives:', err);
        setError('예정된 라이브를 불러오는데 실패했습니다.');
        setUpcomingLives([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUpcomingLives();
  }, []);

  const goLiveDetail = (streamKey: string) => {
    router.push(`/live/${streamKey}`);
  };

  // Pagination
  const totalPages = Math.ceil(upcomingLives.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLives = upcomingLives.slice(startIndex, startIndex + itemsPerPage);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-primary-black">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-primary-black border-b border-gray-800">
        <div className="max-w-screen-2xl mx-auto px-4 py-6 md:py-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-6 h-6 text-[#B084CC]" />
              <h1 className="text-2xl md:text-3xl font-bold text-primary-text">
                곧 시작하는 라이브
              </h1>
            </div>
            <p className="text-sm md:text-base text-gray-400">
              놓치지 마세요! 알림을 설정하고 특가 혜택을 받으세요
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-screen-2xl mx-auto px-4 py-8 md:py-12">
        {isLoading && (
          <div className="flex justify-center items-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF4D8D] mx-auto mb-4"></div>
              <p className="text-gray-400">예정 라이브를 불러오는 중입니다...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!isLoading && upcomingLives.length === 0 && (
          <div className="text-center py-16">
            <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">현재 예정된 라이브가 없습니다.</p>
          </div>
        )}

        {!isLoading && paginatedLives.length > 0 && (
          <>
            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {paginatedLives.map((show) => {
                const { dayLabel, timeLabel } = formatLiveSchedule(show.scheduledAt);

                return (
                  <div
                    key={show.id}
                    onClick={() => goLiveDetail(show.streamKey)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        goLiveDetail(show.streamKey);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="group w-full text-left bg-content-bg rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-[#FFE5EE]/20 cursor-pointer"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden bg-content-bg">
                      <ImageWithFallback
                        src={show.thumbnailUrl ?? PLACEHOLDER_IMAGE}
                        alt={show.title}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
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
                          <CountdownBadge scheduledAt={show.scheduledAt} />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 space-y-3 flex flex-col min-h-[120px]">
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-medium text-[#B084CC]">
                          {show.host?.name ?? '라이브'}
                        </span>
                      </div>

                      <div className="flex-1 min-h-0 overflow-hidden">
                        <h4 className="font-bold text-primary-text text-base mb-1.5 line-clamp-2">
                          {show.title}
                        </h4>
                        <p className="text-sm text-gray-400 line-clamp-2">
                          {show.description ?? '라이브 방송 미리보기'}
                        </p>
                      </div>

                      <button
                        onClick={() => goLiveDetail(show.streamKey)}
                        className="w-full py-2.5 bg-transparent border-2 border-[#FF4D8D] text-[#FF4D8D] rounded-full font-bold text-sm hover:bg-[#FF4D8D] hover:text-white transition-all duration-200 flex items-center justify-center gap-1.5 group/btn shrink-0"
                      >
                        <Bell className="w-4 h-4 group-hover/btn:animate-bounce" />
                        <span>라이브 보기</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-4">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-700 text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
                  aria-label="이전 페이지"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => {
                        setCurrentPage(page);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                        page === currentPage
                          ? 'bg-[#FF4D8D] text-white'
                          : 'border border-gray-700 text-gray-400 hover:bg-gray-800'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-700 text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
                  aria-label="다음 페이지"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
