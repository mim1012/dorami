'use client';

import { useEffect, useState, useCallback } from 'react';
import { ProductCard } from '@/components/home/ProductCard';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { SearchBar } from '@/components/common/SearchBar';
import { getProducts, getLiveDeals, getStoreProducts } from '@/lib/api/products';
import type { Product } from '@/lib/types';
import { ProductStatus } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { FloatingNav } from '@/components/layout/FloatingNav';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ProductGridSkeleton } from '@/components/common/Skeleton';
import { EmptyState } from '@/components/common/EmptyState';

interface ShopProduct {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  stock: number;
  status: ProductStatus;
  isNew: boolean;
  discountRate: number;
}

const convertProduct = (p: Product): ShopProduct => ({
  id: p.id,
  name: p.name,
  price: p.price as number,
  originalPrice: p.originalPrice as number | undefined,
  imageUrl: p.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80',
  stock: p.stock,
  status: p.status,
  discountRate: (p.discountRate as number | undefined) ?? 0,
  isNew: p.isNew ?? false,
});

export default function ShopPage() {
  const router = useRouter();
  const [pastProducts, setPastProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchAllProducts() {
      try {
        setLoading(true);
        const combinedProducts: ShopProduct[] = [];

        // 1. 지난 라이브 상품 (종료된 스트림의 상품)
        try {
          const storeData = await getStoreProducts(1, 12);
          if (storeData?.data) {
            combinedProducts.push(...storeData.data.map(convertProduct));
          }
        } catch (e) {
          console.warn('Failed to fetch store products:', e);
        }

        // 2. 일반 상품 (streamKey 없는 상품)
        try {
          const allProducts = await getProducts();
          if (allProducts && allProducts.length > 0) {
            // streamKey가 없는 상품들만 필터링
            const generalOnly = allProducts.filter((p) => !p.streamKey).map(convertProduct);
            combinedProducts.push(...generalOnly);
          }
        } catch (e) {
          console.warn('Failed to fetch general products:', e);
        }

        // 중복 제거 (ID 기준)
        const uniqueProducts = Array.from(new Map(combinedProducts.map((p) => [p.id, p])).values());
        setPastProducts(uniqueProducts);
      } catch (err) {
        setError(err instanceof Error ? err.message : '상품을 불러오는데 실패했습니다');
      } finally {
        setLoading(false);
      }
    }

    fetchAllProducts();
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const filterProducts = (products: ShopProduct[]): ShopProduct[] => {
    return products.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  };

  const handleProductClick = (productId: string) => {
    router.push(`/products/${productId}`);
  };

  if (loading) {
    return (
      <>
        <main className="min-h-screen bg-primary-black pb-bottom-nav">
          <div className="w-full px-4 py-6 md:max-w-screen-xl md:mx-auto">
            <ProductGridSkeleton count={12} />
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
          <div className="w-full px-4 py-6">
            <EmptyState title="오류 발생" description={error} />
          </div>
        </main>
        <BottomTabBar />
      </>
    );
  }

  return (
    <>
      <FloatingNav />
      <main className="min-h-screen bg-primary-black pb-bottom-nav">
        <div className="w-full px-4 py-6 md:max-w-screen-xl md:mx-auto">
          {/* Search Bar */}
          <div className="mb-6">
            <SearchBar
              defaultValue={searchQuery}
              onChange={handleSearchChange}
              placeholder="상품 검색..."
            />
          </div>

          {/* 📅 Scheduled Lives Section */}
          <section className="mb-12">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>📅</span>곧 시작하는 라이브
            </h2>
            <div className="p-8 bg-gray-900 rounded-lg text-center border border-gray-800">
              <p className="text-gray-400 mb-2">
                놓치지 마세요! 알림을 설정하고 특가 혜택을 받으세요
              </p>
              <p className="text-gray-500 text-sm">현재 예정된 라이브가 없습니다</p>
            </div>
          </section>

          {/* 📦 Past Products Section */}
          <section className="mb-12">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>📦</span>
              지난 상품 목록
            </h2>
            <p className="text-gray-400 text-sm mb-4">이전 라이브 및 일반 상품 목록</p>
            {pastProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {filterProducts(pastProducts).map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={product.price}
                    originalPrice={product.originalPrice}
                    imageUrl={product.imageUrl}
                    isNew={product.isNew}
                    discount={product.discountRate}
                    onClick={() => handleProductClick(product.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState title="상품이 없습니다" description="현재 판매 중인 상품이 없습니다." />
            )}
          </section>
        </div>
      </main>
      <BottomTabBar />
      <ThemeToggle />
    </>
  );
}
