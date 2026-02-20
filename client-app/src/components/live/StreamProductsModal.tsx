'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, ShoppingBag } from 'lucide-react';
import { getProductsByStreamKey, type Product } from '@/lib/api/products';

interface StreamProductsModalProps {
  streamKey: string;
  streamTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(price);

export function StreamProductsModal({
  streamKey,
  streamTitle,
  isOpen,
  onClose,
}: StreamProductsModalProps) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);
    getProductsByStreamKey(streamKey)
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, streamKey]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[80] bg-[#111] rounded-2xl shadow-2xl max-h-[80vh] flex flex-col max-w-lg mx-auto">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <p className="text-xs text-white/50 mb-0.5">방송 상품 목록</p>
            <h2 className="text-base font-bold text-white line-clamp-1">{streamTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors flex-shrink-0 ml-3"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#FF2D6B] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && products.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-white/40">
              <ShoppingBag className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">등록된 상품이 없습니다</p>
            </div>
          )}

          {!loading &&
            products.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 bg-white/5 rounded-xl p-3 hover:bg-white/10 transition-colors"
              >
                {/* Thumbnail */}
                <div className="flex-shrink-0 w-16 h-16 bg-white/10 rounded-xl overflow-hidden">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag className="w-7 h-7 text-white/20" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{product.name}</p>
                  <p className="text-[#FF2D6B] font-bold text-sm mt-0.5">
                    {formatPrice(product.price)}
                  </p>
                  <p
                    className={`text-xs mt-0.5 ${product.stock <= 3 ? 'text-orange-400' : 'text-white/40'}`}
                  >
                    {product.stock <= 3
                      ? `⚠️ 재고 ${product.stock}개 남음`
                      : `재고 ${product.stock}개`}
                  </p>
                </div>

                {/* CTA */}
                <button
                  onClick={() => {
                    onClose();
                    router.push(`/live/${streamKey}`);
                  }}
                  className="flex-shrink-0 text-xs bg-[#FF2D6B] hover:bg-[#FF2D6B]/90 text-white font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                >
                  라이브에서 보기
                </button>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
