'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { getActiveStreams, type LiveStream as Stream } from '@/lib/api/streaming';
import { getProductsByStreamKey, type Product } from '@/lib/api/products';
import { StreamProductsModal } from '@/components/live/StreamProductsModal';

const formatPrice = (price: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);

export default function LivePage() {
  const router = useRouter();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamProducts, setStreamProducts] = useState<Record<string, Product[]>>({});
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);

  useEffect(() => {
    async function fetchStreams() {
      try {
        setLoading(true);
        const data = await getActiveStreams();
        setStreams(data);

        // Fetch products for each LIVE stream that has a streamKey
        const liveStreams = data.filter((s) => s.status === 'LIVE' && s.streamKey);
        if (liveStreams.length > 0) {
          const results = await Promise.allSettled(
            liveStreams.map((s) => getProductsByStreamKey(s.streamKey!)),
          );
          const productMap: Record<string, Product[]> = {};
          liveStreams.forEach((s, i) => {
            const result = results[i];
            if (result.status === 'fulfilled' && s.streamKey) {
              // Sort by createdAt DESC, take top 4
              const sorted = [...result.value].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              );
              productMap[s.streamKey] = sorted.slice(0, 4);
            }
          });
          setStreamProducts(productMap);
        }
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
                {liveStreams.map((stream) => {
                  const products = streamProducts[stream.streamKey ?? ''] ?? [];
                  return (
                    <div key={stream.id} className="flex flex-col gap-0">
                      {/* 방송 카드 */}
                      <div
                        onClick={() => router.push(`/live/${stream.streamKey}`)}
                        className="relative aspect-video bg-white rounded-t-[12px] overflow-hidden cursor-pointer hover:opacity-90 transition-opacity group"
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

                      {/* 최신 상품 미니 카드 */}
                      {products.length > 0 && (
                        <div className="bg-content-bg rounded-b-[12px] border border-t-0 border-border-color px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                              <span className="text-xs text-secondary-text font-medium flex-shrink-0">
                                최신 상품
                              </span>
                              <div className="flex items-center gap-2 overflow-hidden">
                                {products.map((product) => (
                                  <div
                                    key={product.id}
                                    className="flex-shrink-0 flex flex-col items-center cursor-pointer"
                                    onClick={() => setSelectedStream(stream)}
                                  >
                                    <div className="w-14 h-14 bg-primary-black rounded-lg overflow-hidden mb-1">
                                      {product.imageUrl ? (
                                        <img
                                          src={product.imageUrl}
                                          alt={product.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <ShoppingBag className="w-5 h-5 text-secondary-text opacity-30" />
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-primary-text w-14 truncate text-center leading-tight">
                                      {product.name}
                                    </p>
                                    <p className="text-[10px] text-hot-pink font-bold">
                                      {formatPrice(product.price)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <button
                              onClick={() => setSelectedStream(stream)}
                              className="flex-shrink-0 text-xs bg-hot-pink hover:bg-hot-pink/90 text-white font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                            >
                              구매하기
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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

      {/* 상품 목록 모달 */}
      {selectedStream && (
        <StreamProductsModal
          streamKey={selectedStream.streamKey ?? ''}
          streamTitle={selectedStream.title}
          isOpen={!!selectedStream}
          onClose={() => setSelectedStream(null)}
        />
      )}
    </>
  );
}
