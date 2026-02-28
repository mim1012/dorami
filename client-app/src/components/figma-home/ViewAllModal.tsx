'use client';

import { X, TrendingUp, Sparkles } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number | null;
  discountRate?: number | null;
  tag?: string;
  image: string;
  host?: string;
}

interface ViewAllModalProps {
  title: string;
  type: 'popular' | 'new';
  products: Product[];
  onClose: () => void;
  onProductClick: (product: Product) => void;
}

export function ViewAllModal({
  title,
  type,
  products,
  onClose,
  onProductClick,
}: ViewAllModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white w-full md:max-w-5xl md:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            {type === 'popular' ? (
              <TrendingUp className="w-5 h-5 text-[#FF4D8D]" />
            ) : (
              <Sparkles className="w-5 h-5 text-[#B084CC]" />
            )}
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                onClick={() => {
                  onProductClick(product);
                  onClose();
                }}
                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer"
              >
                {type === 'popular' ? (
                  <>
                    <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
                      <ImageWithFallback
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {product.discountRate != null && (
                        <div className="absolute top-3 left-3 bg-[#FF4D8D] text-white px-3 py-1 rounded-full">
                          <span className="text-xs font-bold">{product.discountRate}%</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3 md:p-4">
                      <h4 className="font-semibold text-sm md:text-base text-gray-900 mb-2 line-clamp-2">
                        {product.name}
                      </h4>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base md:text-lg font-bold text-gray-900">
                          ₩{product.price.toLocaleString()}
                        </span>
                      </div>
                      {product.originalPrice != null && (
                        <span className="text-xs text-gray-400 line-through">
                          ₩{product.originalPrice.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
                      <ImageWithFallback
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {product.tag && (
                        <div className="absolute top-3 left-3">
                          <span className="bg-gradient-to-r from-[#FF4D8D] to-[#B084CC] text-white px-3 py-1 rounded-full text-xs font-bold">
                            {product.tag}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-3 md:p-4">
                      <h4 className="font-semibold text-sm md:text-base text-gray-900 mb-2 line-clamp-2">
                        {product.name}
                      </h4>
                      <p className="text-base md:text-lg font-bold text-gray-900">
                        ₩{product.price.toLocaleString()}
                      </p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
