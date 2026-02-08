'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { io, Socket } from 'socket.io-client';
import { apiClient } from '@/lib/api/client';

interface Product {
  id: string;
  streamKey: string;
  name: string;
  price: number;
  stock: number;
  colorOptions: string[];
  sizeOptions: string[];
  shippingFee: number;
  freeShippingMessage?: string;
  timerEnabled: boolean;
  timerDuration: number;
  imageUrl?: string;
  status: 'AVAILABLE' | 'SOLD_OUT';
  createdAt: string;
  updatedAt: string;
}

interface ProductListProps {
  streamKey: string;
  onProductClick?: (product: Product) => void;
}

export default function ProductList({ streamKey, onProductClick }: ProductListProps) {
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
      ws.emit('stream:join', { streamKey });
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
      setProducts((prev) =>
        prev.map((p) => (p.id === data.data.id ? data.data : p))
      );
    });

    ws.on('live:product:soldout', (data: { type: string; data: { productId: string } }) => {
      console.log('[Products] Product sold out:', data.data.productId);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === data.data.productId ? { ...p, status: 'SOLD_OUT' as const } : p
        )
      );
    });

    ws.on('product:low-stock', (data: { type: string; data: { productId: string; productName: string; remainingStock: number } }) => {
      console.log('[Products] Low stock warning:', data.data);
      // Could show a toast notification here
    });

    return () => {
      if (ws) {
        ws.emit('stream:leave', { streamKey });
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
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-800 rounded-card h-32" />
          ))}
        </div>
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
                ${product.status === 'SOLD_OUT'
                  ? 'border-gray-800 opacity-60'
                  : 'border-gray-800 hover:border-hot-pink hover:bg-gray-800'
                }
              `}
              onClick={() => product.status === 'AVAILABLE' && onProductClick?.(product)}
            >
              <div className="relative w-full aspect-square mb-2 rounded overflow-hidden bg-gray-900">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800">
                    <span className="text-gray-600 text-sm">No Image</span>
                  </div>
                )}
                {product.status === 'SOLD_OUT' && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">품절</span>
                  </div>
                )}
              </div>
              <h3 className="text-caption text-primary-text truncate mb-1">
                {product.name}
              </h3>
              <div className="flex items-center justify-between">
                <p className="text-body text-hot-pink font-bold">
                  ₩{product.price.toLocaleString()}
                </p>
                <p className={`text-small ${product.stock < 5 ? 'text-warning' : 'text-secondary-text'}`}>
                  재고 {product.stock}
                </p>
              </div>
              {product.freeShippingMessage && (
                <p className="text-small text-success mt-1">
                  {product.freeShippingMessage}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
