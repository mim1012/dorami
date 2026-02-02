'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { ProductCard } from '@/components/home/ProductCard';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { SearchBar } from '@/components/common/SearchBar';
import { getProducts, type Product } from '@/lib/api/products';
import { useRouter, useSearchParams } from 'next/navigation';

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
        const data = await getProducts('AVAILABLE');
        setProducts(data);
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
      <main className="min-h-screen pb-20">
        <div className="w-full px-4 py-6 md:max-w-screen-xl md:mx-auto">
          {/* 헤더 */}
          <div className="mb-8">
            <h1 className="text-h1 text-primary-text font-bold mb-2">Shop</h1>
            <p className="text-body text-secondary-text">
              {products.length}개의 상품
            </p>
          </div>

          {/* 검색바 */}
          <div className="mb-6">
            <SearchBar
              defaultValue={initialQuery}
              onChange={handleSearchChange}
              placeholder="상품 검색..."
            />
          </div>

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

      <BottomTabBar />
    </>
  );
}
