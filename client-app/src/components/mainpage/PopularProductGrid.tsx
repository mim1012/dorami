'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Package } from 'lucide-react';
import { formatPrice } from '@/lib/utils/price';
import type { PopularProductDto } from '@live-commerce/shared-types';
import { ProductDetailSheet } from './ProductDetailSheet';

interface PopularProductGridProps {
  products: PopularProductDto[];
}

export function PopularProductGrid({ products }: PopularProductGridProps) {
  const [selectedProduct, setSelectedProduct] = useState<PopularProductDto | null>(null);

  if (products.length === 0) return null;

  return (
    <section className="px-4 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-[#FF6B35] to-[#7928CA]" />
          <h2 className="text-xl font-black text-gray-900">라이브 인기 상품</h2>
        </div>
      </div>

      <div
        data-testid="popular-grid"
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
      >
        {products.map((product, index) => (
          <div
            key={product.id}
            data-testid="product-card"
            className="group cursor-pointer rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm active:scale-[0.97] transition-transform animate-stagger-fade hover:border-pink-200"
            style={{ animationDelay: `${index * 60}ms` }}
            onClick={() => setSelectedProduct(product)}
          >
            <div className="relative aspect-square bg-gray-50 overflow-hidden">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 480px) 33vw, 200px"
                  unoptimized={product.imageUrl.startsWith('/uploads/')}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-8 h-8 text-gray-300" />
                </div>
              )}

              {/* Badges */}
              <div className="absolute top-2 left-2 flex flex-col gap-1">
                {product.isNew && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-pink-500 text-white">
                    NEW
                  </span>
                )}
                {product.discountRate && product.discountRate > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500 text-white">
                    -{product.discountRate}%
                  </span>
                )}
              </div>

              {/* soldCount badge */}
              {product.soldCount > 0 && (
                <div className="absolute top-2 right-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-800/70 text-white">
                    {product.soldCount >= 1000
                      ? `${(product.soldCount / 1000).toFixed(1)}k 판매`
                      : `${product.soldCount} 판매`}
                  </span>
                </div>
              )}
            </div>

            <div className="p-2">
              <p className="text-xs text-gray-800 font-semibold line-clamp-2 mb-1 group-hover:text-pink-500 transition-colors">
                {product.name}
              </p>
              <div className="flex flex-col gap-0.5">
                {product.originalPrice && product.originalPrice > product.price && (
                  <span className="text-[10px] text-gray-400 line-through">
                    {formatPrice(product.originalPrice)}
                  </span>
                )}
                <div className="flex items-baseline gap-1">
                  {product.discountRate && product.discountRate > 0 && (
                    <span className="text-xs font-black text-red-500">{product.discountRate}%</span>
                  )}
                  <span className="text-sm font-black text-pink-500">
                    {formatPrice(product.price)}
                  </span>
                </div>
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
          }}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </section>
  );
}
