'use client';

import { useState, useEffect } from 'react';
import { LiveCountdownBanner } from '@/components/home/LiveCountdownBanner';
import { ProductCard } from '@/components/home/ProductCard';
import { UpcomingLiveCard } from '@/components/home/UpcomingLiveCard';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { useRouter } from 'next/navigation';

// Mock data - 추후 API로 대체
const mockProducts = [
  {
    id: '1',
    name: '프리미엄 무선 이어폰',
    price: 89000,
    imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&q=80',
    isNew: true,
    discount: 20,
  },
  {
    id: '2',
    name: '스마트 워치 프로',
    price: 450000,
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80',
    isNew: false,
  },
  {
    id: '3',
    name: '휴대용 블루투스 스피커',
    price: 129000,
    imageUrl: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&q=80',
    discount: 15,
  },
  {
    id: '4',
    name: '고급 백팩',
    price: 198000,
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=80',
    isNew: true,
  },
  {
    id: '5',
    name: '디자이너 선글라스',
    price: 320000,
    imageUrl: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500&q=80',
    discount: 30,
  },
  {
    id: '6',
    name: '프리미엄 향수',
    price: 150000,
    imageUrl: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=500&q=80',
    isNew: true,
  },
];

export default function Home() {
  const router = useRouter();
  const [upcomingLives, setUpcomingLives] = useState<Array<{
    id: string;
    title: string;
    scheduledTime: Date;
    thumbnailUrl: string;
    isLive: boolean;
  }>>([]);
  const [nextLiveTime, setNextLiveTime] = useState<Date>(new Date());

  // 클라이언트 사이드에서만 동적 시간 생성 (Hydration 오류 방지)
  useEffect(() => {
    const now = Date.now();
    setUpcomingLives([
      {
        id: '1',
        title: '신상 뷰티 제품 특집 라이브',
        scheduledTime: new Date(now + 2 * 60 * 60 * 1000), // 2시간 후
        thumbnailUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80',
        isLive: false,
      },
      {
        id: '2',
        title: '겨울 패션 아이템 특가 방송',
        scheduledTime: new Date(now + 5 * 60 * 60 * 1000), // 5시간 후
        thumbnailUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=80',
        isLive: false,
      },
      {
        id: '3',
        title: '프리미엄 전자기기 특별 할인',
        scheduledTime: new Date(now + 24 * 60 * 60 * 1000), // 내일
        thumbnailUrl: 'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=800&q=80',
        isLive: false,
      },
    ]);
    setNextLiveTime(new Date(now + 2 * 60 * 60 * 1000));
  }, []);

  const handleProductClick = (productId: string) => {
    router.push(`/products/${productId}`);
  };

  const handleLiveClick = () => {
    router.push('/live');
  };

  return (
    <>
      <main className="min-h-screen pb-20">
        <div className="max-w-screen-xl mx-auto px-4 py-6">
          {/* 상단 헤더 */}
          <div className="mb-8">
            <h1 className="text-h1 text-primary-text font-bold mb-2">
              Live Commerce
            </h1>
            <p className="text-body text-secondary-text">
              실시간 쇼핑의 새로운 경험
            </p>
          </div>

          {/* 라이브 카운트다운 배너 */}
          <div className="mb-8">
            <LiveCountdownBanner
              liveStartTime={nextLiveTime}
              isLive={false}
              onLiveClick={handleLiveClick}
            />
          </div>

          {/* 예정된 라이브 섹션 */}
          <div className="mb-8">
            <h2 className="text-h2 text-primary-text font-semibold mb-4">
              예정된 라이브
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingLives.map((live) => (
                <UpcomingLiveCard
                  key={live.id}
                  {...live}
                  onClick={handleLiveClick}
                />
              ))}
            </div>
          </div>

          {/* 이전 추천 상품 섹션 */}
          <div className="mb-6">
            <h2 className="text-h2 text-primary-text font-semibold mb-4">
              이전 추천 상품
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {mockProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  {...product}
                  onClick={() => handleProductClick(product.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* 하단 탭 바 */}
      <BottomTabBar />
    </>
  );
}
