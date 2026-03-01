'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Package } from 'lucide-react';
import { formatPrice } from '@/lib/utils/price';
import type { LiveDealProductDto } from '@live-commerce/shared-types';
import { ProductDetailSheet } from './ProductDetailSheet';

interface LiveExclusiveDealsProps {
  products: LiveDealProductDto[];
}

export function LiveExclusiveDeals({ products }: LiveExclusiveDealsProps) {
  const [selectedProduct, setSelectedProduct] = useState<LiveDealProductDto | null>(null);

  if (products.length === 0) return null;

  return (
    <section className="px-4 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-[#FF4D8D] to-[#FF6B35]" />
          <h2 className="text-xl font-black text-gray-900">방송 관전 특가</h2>
          <span className="px-2.5 py-1 text-xs font-bold bg-pink-100 text-pink-500 rounded-full border border-pink-200">
            {products.length}
          </span>
        </div>
        <span className="flex items-center gap-1 text-xs text-[#FF3B30] font-bold animate-pulse-live">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FF3B30]" />
          LIVE 한정
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="group cursor-pointer rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-sm active:scale-[0.97] transition-transform hover:border-gray-300"
            onClick={() => setSelectedProduct(product)}
          >
            <div className="relative aspect-square bg-gray-50 overflow-hidden">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 480px) 50vw, 240px"
                  unoptimized={product.imageUrl.startsWith('/uploads/')}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-8 h-8 text-gray-400 opacity-50" />
                </div>
              )}
              {product.discountRate && product.discountRate > 0 && (
                <div className="absolute top-2 left-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500 text-white">
                    -{product.discountRate}%
                  </span>
                </div>
              )}
              {product.stock <= 5 && product.stock > 0 && (
                <div className="absolute bottom-2 left-2 right-2">
                  <span className="block text-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/60 text-[#FF9500]">
                    잔여 {product.stock}개
                  </span>
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-xs text-gray-800 font-semibold line-clamp-2 mb-1.5">
                {product.name}
              </p>
              <div className="flex flex-col gap-0.5">
                {product.originalPrice && product.originalPrice > product.price && (
                  <span className="text-[10px] text-gray-400 line-through">
                    {formatPrice(product.originalPrice)}
                  </span>
                )}
                <span className="text-base font-black text-pink-500">
                  {formatPrice(product.price)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedProduct && (
        <ProductDetailSheet
          product={{
            id: selectedProduct.id,
            name: selectedProduct.name,
            price: selectedProduct.price,
            originalPrice: selectedProduct.originalPrice ?? undefined,
            discountRate: selectedProduct.discountRate ?? undefined,
            imageUrl: selectedProduct.imageUrl ?? undefined,
            stock: selectedProduct.stock,
          }}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </section>
  );
}
