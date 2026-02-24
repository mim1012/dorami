'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Star, ChevronDown, ChevronUp, X, Loader2 } from 'lucide-react';
import {
  getFeaturedProduct,
  setFeaturedProduct,
  clearFeaturedProduct,
  getStreamProducts,
  FeaturedProduct,
} from '@/lib/api/featured-products';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { formatPrice } from '@/lib/utils/price';

interface FeaturedProductManagerProps {
  streamKey: string;
  streamTitle: string;
}

export default function FeaturedProductManager({
  streamKey,
  streamTitle,
}: FeaturedProductManagerProps) {
  const confirm = useConfirm();
  const [currentFeatured, setCurrentFeatured] = useState<FeaturedProduct | null>(null);
  const [availableProducts, setAvailableProducts] = useState<FeaturedProduct[]>([]);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load data on mount and when streamKey changes
  useEffect(() => {
    loadData();
  }, [streamKey]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load current featured product and available products in parallel
      const [featured, products] = await Promise.all([
        getFeaturedProduct(streamKey),
        getStreamProducts(streamKey),
      ]);

      setCurrentFeatured(featured);
      setAvailableProducts(products);
    } catch (err: any) {
      console.error('Failed to load featured product data:', err);
      setError(err?.message || '데이터를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetFeatured = async (productId: string) => {
    try {
      setIsUpdating(true);
      setError(null);

      const product = await setFeaturedProduct(streamKey, productId);
      setCurrentFeatured(product);
      setShowProductSelector(false);
    } catch (err: any) {
      console.error('Failed to set featured product:', err);
      setError(err?.message || '추천 상품 설정에 실패했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClearFeatured = async () => {
    const confirmed = await confirm({
      title: '추천 해제',
      message: '추천 상품을 해제하시겠습니까?',
      confirmText: '해제',
      variant: 'warning',
    });
    if (!confirmed) {
      return;
    }

    try {
      setIsUpdating(true);
      setError(null);

      await clearFeaturedProduct(streamKey);
      setCurrentFeatured(null);
    } catch (err: any) {
      console.error('Failed to clear featured product:', err);
      setError(err?.message || '추천 상품 해제에 실패했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-content-bg rounded-lg p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-hot-pink" />
          <span className="ml-2 text-secondary-text">로딩 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-content-bg rounded-lg p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-primary-text flex items-center gap-2">
            <Star className="w-5 h-5 text-hot-pink" />
            {streamTitle} - 추천 상품
          </h3>
          <p className="text-sm text-secondary-text mt-1">
            라이브 방송 중 강조할 상품을 설정하세요
          </p>
        </div>
        {currentFeatured ? (
          <button
            onClick={() => setShowProductSelector(!showProductSelector)}
            disabled={isUpdating}
            className="px-4 py-2 bg-hot-pink/10 text-hot-pink rounded-lg hover:bg-hot-pink/20 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            변경
            {showProductSelector ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        ) : (
          <button
            onClick={() => setShowProductSelector(!showProductSelector)}
            disabled={isUpdating}
            className="px-4 py-2 bg-hot-pink text-white rounded-lg hover:bg-hot-pink/90 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Star className="w-4 h-4" />
            추천 상품 설정
            {showProductSelector ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-error-bg border border-error/20 rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm text-error">{error}</p>
          <button onClick={() => setError(null)} className="text-error hover:text-error/80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Current Featured Product Display */}
      {currentFeatured && (
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <div className="flex items-start gap-4">
            <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
              <Image
                src={currentFeatured.imageUrl || '/placeholder-product.png'}
                alt={currentFeatured.name}
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-semibold text-primary-text mb-1 truncate">
                {currentFeatured.name}
              </h4>
              <p className="text-lg font-bold text-hot-pink mb-2">
                {formatPrice(currentFeatured.price)}
              </p>
              <div className="flex items-center gap-4 text-sm text-secondary-text">
                <span>재고: {currentFeatured.stock}개</span>
                {currentFeatured.status && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      currentFeatured.status === 'ACTIVE'
                        ? 'bg-success/10 text-success'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {currentFeatured.status === 'ACTIVE' ? '판매중' : '판매중지'}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleClearFeatured}
              disabled={isUpdating}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : '해제'}
            </button>
          </div>
        </div>
      )}

      {/* Product Selector */}
      {showProductSelector && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-semibold text-primary-text mb-3">상품 선택</h4>

          {availableProducts.length === 0 ? (
            <div className="text-center py-8 text-secondary-text">
              <p>등록된 상품이 없습니다.</p>
              <p className="text-sm mt-1">먼저 상품을 등록해주세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
              {availableProducts.map((product) => {
                const isOutOfStock = product.stock <= 0;
                const isCurrent = currentFeatured?.id === product.id;

                return (
                  <div
                    key={product.id}
                    className={`border rounded-lg p-3 flex items-start gap-3 transition-colors ${
                      isCurrent
                        ? 'border-hot-pink bg-hot-pink/5'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    } ${isOutOfStock ? 'opacity-60' : ''}`}
                  >
                    <div className="relative w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-gray-100">
                      <Image
                        src={product.imageUrl || '/placeholder-product.png'}
                        alt={product.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-sm font-semibold text-primary-text mb-1 truncate">
                        {product.name}
                      </h5>
                      <p className="text-sm font-bold text-hot-pink mb-1">
                        {formatPrice(product.price)}
                      </p>
                      <p className="text-xs text-secondary-text">
                        재고: {product.stock}개{isOutOfStock && ' (품절)'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleSetFeatured(product.id)}
                      disabled={isUpdating || isOutOfStock || isCurrent}
                      className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        isCurrent
                          ? 'bg-hot-pink/20 text-hot-pink'
                          : 'bg-hot-pink text-white hover:bg-hot-pink/90'
                      }`}
                    >
                      {isUpdating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : isCurrent ? (
                        '선택됨'
                      ) : (
                        '선택'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
