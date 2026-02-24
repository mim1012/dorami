'use client';

import Image from 'next/image';
import { X } from 'lucide-react';
import type { Product } from '@/lib/types';
import { formatPrice } from '@/lib/utils/price';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  activeProductId?: string | null;
  onSelectProduct: (product: Product) => void;
}

export default function ProductListBottomSheet({
  isOpen,
  onClose,
  products,
  activeProductId,
  onSelectProduct,
}: Props) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="상품 목록"
        className="fixed inset-x-0 bottom-0 z-50 bg-[#12121e] rounded-t-3xl animate-slide-up-sheet max-h-[75vh] flex flex-col"
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <h2 className="text-white font-bold text-base flex items-center gap-2">
            상품 목록
            {products.length > 0 && (
              <span className="text-white/40 text-sm font-normal">{products.length}개</span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Product list */}
        <div className="overflow-y-auto flex-1 p-4 space-y-2.5">
          {products.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-white/40 text-sm">등록된 상품이 없습니다</p>
            </div>
          ) : (
            products.map((product) => {
              const isActive = product.id === activeProductId;
              const isSoldOut = product.status === 'SOLD_OUT';
              const discountedPrice =
                product.discountRate && product.discountRate > 0
                  ? Math.round(
                      (product.originalPrice ?? product.price) * (1 - product.discountRate / 100),
                    )
                  : product.price;

              return (
                <button
                  key={product.id}
                  onClick={() => {
                    if (!isSoldOut) onSelectProduct(product);
                  }}
                  disabled={isSoldOut}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left border ${
                    isActive
                      ? 'bg-[#FF007A]/15 border-[#FF007A]/50'
                      : isSoldOut
                        ? 'bg-white/3 border-white/5 opacity-50 cursor-not-allowed'
                        : 'bg-white/5 border-white/10 active:bg-white/10'
                  }`}
                >
                  {product.imageUrl && (
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-white/5">
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        className="object-cover"
                        unoptimized={product.imageUrl.startsWith('/uploads/')}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{product.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {product.discountRate && product.discountRate > 0 ? (
                        <>
                          <span className="text-white/35 text-xs line-through">
                            {formatPrice(product.originalPrice ?? product.price)}
                          </span>
                          <span className="text-red-400 text-xs font-bold">
                            {product.discountRate}%
                          </span>
                        </>
                      ) : null}
                      <span className="text-[#FF007A] font-black text-sm">
                        {formatPrice(discountedPrice)}
                      </span>
                    </div>
                    {isSoldOut && <p className="text-white/30 text-xs mt-1">품절</p>}
                  </div>
                  {isActive && (
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#FF007A] flex items-center justify-center">
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden="true">
                        <path
                          d="M1 3.5L3.5 6 8 1"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
