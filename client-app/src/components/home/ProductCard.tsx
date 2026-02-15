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
  size = 'normal',
}: ProductCardProps) {
  const discountedPrice = discount ? price * (1 - discount / 100) : price;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-2xl overflow-hidden bg-white border border-border-color shadow-sm active:scale-[0.97]"
    >
      {/* Image container */}
      <div className="relative aspect-[4/3] bg-content-bg overflow-hidden">
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
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Info section */}
      <div className="p-3.5">
        <h3 className="text-sm text-primary-text font-bold mb-2 line-clamp-2 leading-snug group-hover:text-hot-pink transition-colors duration-300">
          {name}
        </h3>
        <div className="flex flex-col gap-0.5">
          {discount !== undefined && discount > 0 && (
            <span className="text-xs text-secondary-text line-through">
              <span className="sr-only">정가 </span>
              {price.toLocaleString()}원
            </span>
          )}
          <div className="flex items-baseline gap-1">
            {discount !== undefined && discount > 0 && (
              <span className="text-sm font-black text-error">
                <span className="sr-only">할인율 </span>
                {discount}%
              </span>
            )}
            <span className="text-lg font-black text-hot-pink tracking-tight">
              <span className="sr-only">판매가 </span>
              {discountedPrice.toLocaleString()}
              <span className="text-sm font-bold">원</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
