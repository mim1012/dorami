'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { apiClient } from '@/lib/api/client';
import { io, Socket } from 'socket.io-client';
import type { Product } from '@/lib/types';

type FeaturedProduct = Pick<
  Product,
  'id' | 'name' | 'price' | 'stock' | 'status' | 'colorOptions' | 'sizeOptions'
> & {
  imageUrl: string;
  originalPrice?: number;
  discountRate?: number;
};

interface FeaturedProductBarProps {
  streamKey: string;
  onProductClick?: (product: FeaturedProduct) => void;
}

export default function FeaturedProductBar({ streamKey, onProductClick }: FeaturedProductBarProps) {
  const [product, setProduct] = useState<FeaturedProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedProduct();
    const cleanupFn = setupWebSocket();
    return () => {
      cleanupFn?.();
    };
  }, [streamKey]);

  const fetchFeaturedProduct = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get<{ product: FeaturedProduct | null }>(
        `/streaming/key/${streamKey}/featured-product`,
      );
      setProduct(response.data.product);
    } catch (error) {
      console.error('Failed to fetch featured product:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupWebSocket = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) return;

    const ws = io(
      process.env.NEXT_PUBLIC_WS_URL ||
        (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001'),
      {
        auth: { token },
      },
    );

    ws.on('connect', () => {
      ws.emit('join:stream', { streamId: streamKey });
    });

    ws.on('stream:featured-product:updated', (data: any) => {
      if (data.streamKey === streamKey) {
        setProduct(data.product);
      }
    });

    return () => ws.disconnect();
  };

  if (isLoading || !product) return null;

  return (
    <div
      className="w-full bg-content-bg/95 backdrop-blur-md border-t border-border-color p-4 cursor-pointer hover:bg-content-bg transition-colors"
      onClick={() => onProductClick?.(product)}
    >
      <div className="flex items-center gap-4 max-w-screen-xl mx-auto">
        <div className="relative w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-primary-black">
          {product.imageUrl && (
            <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-body text-primary-text font-semibold truncate">{product.name}</h3>
          <div className="flex items-center gap-2">
            {product.discountRate && product.discountRate > 0 ? (
              <>
                <span className="text-small text-secondary-text line-through">
                  ${(product.originalPrice ?? product.price).toLocaleString()}
                </span>
                <span className="text-small text-error font-bold">{product.discountRate}%</span>
                <p className="text-h2 text-hot-pink font-bold">${product.price.toLocaleString()}</p>
              </>
            ) : (
              <p className="text-h2 text-hot-pink font-bold">${product.price.toLocaleString()}</p>
            )}
            <p className="text-small text-secondary-text">재고 {product.stock}</p>
          </div>
        </div>
        <button
          className={`px-6 py-2 rounded-button font-semibold transition-colors ${
            product.status === 'SOLD_OUT'
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-hot-pink text-white hover:bg-hot-pink-dark'
          }`}
          disabled={product.status === 'SOLD_OUT'}
          onClick={(e) => {
            e.stopPropagation();
            if (product.status !== 'SOLD_OUT') {
              onProductClick?.(product);
            }
          }}
        >
          {product.status === 'SOLD_OUT' ? '품절' : '구매하기'}
        </button>
      </div>
    </div>
  );
}
