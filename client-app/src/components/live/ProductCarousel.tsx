'use client';

import { useState, useRef, useEffect } from 'react';
import { Body, Heading2 } from '@/components/common/Typography';
import { ShoppingBag, AlertCircle } from 'lucide-react';

export interface LiveProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  status: 'AVAILABLE' | 'SOLD_OUT';
  imageUrl?: string;
  metadata?: any;
}

interface ProductCarouselProps {
  streamKey: string;
  products: LiveProduct[];
  onProductClick: (product: LiveProduct) => void;
}

export function ProductCarousel({ streamKey, products, onProductClick }: ProductCarouselProps) {
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(price);
  };

  const getStockStatus = (product: LiveProduct) => {
    if (product.status === 'SOLD_OUT' || product.stock === 0) {
      return { text: '품절', color: 'text-error', bgColor: 'bg-error/20' };
    }
    if (product.stock < 5) {
      return { text: `재고 ${product.stock}개`, color: 'text-warning', bgColor: 'bg-warning/20' };
    }
    return { text: '구매 가능', color: 'text-success', bgColor: 'bg-success/20' };
  };

  if (products.length === 0) {
    return (
      <div className="w-full bg-gradient-to-r from-white/80 to-white/90 backdrop-blur-sm rounded-2xl p-6 border border-gray-200">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <ShoppingBag className="w-12 h-12 text-secondary-text mb-3 opacity-50" />
          <Body className="text-secondary-text">
            라이브 중 소개될 상품을 기다려주세요
          </Body>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-r from-white/80 to-white/90 backdrop-blur-sm rounded-2xl p-4 border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-hot-pink" />
          <Heading2 className="text-hot-pink">
            라이브 상품
          </Heading2>
        </div>
        <Body className="text-secondary-text text-xs">
          {products.length}개
        </Body>
      </div>

      {/* Horizontal Scroll Container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {products.map((product) => {
          const stockStatus = getStockStatus(product);
          const isUnavailable = product.status === 'SOLD_OUT' || product.stock === 0;

          return (
            <button
              key={product.id}
              onClick={() => !isUnavailable && onProductClick(product)}
              disabled={isUnavailable}
              className="flex-shrink-0 w-[200px] bg-content-bg hover:bg-white/10 rounded-xl overflow-hidden transition-all hover:scale-105 disabled:hover:scale-100 disabled:opacity-60 disabled:cursor-not-allowed border border-gray-200 hover:border-hot-pink/50"
            >
              {/* Product Image */}
              <div className="relative aspect-square bg-primary-black overflow-hidden">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="w-16 h-16 text-secondary-text opacity-30" />
                  </div>
                )}

                {/* Stock Badge */}
                <div className="absolute top-2 right-2">
                  <div className={`${stockStatus.bgColor} ${stockStatus.color} text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm`}>
                    {stockStatus.text}
                  </div>
                </div>

                {/* Sold Out Overlay */}
                {isUnavailable && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <Body className="text-error font-bold text-lg">
                      품절
                    </Body>
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-3 text-left">
                <Body className="text-primary-text font-semibold line-clamp-2 mb-1 text-sm">
                  {product.name}
                </Body>
                <Body className="text-hot-pink font-bold text-base">
                  {formatPrice(product.price)}
                </Body>
                {product.description && (
                  <Body className="text-secondary-text text-xs line-clamp-2 mt-1">
                    {product.description}
                  </Body>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Scroll Indicator */}
      {products.length > 2 && (
        <div className="flex justify-center mt-2 gap-1">
          {Array.from({ length: Math.ceil(products.length / 2) }).map((_, index) => (
            <div
              key={index}
              className="w-1.5 h-1.5 rounded-full bg-white/20"
            />
          ))}
        </div>
      )}
    </div>
  );
}
