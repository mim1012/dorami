'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Play } from 'lucide-react';
import type { PopularProductDto } from '@live-commerce/shared-types';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { ProductDetailModal } from './ProductDetailModal';
import { ViewAllModal } from './ViewAllModal';
import { useAuthStore } from '@/lib/store/auth';
import { useToast } from '@/components/common/Toast';

type HomeProduct = {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  discountRate?: number;
  image: string;
  colorOptions?: string[];
  sizeOptions?: string[];
};

type PopularProductsProps = {
  products?: PopularProductDto[];
  isLoading?: boolean;
  isError?: boolean;
};

const FALLBACK_PRODUCTS: HomeProduct[] = [
  {
    id: 'fallback-1',
    name: '핑크 스프링 드레스',
    price: 68000,
    originalPrice: 98000,
    discountRate: 31,
    image:
      'https://images.unsplash.com/photo-1749448621946-5dd68de99664?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxrb3JlYW4lMjB3b21hbiUyMGZhc2hpb24lMjBwaW5rJTIwZHJlc3N8ZW58MXx8fHwxNzcyMDkyMTIwfDA&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    id: 'fallback-2',
    name: '베이직 롱 코트',
    price: 89000,
    originalPrice: 149000,
    discountRate: 40,
    image:
      'https://images.unsplash.com/photo-1638385583463-e3d424c22916?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxrb3JlYW4lMjB3b21hbiUyMGJlaWdlJTIwY29hdCUyMHdpbnRlcnxlbnwxfHx8fDE3NzIwOTIxMjF8MA&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    id: 'fallback-3',
    name: '화이트 실크 블라우스',
    price: 45000,
    originalPrice: 72000,
    discountRate: 38,
    image:
      'https://images.unsplash.com/photo-1761014219776-4ac940eca1c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxrb3JlYW4lMjB3b21hbiUyMHdoaXRlJTIwYmxvdXNlJTIwZWxlZ2FudHxlbnwxfHx8fDE3NzIwOTIxMjF8MA&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    id: 'fallback-4',
    name: '라벤더 니트',
    price: 52000,
    originalPrice: 78000,
    discountRate: 33,
    image:
      'https://images.unsplash.com/photo-1667013068391-e09dda140af8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxrb3JlYW4lMjB3b21hbiUyMGxhdmVuZGVyJTIwc3dlYXRlcnxlbnwxfHx8fDE3NzIwOTIxMjJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    id: 'fallback-5',
    name: '캐시미어 카디건',
    price: 95000,
    originalPrice: 145000,
    discountRate: 34,
    image:
      'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b21hbiUyMGNhcmRpZ2FufGVufDF8fHx8MTc3MjEyMzQwMnww&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    id: 'fallback-6',
    name: '플리츠 스커트',
    price: 38000,
    originalPrice: 65000,
    discountRate: 42,
    image:
      'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b21hbiUyMHNraXJ0JTIwZmFzaGlvbnxlbnwxfHx8fDE3NzIxMjM0MDN8MA&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    id: 'fallback-7',
    name: '레더 재킷',
    price: 125000,
    originalPrice: 189000,
    discountRate: 34,
    image:
      'https://images.unsplash.com/photo-1551028719-00167b16eac5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b21hbiUyMGxlYXRoZXIlMjBqYWNrZXR8ZW58MXx8fHwxNzcyMTIzNDA0fDA&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    id: 'fallback-8',
    name: '와이드 팬츠',
    price: 42000,
    originalPrice: 68000,
    discountRate: 38,
    image:
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b21hbiUyMHdpZGUlMjBwYW50c3xlbnwxfHx8fDE3NzIxMjM0MDV8MA&ixlib=rb-4.1.0&q=80&w=1080',
  },
];

const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=80';

function mapPopularProduct(product: PopularProductDto): HomeProduct {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    originalPrice: product.originalPrice ?? product.price,
    discountRate: product.discountRate ?? 0,
    image: product.imageUrl ?? PLACEHOLDER_IMAGE,
  };
}

function getDisplayProducts(apiProducts?: PopularProductDto[]) {
  if (apiProducts && apiProducts.length > 0) {
    return apiProducts.map(mapPopularProduct);
  }

  return FALLBACK_PRODUCTS;
}

