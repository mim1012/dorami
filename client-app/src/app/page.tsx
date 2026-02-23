'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LiveCountdownBanner } from '@/components/home/LiveCountdownBanner';
import { ProductCard } from '@/components/home/ProductCard';
import { UpcomingLiveCard } from '@/components/home/UpcomingLiveCard';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { SearchBar } from '@/components/common/SearchBar';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { getFeaturedProducts } from '@/lib/api/products';
import { getUpcomingStreams } from '@/lib/api/streaming';
import { FloatingNav } from '@/components/layout/FloatingNav';
import { SocialProof } from '@/components/home/SocialProof';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { PushNotificationBanner } from '@/components/notifications/PushNotificationBanner';
import { Footer } from '@/components/layout/Footer';
import { apiClient } from '@/lib/api/client';
import { Zap } from 'lucide-react';
import Image from 'next/image';

// ── Fallback mock data ──
const MOCK_PRODUCTS = [
  {
    id: '1',
    name: 'Chic Evening Bag',
    price: 129000,
    imageUrl: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500&q=80',
    isNew: true,
    discount: 0,
  },
  {
    id: '2',
    name: 'Pro Audio Pods',
    price: 89000,
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80',
    isNew: false,
    discount: 30,
  },
  {
    id: '3',
    name: 'Handmade Tableware',
    price: 45000,
    imageUrl: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=500&q=80',
    isNew: false,
    discount: 0,
  },
  {
    id: '4',
    name: 'Smart Fitness Watch',
    price: 199000,
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80',
    isNew: false,
    discount: 0,
  },
  {
    id: '5',
    name: 'Premium Leather Wallet',
    price: 79000,
    imageUrl: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=500&q=80',
    isNew: true,
    discount: 15,
  },
  {
    id: '6',
    name: 'Wireless Keyboard',
    price: 149000,
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&q=80',
    isNew: false,
    discount: 20,
  },
];

