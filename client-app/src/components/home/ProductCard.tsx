'use client';

import Image from 'next/image';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  isNew?: boolean;
  discount?: number;
  likes?: number;
  rating?: number;
  onClick?: () => void;
  size?: 'normal' | 'small';
}

export function ProductCard({
  name,
  price,
  imageUrl,
  isNew = false,
  discount,
  likes = 0,
  rating = 0,
  onClick,
  size = 'normal',
}: ProductCardProps) {
  const discountedPrice = discount ? price * (1 - discount / 100) : price;

  return (
    <div
      onClick={onClick}
      className={`card cursor-pointer ${size === 'small' ? 'scale-[0.95]' : ''}`}
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
      <div className="p-4">
        <h3 className="text-body text-primary-text font-semibold mb-2 line-clamp-2">{name}</h3>
        <div className="flex items-center gap-2 mb-2">
          {discount && (
            <span className="text-caption text-secondary-text line-through">
              {price.toLocaleString()}원
            </span>
          )}
          <span className="text-h2 text-hot-pink font-bold">
            {discountedPrice.toLocaleString()}원
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-secondary-text">
          <span>❤️ {likes}</span>
          <span>⭐ {rating.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}