type ModalSelectionPayload = {
  quantity: number;
  size?: string;
  color?: string;
};

export function PopularProducts({
  products: apiProducts,
  isLoading = false,
  isError = false,
}: PopularProductsProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { showToast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState<HomeProduct | null>(null);
  const [showViewAll, setShowViewAll] = useState(false);

  const products = getDisplayProducts(apiProducts);
  const isUsingFallback = products === FALLBACK_PRODUCTS;
  const showFallbackTag = isUsingFallback && !isLoading;
  const showLoadingMessage = isLoading && isError;

  const goToProductDetail = (
    product: HomeProduct,
    intent?: 'cart' | 'buy',
    options?: ModalSelectionPayload,
  ) => {
    if (!isAuthenticated) {
      showToast('로그인 후 이용해주세요', 'error', {
        label: '로그인',
        onClick: () => router.push('/login'),
      });
      return;
    }

    const params = new URLSearchParams();

    if (intent) {
      params.set('intent', intent);
    }
    if (options?.quantity) {
      params.set('quantity', String(options.quantity));
    }
    if (options?.size) {
      params.set('size', options.size);
    }
    if (options?.color) {
      params.set('color', options.color);
    }

    const queryString = params.toString();
    router.push(`/products/${product.id}${queryString ? `?${queryString}` : ''}`);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play className="w-6 h-6 text-[#B084CC]" fill="#B084CC" />
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900">라이브 인기 상품</h3>
          </div>
          <button
            onClick={() => setShowViewAll(true)}
            className="flex items-center gap-1 text-sm md:text-base text-[#FF4D8D] hover:text-[#FF6BA0] transition-colors group font-semibold"
          >
            <span>더보기</span>
            <ChevronRight className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        <p className="text-base text-gray-600">
          이전 라이브에서 가장 인기 있었던 상품들을 다시 만나보세요
        </p>
      </div>

      {showLoadingMessage && (
        <p className="rounded-lg border border-[#FFE5EE] bg-[#FFF0F5] px-4 py-2 text-sm text-[#B084CC]">
          인기 상품 API 호출 중 문제가 있어 샘플 데이터로 표시합니다.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
        {products.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                showToast('로그인 후 이용해주세요', 'error', {
                  label: '로그인',
                  onClick: () => router.push('/login'),
                });
                return;
              }
              setSelectedProduct(product);
            }}
            className="group bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 text-left"
          >
            <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
              <ImageWithFallback
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-3 left-3 bg-[#FF4D8D] text-white px-3 py-1 rounded-full shadow-lg">
                <span className="text-xs font-bold">{product.discountRate ?? 0}%</span>
              </div>
            </div>
            <div className="p-3 md:p-4">
              <div className="mb-2">
                <span className="text-xs text-[#B084CC] font-medium">라이브</span>
              </div>
              <h4 className="font-semibold text-sm md:text-base text-gray-900 mb-2 line-clamp-2">
                {product.name}
              </h4>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base md:text-lg font-bold text-gray-900">
                  ₩{product.price.toLocaleString()}
                </span>
              </div>
              <span className="text-xs text-gray-400 line-through">
                ₩{product.originalPrice.toLocaleString()}
              </span>
              {showFallbackTag && (
                <span className="text-[10px] text-[#FF6BA0] block mt-1">샘플 데이터</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(payload) => {
            goToProductDetail(selectedProduct, 'cart', payload);
            setSelectedProduct(null);
          }}
          onBuyNow={(payload) => {
            goToProductDetail(selectedProduct, 'buy', payload);
            setSelectedProduct(null);
          }}
        />
      )}

      {showViewAll && (
        <ViewAllModal
          title="라이브 인기 상품"
          type="popular"
          products={products}
          onClose={() => setShowViewAll(false)}
          onProductClick={(product) => {
            setShowViewAll(false);
            const targetProduct = {
              ...product,
              originalPrice: product.originalPrice ?? 0,
              discountRate: product.discountRate ?? 0,
            };
            goToProductDetail(targetProduct, undefined);
          }}
        />
      )}
    </div>
  );
}
