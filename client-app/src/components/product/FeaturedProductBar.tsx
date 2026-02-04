'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { apiClient } from '@/lib/api/client';
import { io, Socket } from 'socket.io-client';

interface FeaturedProduct {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  stock: number;
  colorOptions: string[];
  sizeOptions: string[];
  status: string;
}

interface FeaturedProductBarProps {
  streamKey: string;
  onProductClick?: (product: FeaturedProduct) => void;
}

export default function FeaturedProductBar({
  streamKey,
  onProductClick
}: FeaturedProductBarProps) {
  const [product, setProduct] = useState<FeaturedProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedProduct();
    setupWebSocket();
  }, [streamKey]);

  const fetchFeaturedProduct = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get<{ product: FeaturedProduct | null }>(
        `/streaming/key/${streamKey}/featured-product`
      );
      setProduct(response.data.product);
    } catch (error) {
      console.error('Failed to fetch featured product:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupWebSocket = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const ws = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
      auth: { token },
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
      className="fixed bottom-0 left-0 right-0 bg-content-bg/95 backdrop-blur-md border-t border-gray-800 p-4 z-20 cursor-pointer hover:bg-content-bg transition-colors"
      onClick={() => onProductClick?.(product)}
    >
      <div className="flex items-center gap-4 max-w-screen-xl mx-auto">
        <div className="relative w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-gray-900">
          {product.imageUrl && (
            <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-body text-primary-text font-semibold truncate">{product.name}</h3>
          <div className="flex items-center gap-2">
            <p className="text-h2 text-hot-pink font-bold">₩{product.price.toLocaleString()}</p>
            <p className="text-small text-secondary-text">재고 {product.stock}</p>
          </div>
        </div>
        <button
          className="px-6 py-2 bg-hot-pink text-white rounded-button hover:bg-hot-pink-dark transition-colors font-semibold"
          disabled={product.status === 'SOLD_OUT'}
        >
          구매하기
        </button>
      </div>
    </div>
  );
}
