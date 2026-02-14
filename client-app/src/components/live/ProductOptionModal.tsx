'use client';

import { useState, useEffect } from 'react';
import { LiveProduct } from './ProductCarousel';
import { Body, Heading2 } from '@/components/common/Typography';
import { X, Minus, Plus, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/common/Button';

interface ProductOptionModalProps {
  isOpen: boolean;
  product: LiveProduct | null;
  onClose: () => void;
  onAddToCart: (product: LiveProduct, quantity: number, options?: any) => void;
}

export function ProductOptionModal({
  isOpen,
  product,
  onClose,
  onAddToCart,
}: ProductOptionModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<any>({});

  useEffect(() => {
    if (isOpen && product) {
      setQuantity(1);
      setSelectedOptions({});
    }
  }, [isOpen, product]);

  if (!isOpen || !product) {
    return null;
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(price);
  };

  const totalPrice = product.price * quantity;
  const maxQuantity = Math.min(product.stock, 10); // Max 10 items per order
  const isAddToCartDisabled = quantity < 1 || quantity > maxQuantity || product.stock === 0;

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= maxQuantity) {
      setQuantity(newQuantity);
    }
  };

  const handleAddToCart = () => {
    if (!isAddToCartDisabled) {
      onAddToCart(product, quantity, selectedOptions);
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-content-bg rounded-t-3xl shadow-2xl animate-slide-up max-h-[85vh] flex flex-col">
        {/* Handle Bar */}
        <div className="flex-shrink-0 flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-border-color rounded-full" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border-color">
          <Heading2 className="text-primary-text">상품 옵션 선택</Heading2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-content-bg transition-colors"
          >
            <X className="w-5 h-5 text-secondary-text" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Product Info */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-24 h-24 bg-primary-black rounded-xl overflow-hidden">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag className="w-10 h-10 text-secondary-text opacity-30" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <Body className="text-primary-text font-semibold mb-1">
                {product.name}
              </Body>
              <Body className="text-hot-pink font-bold text-lg">
                {formatPrice(product.price)}
              </Body>
              <Body className="text-secondary-text text-xs mt-1">
                재고: {product.stock}개
              </Body>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div>
              <Body className="text-secondary-text text-sm leading-relaxed">
                {product.description}
              </Body>
            </div>
          )}

          {/* Options Section */}
          {product.metadata?.options && (
            <div className="space-y-3">
              <Body className="text-primary-text font-semibold">
                옵션 선택
              </Body>
              {/* Add option selection UI here based on product.metadata.options */}
              <div className="p-4 bg-primary-black/50 rounded-xl">
                <Body className="text-secondary-text text-sm text-center">
                  옵션 선택 기능은 추후 구현 예정입니다
                </Body>
              </div>
            </div>
          )}

          {/* Quantity Selector */}
          <div className="space-y-3">
            <Body className="text-primary-text font-semibold">
              수량 선택
            </Body>
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity <= 1}
                className="w-11 h-11 min-w-[44px] min-h-[44px] bg-primary-black hover:bg-content-bg disabled:opacity-30 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-colors"
              >
                <Minus className="w-5 h-5 text-primary-text" />
              </button>
              <div className="flex-1 text-center">
                <Body className="text-primary-text font-bold text-2xl">
                  {quantity}
                </Body>
              </div>
              <button
                onClick={() => handleQuantityChange(1)}
                disabled={quantity >= maxQuantity}
                className="w-11 h-11 min-w-[44px] min-h-[44px] bg-primary-black hover:bg-content-bg disabled:opacity-30 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-colors"
              >
                <Plus className="w-5 h-5 text-primary-text" />
              </button>
            </div>
            {quantity >= maxQuantity && (
              <Body className="text-warning text-xs text-center">
                최대 구매 가능 수량입니다
              </Body>
            )}
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-border-color bg-content-bg/90 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <Body className="text-secondary-text">총 금액</Body>
            <Heading2 className="text-hot-pink">
              {formatPrice(totalPrice)}
            </Heading2>
          </div>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleAddToCart}
            disabled={isAddToCartDisabled}
          >
            {product.stock === 0 ? '품절' : '장바구니에 담기'}
          </Button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }

        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  );
}
