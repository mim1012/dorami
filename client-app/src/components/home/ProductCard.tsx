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
      className={`bg-content-bg rounded-[12px] overflow-hidden cursor-pointer transition-transform hover:scale-105 active:scale-95 ${
        size === 'small' ? 'scale-[0.6] origin-center' : ''
      }`}
    >
      <div className="relative aspect-square bg-primary-black">
        <Image
          src={imageUrl}
          alt={name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, 33vw"
        />
        {isNew && (
          <div className="absolute top-2 left-2 bg-hot-pink text-white text-caption px-3 py-1 rounded-full font-medium">
            NEW
          </div>
        )}
        {discount && (
          <div className="absolute top-2 right-2 bg-error text-white text-caption px-3 py-1 rounded-full font-bold">
            {discount}%
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-body text-primary-text font-semibold mb-2 line-clamp-2">
          {name}
        </h3>
        <div className="flex items-center gap-2">
          {discount && (
            <span className="text-caption text-secondary-text line-through">
              {price.toLocaleString()}원
            </span>
          )}
          <span className="text-h2 text-hot-pink font-bold">
            {discountedPrice.toLocaleString()}원
          </span>
        </div>
      </div>
    </div>
  );
}
