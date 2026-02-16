'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { getActiveStreams, type LiveStream as Stream } from '@/lib/api/streaming';

export default function LivePage() {
  const router = useRouter();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStreams() {
      try {
        setLoading(true);
        const data = await getActiveStreams();
        setStreams(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '라이브 방송을 불러오는데 실패했습니다');
      } finally {
        setLoading(false);
      }
    }

    fetchStreams();
  }, []);

  if (loading) {
    return (
      <>
        <main className="min-h-screen pb-bottom-nav">
          <div className="max-w-screen-xl mx-auto px-4 py-6">
            <h1 className="text-h1 text-primary-text font-bold mb-8">Live</h1>
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-hot-pink border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-body text-secondary-text">라이브 방송을 불러오는 중...</p>
              </div>
            </div>
          </div>
        </main>
        <BottomTabBar />
      </>
    );
  }

  if (error) {
    return (
      <>
        <main className="min-h-screen pb-bottom-nav">
          <div className="max-w-screen-xl mx-auto px-4 py-6">
            <h1 className="text-h1 text-primary-text font-bold mb-8">Live</h1>
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-h2 text-error mb-4">오류가 발생했습니다</p>
                <p className="text-body text-secondary-text mb-6">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-hot-pink text-white px-6 py-3 rounded-[8px] font-bold hover:opacity-90 transition-opacity"
                >
                  다시 시도
                </button>
              </div>
            </div>
          </div>
        </main>
        <BottomTabBar />
      </>
    );
  }

  const liveStreams = streams.filter((stream) => stream.status === 'LIVE');
  const scheduledStreams = streams.filter((stream) => stream.status === 'SCHEDULED');

  return (
    <>
      <main className="min-h-screen pb-bottom-nav">
        <div className="max-w-screen-xl mx-auto px-4 py-6">
          {/* 헤더 */}
          <div className="mb-8">
            <h1 className="text-h1 text-primary-text font-bold mb-2">Live</h1>
            <p className="text-body text-secondary-text">실시간 라이브 방송</p>
          </div>

          {/* 현재 라이브 중인 방송 */}
          {liveStreams.length > 0 && (
            <div className="mb-12">
              <h2 className="text-h2 text-primary-text font-semibold mb-4 flex items-center gap-2">
                <div className="w-3 h-3 bg-hot-pink rounded-full animate-pulse" />
                지금 라이브 중
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveStreams.map((stream) => (
                  <div
                    key={stream.id}
                    onClick={() => router.push(`/live/${stream.streamKey}`)}
                    className="relative aspect-video bg-white rounded-[12px] overflow-hidden cursor-pointer hover:opacity-90 transition-opacity group"
                  >
                    {/* 비디오 플레이스홀더 */}
                    <div className="absolute inset-0 bg-gradient-to-br from-hot-pink/30 to-purple-600/30" />

                    {/* 오버레이 정보 */}
                    <div className="absolute inset-0 p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 bg-hot-pink px-3 py-1 rounded-full">
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                          <span className="text-caption text-white font-bold">LIVE</span>
                        </div>
                        {stream.viewerCount !== undefined && (
                          <div className="bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
                            <span className="text-caption text-white">
                              👥 {stream.viewerCount.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="bg-black/60 backdrop-blur-sm p-3 rounded-[8px]">
                        <h3 className="text-body text-white font-bold mb-1">{stream.title}</h3>
                        {stream.description && (
                          <p className="text-caption text-white/80 line-clamp-1">
                            {stream.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 예정된 라이브 */}
          {scheduledStreams.length > 0 && (
            <div className="mb-12">
              <h2 className="text-h2 text-primary-text font-semibold mb-4">예정된 라이브</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scheduledStreams.map((stream) => (
                  <div key={stream.id} className="bg-content-bg rounded-[12px] p-4">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-body text-primary-text font-bold">{stream.title}</h3>
                      <div className="bg-hot-pink/20 text-hot-pink px-2 py-1 rounded text-caption font-medium">
                        예정
                      </div>
                    </div>
                    {stream.description && (
                      <p className="text-caption text-secondary-text mb-3 line-clamp-2">
                        {stream.description}
                      </p>
                    )}
                    {stream.scheduledStartTime && (
                      <p className="text-caption text-secondary-text">
                        📅 {new Date(stream.scheduledStartTime).toLocaleString('ko-KR')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 라이브 방송이 없을 때 */}
          {liveStreams.length === 0 && scheduledStreams.length === 0 && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-h2 text-primary-text mb-2">진행 중인 라이브가 없습니다</p>
                <p className="text-body text-secondary-text">곧 새로운 라이브가 시작됩니다</p>
              </div>
            </div>
          )}
        </div>
      </main>

      <BottomTabBar />
    </>
  );
}
