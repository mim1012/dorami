'use client';

import Image from 'next/image';

interface ThumbnailStripProps {
  images: string[];
  productName: string;
  currentIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}

export function ThumbnailStrip({
  images,
  productName,
  currentIndex,
  onSelect,
  className = '',
}: ThumbnailStripProps) {
  if (images.length <= 1) return null;

  return (
    <div
      className={`flex gap-2 mt-2 px-1 overflow-x-auto scrollbar-thin scrollbar-thumb-border-color ${className}`}
      role="tablist"
      aria-label="상품 이미지 목록"
      data-testid="thumbnail-strip"
    >
      {images.map((src, idx) => {
        const isActive = idx === currentIndex;
        const isUpload = src.startsWith('/uploads/');
        return (
          <button
            key={idx}
            role="tab"
            aria-selected={isActive}
            aria-label={`${productName} 이미지 ${idx + 1}`}
            onClick={() => onSelect(idx)}
            className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all duration-150 ${
              isActive
                ? 'ring-2 ring-hot-pink ring-offset-1 ring-offset-content-bg opacity-100'
                : 'ring-1 ring-border-color opacity-60 hover:opacity-90 hover:ring-secondary-text'
            }`}
          >
            <Image
              src={src}
              alt={`${productName} 썸네일 ${idx + 1}`}
              fill
              className="object-cover"
              sizes="64px"
              unoptimized={isUpload}
            />
          </button>
        );
      })}
    </div>
  );
}
