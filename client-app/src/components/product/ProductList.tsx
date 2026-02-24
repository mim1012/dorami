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
  products?: Product[];
}

export default function ProductList({
  streamKey,
  onProductClick,
  layout = 'vertical',
  products: externalProducts,
}: ProductListProps) {
  const [internalProducts, setInternalProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(!externalProducts);
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
  const [socket, setSocket] = useState<Socket | null>(null);

  const products = externalProducts ?? internalProducts;

  useEffect(() => {
    if (externalProducts) return;
    fetchProducts();
  }, [streamKey, externalProducts]);

  useEffect(() => {
    if (externalProducts) return;

    const ws = io(
      process.env.NEXT_PUBLIC_WS_URL ||
        (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001'),
      {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
      },
    );

    setSocket(ws);

    const timeoutIds: ReturnType<typeof setTimeout>[] = [];

    ws.on('connect', () => {
      ws.emit('join:stream', { streamId: streamKey });
    });

    ws.on('live:product:added', (data: { type: string; data: Product }) => {
      setInternalProducts((prev) => {
        if (prev.some((p) => p.id === data.data.id)) return prev;
        return [data.data, ...prev];
      });
      const id = data.data.id;
      setNewlyAddedIds((prev) => new Set(prev).add(id));
      const tid = setTimeout(() => {
        setNewlyAddedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 5000);
      timeoutIds.push(tid);
    });

    ws.on('live:product:updated', (data: { type: string; data: Product }) => {
      setInternalProducts((prev) => prev.map((p) => (p.id === data.data.id ? data.data : p)));
    });

    ws.on('live:product:soldout', (data: { type: string; data: { productId: string } }) => {
      setInternalProducts((prev) =>
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
      },
    );

    return () => {
      ws.emit('leave:stream', { streamId: streamKey });
      ws.disconnect();
      timeoutIds.forEach(clearTimeout);
    };
  }, [streamKey, externalProducts]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<Product[]>('/products', {
        params: { streamKey, status: 'AVAILABLE' },
      });
      setInternalProducts(response.data);
    } catch (error) {
      console.error('[Products] Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Loading skeleton ────────────────────────────────────────────────────────
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
      <div className="p-3 space-y-2.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-14 h-14 rounded-xl bg-white/8 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-white/8 rounded w-3/4" />
              <div className="h-3 bg-white/8 rounded w-1/2" />
              <div className="h-3 bg-white/8 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Horizontal layout ───────────────────────────────────────────────────────
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
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover"
                    unoptimized={product.imageUrl.startsWith('/uploads/')}
                  />
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
                ${product.price.toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    );
  }

  // ── Vertical layout — compact rows ─────────────────────────────────────────
  return (
    <div className="p-3">
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-white/20"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <p className="text-white/40 text-xs font-medium leading-relaxed">
            라이브 방송 중<br />
            상품이 등록됩니다
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((product, index) => {
            const isNew = newlyAddedIds.has(product.id);
            const isSoldOut = product.status === 'SOLD_OUT';
            const isLowStock = !isSoldOut && product.stock > 0 && product.stock < 5;

            return (
              <div
                key={product.id}
                onClick={() => !isSoldOut && onProductClick?.(product)}
                className={`
                  relative flex items-center gap-3 p-2.5 rounded-2xl transition-all duration-300 border
                  ${
                    isNew
                      ? 'border-[#FF007A]/50 bg-[#FF007A]/8 shadow-[0_0_16px_rgba(255,0,122,0.12)]'
                      : isSoldOut
                        ? 'border-white/5 bg-white/3 opacity-55 cursor-not-allowed'
                        : 'border-white/8 bg-white/4 hover:border-[#FF007A]/30 hover:bg-white/8 cursor-pointer'
                  }
                `}
              >
                {/* Index badge */}
                <span className="absolute -top-1.5 -left-1 w-5 h-5 rounded-full bg-[#0A0A0A] border border-white/10 text-[9px] font-black text-white/35 flex items-center justify-center tabular-nums">
                  {index + 1}
                </span>

                {/* Thumbnail */}
                <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-white/5">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover"
                      unoptimized={product.imageUrl.startsWith('/uploads/')}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-white/20 text-[9px]">No Image</span>
                    </div>
                  )}
                  {isSoldOut && (
                    <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                      <span className="text-white font-black text-[10px]">품절</span>
                    </div>
                  )}
                  {isLowStock && !isSoldOut && (
                    <div className="absolute bottom-0 inset-x-0 bg-orange-500/80 text-white text-[8px] font-bold text-center py-0.5">
                      {product.stock}개 남음
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-white/90 text-[11px] font-semibold truncate leading-tight">
                      {product.name}
                    </p>
                    {isNew && (
                      <span className="flex-shrink-0 text-[8px] font-black text-white bg-[#FF007A] px-1.5 py-0.5 rounded-full leading-none tracking-wide">
                        NEW
                      </span>
                    )}
                  </div>

                  {product.discountRate && product.discountRate > 0 ? (
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-white/25 text-[10px] line-through">
                        ${(product.originalPrice ?? product.price).toLocaleString()}
                      </span>
                      <span className="text-red-400 text-[10px] font-bold">
                        {product.discountRate}%↓
                      </span>
                    </div>
                  ) : null}

                  <p className="text-[#FF007A] text-[13px] font-black leading-none">
                    ${product.price.toLocaleString()}
                  </p>

                  <div className="flex items-center gap-1.5 mt-1">
                    {product.freeShippingMessage && (
                      <span className="text-emerald-400/80 text-[9px] font-medium">
                        {product.freeShippingMessage}
                      </span>
                    )}
                    {!product.freeShippingMessage && !isSoldOut && (
                      <span
                        className={`text-[9px] font-medium ${
                          isLowStock ? 'text-orange-400' : 'text-white/25'
                        }`}
                      >
                        재고 {product.stock}개
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick buy button */}
                {!isSoldOut && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onProductClick?.(product);
                    }}
                    className="flex-shrink-0 w-8 h-8 rounded-full bg-[#FF007A] flex items-center justify-center hover:bg-[#E00070] active:scale-90 transition-all"
                    aria-label={`${product.name} 상세보기`}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2.5"
                    >
                      <path
                        d="M5 12h14M12 5l7 7-7 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
