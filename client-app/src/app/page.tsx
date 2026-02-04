'use client';

import { useState, useEffect } from 'react';
import { LiveCountdownBanner } from '@/components/home/LiveCountdownBanner';
import { ProductCard } from '@/components/home/ProductCard';
import { UpcomingLiveCard } from '@/components/home/UpcomingLiveCard';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { SearchBar } from '@/components/common/SearchBar';
import { useRouter } from 'next/navigation';
import { getFeaturedProducts } from '@/lib/api/products';
import { getUpcomingStreams } from '@/lib/api/streaming';

export default function Home() {
  const router = useRouter();
  const [featuredProducts, setFeaturedProducts] = useState<Array<{
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
    isNew?: boolean;
    discount?: number;
  }>>([]);
  const [upcomingLives, setUpcomingLives] = useState<Array<{
    id: string;
    title: string;
    scheduledTime: Date;
    thumbnailUrl: string;
    isLive: boolean;
  }>>([]);
  const [nextLiveTime, setNextLiveTime] = useState<Date>(new Date());
  const [isNextLiveActive, setIsNextLiveActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data from API
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch featured products
        const products = await getFeaturedProducts(6);
        setFeaturedProducts(products.map(p => ({
          id: p.id,
          name: p.name,
          price: p.originalPrice || p.price,
          imageUrl: p.imageUrl || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80',
          isNew: p.isNew,
          discount: p.discountRate,
        })));

        // Fetch upcoming live streams
        const streams = await getUpcomingStreams(3);
        if (streams.length > 0) {
          setUpcomingLives(streams.map(s => ({
            id: s.id,
            title: s.title,
            scheduledTime: new Date(s.scheduledTime),
            thumbnailUrl: s.thumbnailUrl || 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80',
            isLive: s.isLive,
          })));
          setNextLiveTime(new Date(streams[0].scheduledTime));
        } else {
          // Fallback to mock data if no upcoming streams
          const now = Date.now();
          setUpcomingLives([
            {
              id: '1',
              title: '신상 뷰티 제품 특집 라이브',
              scheduledTime: new Date(now + 2 * 60 * 60 * 1000),
              thumbnailUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80',
              isLive: false,
            },
            {
              id: '2',
              title: '겨울 패션 아이템 특가 방송',
              scheduledTime: new Date(now + 5 * 60 * 60 * 1000),
              thumbnailUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80',
              isLive: false,
            },
            {
              id: '3',
              title: '프리미엄 전자기기 특별 할인',
              scheduledTime: new Date(now + 24 * 60 * 60 * 1000),
              thumbnailUrl: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&q=80',
              isLive: false,
            },
          ]);
          setNextLiveTime(new Date(now + 2 * 60 * 60 * 1000));
        }
      } catch (err) {
        console.error('Failed to fetch homepage data:', err);
        setError('데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleSearch = (query: string) => {
    if (query.trim()) {
      router.push(`/shop?search=${encodeURIComponent(query)}`);
    }
  };

  const handleLiveClick = (liveId: string) => {
    console.log('Live clicked:', liveId);
    // TODO: Implement live detail navigation
    router.push(`/live/${liveId}`);
  };

  const handleProductClick = (productId: string) => {
    console.log('Product clicked:', productId);
    // TODO: Implement product detail navigation
    router.push(`/product/${productId}`);
  };

  const handleLiveBannerClick = () => {
    if (isNextLiveActive && upcomingLives.length > 0) {
      // If live is active, navigate to the first live
      router.push(`/live/${upcomingLives[0].id}`);
    } else if (upcomingLives.length > 0) {
      // If live is upcoming, show notification setup
      alert('라이브 알림이 설정되었습니다!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-pink-500 rounded-lg hover:bg-pink-600"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black border-b border-gray-800">
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-3">Live Commerce</h1>
          <SearchBar onSubmit={handleSearch} />
        </div>
      </header>

      {/* Live Countdown Banner */}
      <LiveCountdownBanner 
        liveStartTime={nextLiveTime}
        isLive={isNextLiveActive}
        onLiveClick={handleLiveBannerClick}
      />

      {/* Upcoming Lives Section */}
      <section className="p-4">
        <h2 className="text-xl font-bold mb-4">예정된 라이브</h2>
        <div className="space-y-3">
          {upcomingLives.map((live) => (
            <UpcomingLiveCard
              key={live.id}
              id={live.id}
              title={live.title}
              scheduledTime={new Date(live.scheduledTime)}
              thumbnailUrl={live.thumbnailUrl}
              isLive={live.isLive}
              onClick={() => handleLiveClick(live.id)}
            />
          ))}
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="p-4">
        <h2 className="text-xl font-bold mb-4">이번 주 추천 상품</h2>
        {featuredProducts.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            등록된 상품이 없습니다
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {featuredProducts.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                price={product.price}
                imageUrl={product.imageUrl}
                isNew={product.isNew}
                discount={product.discount}
                onClick={() => handleProductClick(product.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Bottom Navigation */}
      <BottomTabBar />
    </div>
  );
}
