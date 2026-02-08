'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  stock: number;
}

interface ProductBottomSheetProps {
  products: Product[];
  onAddToCart: (productId: string) => void;
  streamKey: string;
}

export default function ProductBottomSheet({ products, onAddToCart, streamKey }: ProductBottomSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  return (
    <>
      {/* Collapsed: Show mini product bar */}
      {!isExpanded && products.length > 0 && (
        <div
          className="absolute bottom-[140px] left-4 right-4 z-30 cursor-pointer"
          onClick={() => setIsExpanded(true)}
        >
          <div className="bg-black/60 backdrop-blur-lg rounded-2xl p-3 border border-white/10 flex items-center gap-3 active:scale-[0.98] transition-transform">
            {products[0]?.imageUrl && (
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 relative">
                <Image src={products[0].imageUrl} alt={products[0].name} fill className="object-cover" sizes="48px" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold truncate">{products[0]?.name}</p>
              <p className="text-hot-pink text-sm font-black">{products[0]?.price.toLocaleString()}원</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-xs">{products.length}개 상품</span>
              <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Expanded: Full product list */}
      {isExpanded && (
        <>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 z-30"
            onClick={() => setIsExpanded(false)}
          />
          
          {/* Sheet */}
          <div
            ref={sheetRef}
            className="absolute bottom-0 left-0 right-0 z-40 bg-[#1A1A1A] rounded-t-3xl max-h-[60vh] overflow-hidden animate-slide-up"
          >
            {/* Handle */}
            <div className="flex justify-center py-3 cursor-pointer" onClick={() => setIsExpanded(false)}>
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="px-4 pb-3 flex items-center justify-between">
              <h3 className="text-white font-bold text-lg">상품 목록</h3>
              <span className="text-hot-pink text-sm font-semibold">{products.length}개</span>
            </div>

            {/* Product list */}
            <div className="overflow-y-auto px-4 pb-8 max-h-[45vh]">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0"
                >
                  {product.imageUrl && (
                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 relative bg-white/5">
                      <Image src={product.imageUrl} alt={product.name} fill className="object-cover" sizes="64px" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{product.name}</p>
                    <p className="text-hot-pink font-black text-base">{product.price.toLocaleString()}원</p>
                    <p className="text-white/40 text-xs">재고 {product.stock}개</p>
                  </div>
                  <button
                    onClick={() => onAddToCart(product.id)}
                    className="px-4 py-2 bg-hot-pink text-white text-sm font-bold rounded-full hover:bg-hot-pink/80 active:scale-95 transition-all flex-shrink-0"
                  >
                    담기
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
