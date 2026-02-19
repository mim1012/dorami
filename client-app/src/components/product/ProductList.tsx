'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { io, Socket } from 'socket.io-client';
import { apiClient } from '@/lib/api/client';
import type { Product } from '@/lib/types';
import { ProductStatus } from '@/lib/types';

interface ProductListProps {
  streamKey: string;
  onProductClick?: (product: Product) => void;
  layout?: 'vertical' | 'horizontal';
}

export default function ProductList({
  streamKey,
  onProductClick,
  layout = 'vertical',
}: ProductListProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Fetch products initially
  useEffect(() => {
    fetchProducts();
  }, [streamKey]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const ws = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001', {
      transports: ['websocket'],
      auth: {
        token: typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null,
      },
    });

    setSocket(ws);

    ws.on('connect', () => {
      console.log('[Products] WebSocket connected');
      // Join stream room to receive product updates
      ws.emit('join:stream', { streamId: streamKey });
    });

    ws.on('disconnect', () => {
      console.log('[Products] WebSocket disconnected');
    });

    // Listen for product events
    ws.on('live:product:added', (data: { type: string; data: Product }) => {
      console.log('[Products] New product added:', data.data);
      setProducts((prev) => [data.data, ...prev]);
    });

    ws.on('live:product:updated', (data: { type: string; data: Product }) => {
      console.log('[Products] Product updated:', data.data);
      setProducts((prev) => prev.map((p) => (p.id === data.data.id ? data.data : p)));
    });

    ws.on('live:product:soldout', (data: { type: string; data: { productId: string } }) => {
      console.log('[Products] Product sold out:', data.data.productId);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === data.data.productId ? { ...p, status: ProductStatus.SOLD_OUT } : p,
        ),
      );
    });

    ws.on(
      'product:low-stock',
      (data: {
        type: string;
        data: { productId: string; productName: string; remainingStock: number };
      }) => {
        console.log('[Products] Low stock warning:', data.data);
        // Could show a toast notification here
      },
    );

    return () => {
      if (ws) {
        ws.emit('leave:stream', { streamId: streamKey });
        ws.disconnect();
      }
    };
  }, [streamKey]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<Product[]>('/products', {
        params: { streamKey, status: 'AVAILABLE' },
      });
      setProducts(response.data);
    } catch (error) {
      console.error('[Products] Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    if (layout === 'horizontal') {
      return (
        <div className="flex flex-row overflow-x-auto gap-3 px-3 py-2 scrollbar-none">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-[120px] shrink-0 animate-pulse">
              <div className="w-full aspect-square rounded-lg bg-white/10 mb-2" />
              <div className="h-3 bg-white/10 rounded mb-1" />
              <div className="h-3 bg-white/10 rounded w-2/3" />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-content-bg rounded-card h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (layout === 'horizontal') {
    return (
      <div className="flex flex-row overflow-x-auto gap-3 px-3 py-2 scrollbar-none">
        {products.length === 0 ? (
          <p className="text-white/40 text-xs py-2">등록된 상품이 없습니다</p>
        ) : (
          products.map((product) => (
            <div
              key={product.id}
              className={`w-[120px] shrink-0 cursor-pointer ${product.status === 'SOLD_OUT' ? 'opacity-60' : ''}`}
              onClick={() => product.status === 'AVAILABLE' && onProductClick?.(product)}
            >
              <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-white/10 mb-1.5">
                {product.imageUrl ? (
                  <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-white/30 text-xs">No Image</span>
                  </div>
                )}
                {product.status === 'SOLD_OUT' && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <span className="text-white font-bold text-xs">품절</span>
                  </div>
                )}
              </div>
              <p className="text-white text-[11px] font-medium truncate">{product.name}</p>
              <p className="text-[#FF007A] text-[11px] font-bold">
                ₩{product.price.toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-h2 text-hot-pink mb-4 font-bold">Products</h2>

      {products.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-secondary-text text-caption">
            라이브 방송 중<br />
            상품이 등록됩니다
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <div
              key={product.id}
              className={`
                bg-primary-black rounded-card p-3 cursor-pointer transition-colors border
                ${
                  product.status === 'SOLD_OUT'
                    ? 'border-border-color opacity-60'
                    : 'border-border-color hover:border-hot-pink hover:bg-content-bg'
                }
              `}
              onClick={() => product.status === 'AVAILABLE' && onProductClick?.(product)}
            >
              <div className="relative w-full aspect-square mb-2 rounded overflow-hidden bg-primary-black">
                {product.imageUrl ? (
                  <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-content-bg">
                    <span className="text-secondary-text text-sm">No Image</span>
                  </div>
                )}
                {product.status === 'SOLD_OUT' && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">품절</span>
                  </div>
                )}
              </div>
              <h3 className="text-caption text-primary-text truncate mb-1">{product.name}</h3>
              <div className="flex items-center justify-between">
                {product.discountRate && product.discountRate > 0 ? (
                  <div>
                    <span className="text-small text-secondary-text line-through mr-1">
                      ₩{(product.originalPrice ?? product.price).toLocaleString()}
                    </span>
                    <span className="text-small text-error font-bold">{product.discountRate}%</span>
                    <p className="text-body text-hot-pink font-bold">
                      ₩{product.price.toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <p className="text-body text-hot-pink font-bold">
                    ₩{product.price.toLocaleString()}
                  </p>
                )}
                <p
                  className={`text-small ${product.stock < 5 ? 'text-warning' : 'text-secondary-text'}`}
                >
                  재고 {product.stock}
                </p>
              </div>
              {product.freeShippingMessage && (
                <p className="text-small text-success mt-1">{product.freeShippingMessage}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
