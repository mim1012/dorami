'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { ProductCard } from '@/components/home/ProductCard';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { SearchBar } from '@/components/common/SearchBar';
import { getProducts, type Product } from '@/lib/api/products';
import { useRouter, useSearchParams } from 'next/navigation';
import { FloatingNav } from '@/components/layout/FloatingNav';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ProductGridSkeleton } from '@/components/common/Skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { Search } from 'lucide-react';

// ── Fallback mock data ──
const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Chic Evening Bag',
    price: 129000,
    originalPrice: 129000,
    imageUrl: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500&q=80',
    description: '세련된 저녁 가방',
    category: 'fashion',
    stock: 10,
    status: 'AVAILABLE',
    isNew: true,
    discountRate: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Pro Audio Pods',
    price: 62300,
    originalPrice: 89000,
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80',
    description: '프로 오디오 팟',
    category: 'electronics',
    stock: 25,
    status: 'AVAILABLE',
    isNew: false,
    discountRate: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Handmade Tableware',
    price: 45000,
    originalPrice: 45000,
    imageUrl: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=500&q=80',
    description: '수제 식기세트',
    category: 'home',
    stock: 15,
    status: 'AVAILABLE',
    isNew: false,
    discountRate: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '4',
    name: 'Smart Fitness Watch',
    price: 199000,
    originalPrice: 199000,
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80',
    description: '스마트 피트니스 워치',
    category: 'electronics',
    stock: 8,
    status: 'AVAILABLE',
    isNew: false,
    discountRate: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '5',
    name: 'Premium Leather Wallet',
    price: 67150,
    originalPrice: 79000,
    imageUrl: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=500&q=80',
    description: '프리미엄 가죽 지갑',
    category: 'fashion',
    stock: 20,
    status: 'AVAILABLE',
    isNew: true,
    discountRate: 15,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '6',
    name: 'Wireless Keyboard',
    price: 119200,
    originalPrice: 149000,
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&q=80',
    description: '무선 키보드',
    category: 'electronics',
    stock: 12,
    status: 'AVAILABLE',
    isNew: false,
    discountRate: 20,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '7',
    name: 'Designer Sunglasses',
    price: 159000,
    originalPrice: 159000,
    imageUrl: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500&q=80',
    description: '디자이너 선글라스',
    category: 'fashion',
    stock: 18,
    status: 'AVAILABLE',
    isNew: true,
    discountRate: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '8',
    name: 'Ceramic Coffee Mug Set',
    price: 32000,
    originalPrice: 32000,
    imageUrl: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=500&q=80',
    description: '세라믹 커피머그 세트',
    category: 'home',
    stock: 30,
    status: 'AVAILABLE',
    isNew: false,
    discountRate: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function ShopPage() {
  return (
    <Suspense>
      <ShopPageContent />
    </Suspense>
  );
}

function ShopPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('latest');

  const filters = [
    { id: 'all', label: '전체' },
    { id: 'sale', label: 'SALE' },
    { id: 'new', label: 'NEW' },
    { id: 'popular', label: '인기' },
  ];

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);

        // Try API first, fallback to mock
        let fetchedProducts: Product[];
        try {
          const apiProducts = await getProducts();
          if (apiProducts && apiProducts.length > 0) {
            fetchedProducts = apiProducts.map((p) => ({
              ...p,
              stock: p.stock ?? p.stockQuantity ?? 0,
              discountRate: p.discountRate ?? 0,
              isNew: p.isNew ?? false,
              originalPrice: p.originalPrice ?? p.price,
            }));
          } else {
            fetchedProducts = MOCK_PRODUCTS;
          }
        } catch {
          console.warn('API /products failed, using mock data');
          fetchedProducts = MOCK_PRODUCTS;
        }

        setProducts(fetchedProducts);
      } catch (err) {
        setError(err instanceof Error ? err.message : '상품을 불러오는데 실패했습니다');
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const filteredProducts = products
    .filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (activeFilter === 'sale') return matchesSearch && (product.discountRate ?? 0) > 0;
      if (activeFilter === 'new') return matchesSearch && product.isNew;
      return matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'price-low') return a.price - b.price;
      if (sortBy === 'price-high') return b.price - a.price;
      if (sortBy === 'discount') return (b.discountRate ?? 0) - (a.discountRate ?? 0);
      return 0;
    });

  const handleProductClick = (productId: string) => {
    router.push(`/products/${productId}`);
  };

  if (loading) {
    return (
      <>
        <main className="min-h-screen bg-primary-black pb-bottom-nav">
          <div className="w-full px-4 py-6 md:max-w-screen-xl md:mx-auto">
            <ProductGridSkeleton count={6} />
          </div>
        </main>
        <BottomTabBar />
      </>
    );
  }

  if (error) {
    return (
      <>
        <main className="min-h-screen bg-primary-black pb-bottom-nav">
          <div className="w-full px-4 py-6 md:max-w-screen-xl md:mx-auto">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-error-bg flex items-center justify-center">
                  <svg
                    width="40"
                    height="40"
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
                <p className="text-xl font-bold text-error mb-2">오류가 발생했습니다</p>
                <p className="text-body text-secondary-text mb-6">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-hot-pink text-white px-8 py-3 rounded-full font-bold hover:opacity-90 transition-opacity active:scale-95 shadow-hot-pink"
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

  return (
    <>
      <main className="min-h-screen bg-primary-black text-primary-text pb-bottom-nav">
        <div className="w-full md:max-w-screen-xl md:mx-auto">
          {/* Header */}
          <header className="sticky top-0 z-50 bg-primary-black/80 backdrop-blur-xl border-b border-[var(--border-color)]/30">
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl gradient-hot-pink flex items-center justify-center shadow-hot-pink">
                    <span className="text-white font-black text-sm">D</span>
                  </div>
                  <h1 className="text-2xl font-black bg-gradient-to-r from-hot-pink to-[#7928CA] bg-clip-text text-transparent">
                    Shop
                  </h1>
                </div>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <button
                    onClick={() => router.push('/cart')}
                    className="relative w-11 h-11 rounded-full glass flex items-center justify-center hover:border-hot-pink/50 transition-all active:scale-95"
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
                      <circle cx="9" cy="21" r="1" />
                      <circle cx="20" cy="21" r="1" />
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                    </svg>
                  </button>
                </div>
              </div>

              <SearchBar
                defaultValue={initialQuery}
                onChange={handleSearchChange}
                placeholder="상품 검색..."
              />
            </div>

            {/* Filter tabs */}
            <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-none">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 ${
                    activeFilter === filter.id
                      ? 'bg-gradient-to-r from-hot-pink to-[#7928CA] text-white shadow-hot-pink scale-105'
                      : 'bg-content-bg text-secondary-text border border-[var(--border-color)] hover:border-hot-pink/40 hover:text-primary-text'
                  }`}
                >
                  <span>{filter.label}</span>
                </button>
              ))}

              {/* Sort dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="ml-auto px-3 py-2 rounded-full text-sm bg-content-bg text-secondary-text border border-[var(--border-color)] appearance-none cursor-pointer hover:border-hot-pink/30 transition-colors font-semibold"
              >
                <option value="latest">최신순</option>
                <option value="price-low">낮은가격순</option>
                <option value="price-high">높은가격순</option>
                <option value="discount">할인율순</option>
              </select>
            </div>
          </header>

          {/* Results count + active filter badge */}
          <div className="px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-secondary-text font-medium">
              <span className="text-primary-text font-bold">{filteredProducts.length}</span>개의
              상품
              {searchQuery && (
                <span className="text-hot-pink ml-1 font-semibold">&quot;{searchQuery}&quot;</span>
              )}
            </p>
            {activeFilter !== 'all' && (
              <button
                onClick={() => setActiveFilter('all')}
                className="text-xs text-hot-pink bg-hot-pink/10 px-3 py-1 rounded-full font-semibold border border-hot-pink/20 hover:bg-hot-pink/20 transition-colors"
              >
                필터 초기화
              </button>
            )}
          </div>

          {/* Product Grid */}
          <div className="px-4">
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {filteredProducts.map((product, index) => (
                  <div
                    key={product.id}
                    className="animate-stagger-fade"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <ProductCard
                      id={product.id}
                      name={product.name}
                      price={
                        product.discountRate
                          ? product.originalPrice || product.price
                          : product.price
                      }
                      imageUrl={
                        product.imageUrl ||
                        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80'
                      }
                      isNew={product.isNew}
                      discount={product.discountRate}
                      onClick={() => handleProductClick(product.id)}
                    />
                  </div>
                ))}
              </div>
            ) : searchQuery ? (
              <EmptyState
                icon={Search}
                title="검색 결과 없음"
                description={`'${searchQuery}'에 대한 결과가 없습니다`}
              />
            ) : (
              <EmptyState
                title="등록된 상품이 없습니다"
                description="곧 새로운 상품이 등록됩니다"
              />
            )}
          </div>
        </div>
      </main>

      <FloatingNav />
      <BottomTabBar />
    </>
  );
}
