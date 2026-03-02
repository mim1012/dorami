'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Package, X } from 'lucide-react';
import { formatPrice } from '@/lib/utils/price';

interface ProductDetailSheetProduct {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  discountRate?: number;
  imageUrl?: string;
  stock?: number;
}

interface ProductDetailSheetProps {
  product: ProductDetailSheetProduct;
  onClose: () => void;
}

export function ProductDetailSheet({ product, onClose }: ProductDetailSheetProps) {
  const router = useRouter();

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div
      data-testid="product-detail-sheet"
      className="fixed inset-0 z-50 flex flex-col justify-end"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 animate-fade-in-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div className="relative bg-white rounded-t-3xl animate-slide-up-sheet max-h-[85vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors"
          aria-label="닫기"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-4 pb-8 pt-2">
          {/* Image */}
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50 mb-4">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 480px) 100vw, 480px"
                unoptimized={product.imageUrl.startsWith('/uploads/')}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-12 h-12 text-gray-400 opacity-50" />
              </div>
            )}
            {product.discountRate && product.discountRate > 0 && (
              <div className="absolute top-3 left-3">
                <span className="px-2.5 py-1 rounded-full text-xs font-black bg-red-500 text-white">
                  -{product.discountRate}%
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <h3 className="text-lg font-black text-gray-900 mb-3 leading-snug">{product.name}</h3>

          <div className="flex flex-col gap-1 mb-6">
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-sm text-gray-400 line-through">
                {formatPrice(product.originalPrice)}
              </span>
            )}
            <div className="flex items-baseline gap-2">
              {product.discountRate && product.discountRate > 0 && (
                <span className="text-xl font-black text-red-500">{product.discountRate}%</span>
              )}
              <span className="text-2xl font-black text-pink-500">
                {formatPrice(product.price)}
              </span>
            </div>
          </div>

          {/* Stock info */}
          {product.stock !== undefined && product.stock <= 10 && product.stock > 0 && (
            <div className="mb-4 px-3 py-2 rounded-xl bg-orange-50 border border-orange-200 text-center">
              <p className="text-orange-600 text-sm font-bold">잔여 {product.stock}개 남음</p>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={() => router.push(`/products/${product.id}`)}
            className="w-full py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black rounded-full text-base active:scale-95 transition-transform shadow-md"
          >
            상품 상세보기
          </button>
        </div>
      </div>
    </div>
  );
}
