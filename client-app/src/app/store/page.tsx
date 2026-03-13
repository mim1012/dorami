'use client';

import { FormEvent, useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { ProductCard } from '@/components/home/ProductCard';
import ProductDetailModal from '@/components/product/ProductDetailModal';
import { Display, Heading2, Body, Caption } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { ChevronLeft, ChevronRight, ShoppingBag, X } from 'lucide-react';
import { useToast } from '@/components/common/Toast';
import { Product, ProductStatus } from '@/lib/types';

interface StoreResponse {
  data: Product[];
  meta: {
    total: number;
    page: number;
    totalPages: number;
  };
}

function StoreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState(searchParams.get('search') ?? '');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') ?? '');

  const getRequestedPage = useCallback(() => {
    const pageParam = Number(searchParams.get('page'));
    if (!Number.isFinite(pageParam) || Number.isNaN(pageParam) || pageParam < 1) return 1;
    return pageParam;
  }, [searchParams]);

  const fetchStoreProducts = useCallback(async (page: number = 1, keyword: string = '') => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.get<StoreResponse>('/products/store', {
        params: { page, limit: 24, ...(keyword ? { search: keyword } : {}) },
      });

      setProducts(response.data.data);
      setMeta(response.data.meta);
    } catch (err: any) {
      console.error('Failed to fetch store products:', err);
      setError(err.response?.data?.message || 'Failed to load store products');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const currentSearch = searchParams.get('search') ?? '';
    setSearchKeyword(currentSearch);
    setSearchTerm(currentSearch);
    fetchStoreProducts(getRequestedPage(), currentSearch);
  }, [fetchStoreProducts, getRequestedPage, searchParams]);

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    const keyword = searchKeyword.trim();
    const nextParams = new URLSearchParams(Array.from(searchParams.entries()));

    if (keyword) {
      nextParams.set('search', keyword);
    } else {
      nextParams.delete('search');
    }
    nextParams.set('page', '1');

    setSearchTerm(keyword);
    const query = nextParams.toString();
    router.push(`/store${query ? `?${query}` : ''}`);
  };

  const handleSearchClear = () => {
    const nextParams = new URLSearchParams(Array.from(searchParams.entries()));
    nextParams.delete('search');
    nextParams.set('page', '1');
    const query = nextParams.toString();
    router.push(`/store${query ? `?${query}` : ''}`);
    setSearchKeyword('');
    setSearchTerm('');
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= meta.totalPages) {
      const nextParams = new URLSearchParams(Array.from(searchParams.entries()));
      nextParams.set('page', String(newPage));
      const query = nextParams.toString();
      router.push(`/store${query ? `?${query}` : ''}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleAddToCart = async (
    productId: string,
    quantity: number = 1,
    selectedColor?: string,
    selectedSize?: string,
  ) => {
    try {
      await apiClient.post('/cart', {
        productId,
        quantity,
        color: selectedColor,
        size: selectedSize,
      });

      showToast('장바구니에 담았습니다. (스토어 상품은 타이머 미적용)', 'success');
      setIsModalOpen(false);
      setSelectedProduct(null);
    } catch (err: any) {
      console.error('Failed to add to cart:', err);
      const errorMessage = err.response?.data?.message || 'Failed to add product to cart';
      showToast(errorMessage, 'error');
    }
  };

  const handleQuickAdd = (product: Product) => {
    if (product.status === ProductStatus.SOLD_OUT || product.stock <= 0) {
      showToast('품절된 상품은 담을 수 없습니다.', 'error');
      return;
    }

    if ((product.colorOptions ?? []).length > 0 || (product.sizeOptions ?? []).length > 0) {
      setSelectedProduct(product);
      setIsModalOpen(true);
      return;
    }

    void handleAddToCart(product.id);
  };

  const getPaginationPages = () => {
    const pages: (number | 'ellipsis')[] = [];
    const { page, totalPages } = meta;

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (page > 3) {
        pages.push('ellipsis');
      }

      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (page < totalPages - 2) {
        pages.push('ellipsis');
      }

      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (isLoading && products.length === 0) {
    return (
      <div className="min-h-[100dvh] bg-primary-black flex items-center justify-center overflow-hidden">
        <Body className="text-secondary-text">스토어 상품을 불러오는 중...</Body>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-primary-black py-12 px-3 sm:px-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] overflow-x-hidden">
      <div className="w-full max-w-full md:max-w-7xl mx-auto min-w-0">
        <div className="mb-8">
          <Display className="text-hot-pink mb-2 flex items-center gap-3 text-2xl sm:text-3xl flex-wrap min-w-0">
            <ShoppingBag className="w-10 h-10" />
            지난 방송 상품 스토어
          </Display>
          <Body className="text-secondary-text text-sm sm:text-base break-words">
            라이브 방송에서 종료된 상품만 모아보는 스토어입니다.
          </Body>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="mb-6 flex flex-col gap-2 sm:flex-row sm:gap-3 min-w-0"
        >
          <div className="relative flex-1 min-h-[44px] min-w-0">
            <input
              type="search"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="상품명으로 검색"
              className="w-full h-[44px] pl-4 pr-10 py-2 bg-content-bg rounded-button border border-border-color text-primary-text focus:outline-none focus:ring-2 focus:ring-hot-pink/40"
            />
            {searchKeyword && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 min-h-[36px] min-w-[36px] rounded-full flex items-center justify-center bg-gray-100 text-gray-500"
                onClick={handleSearchClear}
                aria-label="검색어 초기화"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button
            type="submit"
            variant="outline"
            className="h-[44px] w-full sm:w-auto min-w-[88px] shrink-0"
          >
            검색
          </Button>
        </form>

        {error && (
          <div className="mb-6 bg-error/10 border border-error rounded-button p-4">
            <Caption className="text-error">{error}</Caption>
          </div>
        )}

        {products.length > 0 ? (
          <>
            <div className="mb-4">
              <Caption className="text-secondary-text">
                {meta.total > 0
                  ? `검색 결과 ${meta.total}개 · ${(meta.page - 1) * 24 + 1}~${Math.min(
                      meta.page * 24,
                      meta.total,
                    )}개 표시`
                  : '검색 결과 0개'}
              </Caption>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 mb-8 min-w-0">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  price={product.price}
                  originalPrice={product.originalPrice}
                  imageUrl={product.imageUrl || '/images/placeholder-product.svg'}
                  discount={product.discountRate || 0}
                  onClick={() => handleProductClick(product)}
                  onQuickAdd={() => handleQuickAdd(product)}
                />
              ))}
            </div>

            {meta.totalPages > 1 && (
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between bg-content-bg rounded-button px-4 sm:px-6 py-4 gap-3 lg:gap-4">
                <Caption className="text-secondary-text whitespace-nowrap text-xs sm:text-sm">
                  전체 {meta.total}개 상품 중 {(meta.page - 1) * 24 + 1}~
                  {Math.min(meta.page * 24, meta.total)} 개 표시
                </Caption>

                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 w-full lg:w-auto lg:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(meta.page - 1)}
                    disabled={meta.page === 1 || isLoading}
                    className="flex-shrink-0 h-9 px-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  {getPaginationPages().map((pageNum, idx) => {
                    if (pageNum === 'ellipsis') {
                      return (
                        <span key={`ellipsis-${idx}`} className="px-2 text-secondary-text">
                          ...
                        </span>
                      );
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={meta.page === pageNum ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        disabled={isLoading}
                        className="flex-shrink-0 h-9 min-w-9 px-2"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(meta.page + 1)}
                    disabled={meta.page === meta.totalPages || isLoading}
                    className="flex-shrink-0 h-9 px-2"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-content-bg rounded-button p-8 sm:p-12 text-center">
            <div className="text-6xl mb-4">🛍️</div>
            <Heading2 className="text-secondary-text mb-2">
              {searchTerm ? '검색 결과가 없습니다' : '현재 등록된 상품이 없습니다'}
            </Heading2>
            <Body className="text-secondary-text">
              {searchTerm
                ? '검색어를 바꿔 다시 시도해보세요.'
                : '종료된 방송 상품이 생기면 여기서 먼저 확인할 수 있습니다.'}
            </Body>
          </div>
        )}
      </div>

      <BottomTabBar />

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedProduct(null);
          }}
          onAddToCart={handleAddToCart}
        />
      )}
    </div>
  );
}

export default function StorePage() {
  return (
    <div className="home-page">
      <Suspense
        fallback={
          <div className="min-h-[100dvh] bg-primary-black flex items-center justify-center">
            <div className="w-10 h-10 border-[3px] border-hot-pink/20 border-t-hot-pink rounded-full animate-spin" />
          </div>
        }
      >
        <StoreContent />
      </Suspense>
    </div>
  );
}