function getMockUpcomingLives(now: number) {
  return [
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
  ];
}

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [featuredProducts, setFeaturedProducts] = useState<
    Array<{
      id: string;
      name: string;
      price: number;
      originalPrice?: number;
      imageUrl: string;
      isNew?: boolean;
      discount?: number;
    }>
  >([]);
  const [upcomingLives, setUpcomingLives] = useState<
    Array<{
      id: string;
      streamKey?: string;
      title: string;
      scheduledTime: Date;
      thumbnailUrl: string;
      isLive: boolean;
    }>
  >([]);
  const [nextLiveTime, setNextLiveTime] = useState<Date>(new Date());
  const [isNextLiveActive, setIsNextLiveActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const liveSectionRef = useRef<HTMLDivElement>(null);
  const [heroVisible, setHeroVisible] = useState(false);

  // 공지사항 — 라이브 페이지와 동일한 소스
  const { data: notice } = useQuery<{ text: string | null }>({
    queryKey: ['notice', 'current'],
    queryFn: async () => {
      const response = await apiClient.get<{ text: string | null }>('/notices/current');
      return response.data;
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    setHeroVisible(true);
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const now = Date.now();

        // Fetch products from API
        let products: typeof MOCK_PRODUCTS;
        try {
          const apiProducts = await getFeaturedProducts(6);
          if (apiProducts && apiProducts.length > 0) {
            products = apiProducts.map((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              originalPrice: p.originalPrice,
              imageUrl:
                p.imageUrl ||
                'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80',
              isNew: p.isNew || false,
              discount: p.discountRate || 0,
            }));
          } else {
            products = MOCK_PRODUCTS;
          }
        } catch {
          console.warn('API /products/featured failed, using mock data');
          products = MOCK_PRODUCTS;
        }
        setFeaturedProducts(products);

        // Fetch upcoming lives from API
        let lives: typeof upcomingLives;
        try {
          const apiStreams = await getUpcomingStreams(3);
          if (apiStreams && apiStreams.length > 0) {
            lives = apiStreams.map((s) => ({
              id: s.id,
              streamKey: s.streamKey,
              title: s.title,
              scheduledTime: new Date(s.scheduledTime || s.scheduledStartTime || now + 3600000),
              thumbnailUrl:
                s.thumbnailUrl ||
                'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80',
              isLive: s.isLive || false,
            }));
          } else {
            lives = getMockUpcomingLives(now);
          }
        } catch {
          console.warn('API /streaming/upcoming failed, using mock data');
          lives = getMockUpcomingLives(now);
        }
        setUpcomingLives(lives);

        if (lives.length > 0) {
          setNextLiveTime(new Date(lives[0].scheduledTime));
          setIsNextLiveActive(lives[0].isLive);
        }
      } catch (err) {
        console.error('Failed to fetch homepage data:', err);
        setError('데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    const interval = setInterval(async () => {
      try {
        const apiStreams = await getUpcomingStreams(3);
        if (apiStreams && apiStreams.length > 0) {
          const lives = apiStreams.map((s) => ({
            id: s.id,
            streamKey: s.streamKey,
            title: s.title,
            scheduledTime: new Date(
              s.scheduledTime || s.scheduledStartTime || Date.now() + 3600000,
            ),
            thumbnailUrl:
              s.thumbnailUrl ||
              'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80',
            isLive: s.isLive || false,
          }));
          setUpcomingLives(lives);
          if (lives.length > 0) {
            setNextLiveTime(new Date(lives[0].scheduledTime));
            setIsNextLiveActive(lives[0].isLive);
          }
        }
      } catch {
        // silent fail on polling
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleSearch = (query: string) => {
    if (query.trim()) {
      router.push(`/shop?q=${encodeURIComponent(query)}`);
    }
  };

  const handleLiveClick = (streamKey: string) => {
    router.push(`/live/${streamKey}`);
  };

  const handleProductClick = (productId: string) => {
    router.push(`/products/${productId}`);
  };

  const handleLiveBannerClick = () => {
    if (isNextLiveActive && upcomingLives.length > 0 && upcomingLives[0].streamKey) {
      router.push(`/live/${upcomingLives[0].streamKey}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-black text-primary-text flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-hot-pink/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-hot-pink animate-spin"></div>
            <div
              className="absolute inset-2 rounded-full border-4 border-transparent border-b-[#7928CA] animate-spin"
              style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}
            ></div>
          </div>
          <p className="text-secondary-text animate-pulse text-lg font-medium">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-primary-black text-primary-text flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-error-bg flex items-center justify-center">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#DC2626"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="text-error mb-2 font-bold text-xl">{error}</p>
          <p className="text-secondary-text mb-6 text-sm">네트워크 연결을 확인해주세요</p>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3.5 bg-hot-pink rounded-full hover:opacity-90 text-white font-bold transition-all active:scale-95 shadow-hot-pink"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-black text-primary-text pb-bottom-nav">
      {/* HERO SECTION */}
      <header className="relative overflow-hidden bg-primary-black">
        <div
          className={`relative z-10 p-4 pt-6 pb-8 transition-all duration-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          {/* Brand header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0">
                <Image
                  src="/logo.png"
                  alt="Doremi"
                  width={48}
                  height={48}
                  className="object-contain w-full h-full"
                />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-hot-pink via-[#FF4500] to-[#7928CA] bg-clip-text text-transparent">
                  Doremi
                </h1>
                <p className="text-[10px] text-secondary-text -mt-0.5 tracking-[0.2em] uppercase font-semibold">
                  Live Shopping Experience
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={() => router.push('/alerts')}
                className="relative w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 bg-content-bg border border-border-color hover:border-hot-pink/50"
                aria-label="알림"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-hot-pink rounded-full text-[10px] text-white font-bold flex items-center justify-center shadow-hot-pink animate-pulse">
                  3
                </span>
              </button>
            </div>
          </div>

          {/* Hero text */}
          <div className="mb-5">
            <h2 className="text-2xl font-black text-primary-text leading-tight mb-2">
              라이브로 만나는
              <br />
              <span className="bg-gradient-to-r from-hot-pink to-[#7928CA] bg-clip-text text-transparent">
                특별한 쇼핑
              </span>
            </h2>
            <p className="text-sm text-secondary-text">실시간 방송에서 최저가로 만나보세요</p>
          </div>

          <SearchBar onSubmit={handleSearch} />

          {/* 비로그인 사용자 CTA */}
          {!authLoading && !isAuthenticated && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => router.push('/login')}
                className="flex-1 py-3 bg-gradient-to-r from-hot-pink to-[#7928CA] text-white font-bold text-sm rounded-full shadow-hot-pink active:scale-95 transition-all"
              >
                카카오로 시작하기
              </button>
              <button
                onClick={() => router.push('/login')}
                className="px-5 py-3 border border-border-color text-secondary-text font-semibold text-sm rounded-full hover:border-hot-pink/50 transition-all"
              >
                로그인
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Notice Banner */}
      {notice?.text && (
        <div className="bg-[rgba(255,100,100,0.92)] px-3 py-1.5 overflow-hidden">
          <div className="flex items-center gap-2">
            <Zap className="w-3 h-3 text-white flex-shrink-0" />
            <div className="overflow-hidden flex-1">
              <div className="notice-track text-white text-[11px] font-medium">
                <span className="pr-12">{notice.text}</span>
                <span className="pr-12">{notice.text}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Countdown Banner */}
      <LiveCountdownBanner
        liveStartTime={nextLiveTime}
        isLive={isNextLiveActive}
        onLiveClick={handleLiveBannerClick}
      />

      {/* Social Proof */}
      <SocialProof followerCount={6161} />

      {/* UPCOMING LIVES */}
      <section className="px-4 mb-8" ref={liveSectionRef}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-hot-pink to-[#7928CA]"></div>
            <h2 className="text-xl font-black">예정된 라이브</h2>
            <span className="px-2.5 py-1 text-xs font-bold bg-hot-pink/15 text-hot-pink rounded-full border border-hot-pink/20">
              {upcomingLives.length}
            </span>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4 snap-x snap-mandatory">
          {upcomingLives.map((live, index) => (
            <div
              key={live.id}
              className="min-w-[280px] max-w-[300px] snap-start flex-shrink-0 animate-stagger-fade"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <UpcomingLiveCard
                id={live.id}
                title={live.title}
                scheduledTime={new Date(live.scheduledTime)}
                thumbnailUrl={live.thumbnailUrl}
                isLive={live.isLive}
                onClick={() => live.streamKey && handleLiveClick(live.streamKey)}
                size="small"
              />
            </div>
          ))}
        </div>
      </section>

      {/* WEEKLY PICK BANNER */}
      <section className="px-4 mb-8">
        <div
          className="relative overflow-hidden rounded-3xl p-7 mb-8"
          style={{ background: 'linear-gradient(135deg, #FF007A 0%, #7928CA 50%, #FF4500 100%)' }}
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-white/80 text-xs font-bold uppercase tracking-[0.15em] bg-white/10 px-3 py-1 rounded-full">
                Weekly Pick
              </span>
            </div>
            <h3 className="text-white text-2xl font-black mt-2 mb-3 leading-tight">
              이번 주<br />
              인기 상품
            </h3>
            <p className="text-white/80 text-sm mb-5">매주 업데이트되는 도레미 에디터 추천!</p>
            <button
              onClick={() => router.push('/shop')}
              className="bg-white text-[#FF007A] px-7 py-3 rounded-full text-sm font-black hover:bg-white/90 transition-all active:scale-95 shadow-lg"
            >
              지금 확인하기 &rarr;
            </button>
          </div>
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="px-4 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-[#7928CA] to-[#FF4500]"></div>
            <h2 className="text-xl font-black">지난 추천 상품</h2>
          </div>
          <button
            onClick={() => router.push('/shop')}
            className="text-sm text-secondary-text hover:text-hot-pink transition-colors font-semibold"
          >
            더보기 &rarr;
          </button>
        </div>
        {featuredProducts.length === 0 ? (
          <div className="text-center py-16 text-secondary-text">
            <svg
              className="mx-auto mb-4"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <p className="font-medium">등록된 상품이 없습니다</p>
          </div>
        ) : (
          <div
            className="grid grid-cols-2 gap-3.5"
            style={{
              gridTemplateRows: 'auto',
            }}
          >
            {featuredProducts.map((product, index) => (
              <div
                key={product.id}
                className="animate-stagger-fade"
                style={{
                  animationDelay: `${index * 80}ms`,
                  ...(index === 0 ? { gridColumn: '1 / -1' } : {}),
                }}
              >
                <ProductCard
                  id={product.id}
                  name={product.name}
                  price={product.price}
                  originalPrice={product.originalPrice}
                  imageUrl={product.imageUrl}
                  isNew={product.isNew}
                  discount={product.discount}
                  onClick={() => handleProductClick(product.id)}
                  size={index === 0 ? 'normal' : 'small'}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Push Notification Banner */}
      <PushNotificationBanner />

      {/* Footer */}
      <Footer />

      {/* Floating Navigation */}
      <FloatingNav />

      {/* Bottom Navigation */}
      <BottomTabBar />
    </div>
  );
}
