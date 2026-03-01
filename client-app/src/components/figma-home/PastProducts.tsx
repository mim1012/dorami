'use client';

import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';
import type { PastProductItem } from '@/lib/api/mainpage';
import { ImageWithFallback } from './figma/ImageWithFallback';

const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=80';

type PastProductsProps = {
  products: PastProductItem[];
  isLoading?: boolean;
};

export function PastProducts({ products, isLoading = false }: PastProductsProps) {
  const router = useRouter();

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Clock className="w-6 h-6 text-[#B084CC]" />
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900">지난 라이브 상품</h3>
        </div>
        <p className="text-base text-gray-600">이전 라이브에서 판매된 상품들을 만나보세요</p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl overflow-hidden shadow-md border border-gray-100 animate-pulse"
            >
              <div className="aspect-[3/4] bg-gray-200" />
              <div className="p-3 md:p-4 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && products.length === 0 && (
        <p className="text-sm text-gray-500 py-4">현재 지난 라이브 상품이 없습니다.</p>
      )}

      {!isLoading && products.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => router.push(`/products/${product.id}`)}
              className="group bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 text-left"
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
                <ImageWithFallback
                  src={product.imageUrl ?? PLACEHOLDER_IMAGE}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {product.discountRate != null && product.discountRate > 0 && (
                  <div className="absolute top-3 left-3 bg-[#FF4D8D] text-white px-3 py-1 rounded-full shadow-lg">
                    <span className="text-xs font-bold">{product.discountRate}%</span>
                  </div>
                )}
              </div>
              <div className="p-3 md:p-4">
                <div className="mb-2">
                  <span className="text-xs text-[#B084CC] font-medium">지난 라이브</span>
                </div>
                <h4 className="font-semibold text-sm md:text-base text-gray-900 mb-2 line-clamp-2">
                  {product.name}
                </h4>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base md:text-lg font-bold text-gray-900">
                    ₩{product.price.toLocaleString()}
                  </span>
                </div>
                {product.originalPrice != null && product.originalPrice > product.price && (
                  <span className="text-xs text-gray-400 line-through">
                    ₩{product.originalPrice.toLocaleString()}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
