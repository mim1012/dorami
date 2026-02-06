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
      className={`card cursor-pointer flex flex-col h-full ${
        size === 'small' ? 'scale-[0.95]' : ''
      }`}
    >
      <div className="relative aspect-square bg-primary-black rounded-t-xl overflow-hidden">
        <Image
          src={imageUrl}
          alt={name}
          fill
          className="object-cover rounded-t-xl"
          sizes="(max-width: 768px) 50vw, 33vw"
        />
        {isNew && (
          <div className="absolute top-2 left-2 bg-hot-pink text-white text-xs px-2 py-1 rounded font-bold">
            NEW
          </div>
        )}
        {discount && (
          <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded font-bold">
            -{discount}%
          </div>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <h3 className="text-sm text-primary-text font-semibold mb-2 line-clamp-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {name}
        </h3>
        <div className="flex flex-col gap-1.5 mt-auto">
          <div className="flex items-center gap-1.5 flex-wrap">
            {discount && (
              <span className="text-xs text-secondary-text line-through">
                {price.toLocaleString()}원
              </span>
            )}
            <span className="text-base text-hot-pink font-bold">
              {discountedPrice.toLocaleString()}원
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-secondary-text">
            <span>❤️ {Math.floor(Math.random() * 500 + 100)}</span>
            <span>⭐ {(Math.random() * 0.5 + 4.5).toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
