'use client';

import Image from 'next/image';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  isNew?: boolean;
  discount?: number;
  onClick?: () => void;
  size?: 'normal' | 'small';
}

export function ProductCard({
  name,
  price,
  imageUrl,
  isNew = false,
  discount,
  onClick,
  size = 'normal'
}: ProductCardProps) {
  const discountedPrice = discount ? price * (1 - discount / 100) : price;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-sm active:scale-[0.97]"
    >
      {/* Image container */}
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        <Image
          src={imageUrl}
          alt={name}
          fill
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          sizes="(max-width: 768px) 50vw, 33vw"
        />
        
        {/* Gradient overlay — stronger on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Badges — stacked, vibrant */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
          {isNew && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-pink-600 text-white">
              NEW
            </span>
          )}
          {discount !== undefined && discount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-error text-white">
              -{discount}%
            </span>
          )}
        </div>

        {/* Quick add button — scale + slide on hover */}
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-3 group-hover:translate-y-0">
          <button
            className="w-11 h-11 rounded-full bg-hot-pink text-white flex items-center justify-center shadow-hot-pink hover:scale-110 active:scale-95 transition-transform"
            onClick={(e) => {
              e.stopPropagation();
            }}
            aria-label={`${name} 빠른 추가`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Info section */}
      <div className="p-3.5">
        <h3 className="text-sm text-gray-900 font-bold mb-2 line-clamp-2 leading-snug group-hover:text-hot-pink transition-colors duration-300">
          {name}
        </h3>
        <div className="flex flex-col gap-0.5">
          {discount !== undefined && discount > 0 && (
            <span className="text-xs text-secondary-text line-through">
              <span className="sr-only">정가 </span>{price.toLocaleString()}원
            </span>
          )}
          <div className="flex items-baseline gap-1">
            {discount !== undefined && discount > 0 && (
              <span className="text-sm font-black text-error"><span className="sr-only">할인율 </span>{discount}%</span>
            )}
            <span className="text-lg font-black text-hot-pink tracking-tight">
              <span className="sr-only">판매가 </span>{discountedPrice.toLocaleString()}
              <span className="text-sm font-bold">원</span>
            </span>
          </div>
        </div>
        {/* Social proof */}
        <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" /></svg>
            {Math.floor(Math.random() * 500 + 100)}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            {(Math.random() * 0.5 + 4.5).toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}
