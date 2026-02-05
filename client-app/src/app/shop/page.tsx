'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { ProductCard } from '@/components/home/ProductCard';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { SearchBar } from '@/components/common/SearchBar';
import { getProducts, type Product } from '@/lib/api/products';
import { useRouter, useSearchParams } from 'next/navigation';
import { FloatingNav } from '@/components/layout/FloatingNav';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

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

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        // Use mock data for demo
        const mockProducts: Product[] = [
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
        setProducts(mockProducts);
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

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleProductClick = (productId: string) => {
    router.push(`/products/${productId}`);
  };

  if (loading) {
    return (
      <>
        <main className="min-h-screen pb-20">
          <div className="w-full px-4 py-6 md:max-w-screen-xl md:mx-auto">
            <h1 className="text-h1 text-primary-text font-bold mb-8">Shop</h1>
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-hot-pink border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-body text-secondary-text">상품을 불러오는 중...</p>
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
        <main className="min-h-screen pb-20">
          <div className="w-full px-4 py-6 md:max-w-screen-xl md:mx-auto">
            <h1 className="text-h1 text-primary-text font-bold mb-8">Shop</h1>
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

  return (
    <>
      <main className="min-h-screen bg-primary-black text-primary-text pb-20">
        <div className="w-full px-4 py-6 md:max-w-screen-xl md:mx-auto">
          {/* 헤더 */}
          <header className="sticky top-0 z-50 bg-primary-black border-b border-border-color -mx-4 px-4 pb-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-2xl font-bold text-hot-pink">DoReMi Shop</h1>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <button className="w-10 h-10 rounded-full bg-content-bg border border-border-color flex items-center justify-center" title="알림">
                  🔔
                </button>
              </div>
            </div>
            <p className="text-sm text-secondary-text mb-3">
              {products.length}개의 상품
            </p>

            <SearchBar
              defaultValue={initialQuery}
              onChange={handleSearchChange}
              placeholder="상품 검색..."
            />
          </header>

          {/* 상품 그리드 */}
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  price={product.price}
                  imageUrl={product.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80'}
                  isNew={product.isNew}
                  discount={product.discountRate}
                  onClick={() => handleProductClick(product.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                {searchQuery ? (
                  <>
                    <p className="text-h2 text-primary-text mb-2">검색 결과 없음</p>
                    <p className="text-body text-secondary-text">&apos;{searchQuery}&apos;에 대한 결과가 없습니다</p>
                  </>
                ) : (
                  <>
                    <p className="text-h2 text-primary-text mb-2">등록된 상품이 없습니다</p>
                    <p className="text-body text-secondary-text">곧 새로운 상품이 등록됩니다</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <FloatingNav />
      <BottomTabBar />
    </>
  );
}
