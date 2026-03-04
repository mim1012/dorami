'use client';

import { useState, useEffect } from 'react';
import { X, Timer, Minus, Plus, Check } from 'lucide-react';
import { Heading2, Body, Caption } from '@/components/common/Typography';
import { Product, ProductStatus } from '@/lib/types/product';
import { formatPrice } from '@/lib/utils/price';
import { ImageGallery } from './ImageGallery';

interface ProductDetailModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (
    productId: string,
    quantity: number,
    selectedColor?: string,
    selectedSize?: string,
  ) => Promise<void>;
  onBuyNow?: (
    productId: string,
    quantity: number,
    selectedColor?: string,
    selectedSize?: string,
  ) => Promise<void>;
}

export default function ProductDetailModal({
  product,
  isOpen,
  onClose,
  onAddToCart,
  onBuyNow,
}: ProductDetailModalProps) {
  const [selectedColor, setSelectedColor] = useState<string | undefined>(
    product.colorOptions && Array.isArray(product.colorOptions) && product.colorOptions.length > 0
      ? product.colorOptions[0]
      : undefined,
  );
  const [selectedSize, setSelectedSize] = useState<string | undefined>(
    product.sizeOptions && Array.isArray(product.sizeOptions) && product.sizeOptions.length > 0
      ? product.sizeOptions[0]
      : undefined,
  );
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedColor(product.colorOptions?.[0] ?? undefined);
      setSelectedSize(product.sizeOptions?.[0] ?? undefined);
      setQuantity(1);
      setAddedToCart(false);
    }
  }, [isOpen, product.id]);

  if (!isOpen) return null;

  const maxQuantity = Math.min(product.stock || 10, 10);
  const totalPrice = product.price * quantity;

  const handleAddToCart = async () => {
    await onAddToCart(product.id, quantity, selectedColor, selectedSize);
    setAddedToCart(true);
    setTimeout(() => {
      setAddedToCart(false);
      onClose();
    }, 1500);
  };

  const handleBuyNow = async () => {
    if (onBuyNow) {
      await onBuyNow(product.id, quantity, selectedColor, selectedSize);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-content-bg rounded-t-[24px] lg:rounded-[24px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-content-bg border-b border-border-color p-4 flex items-center justify-between">
          <Heading2 className="text-primary-text">상품 상세</Heading2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-content-bg rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-secondary-text" />
          </button>
        </div>

        {/* Product Image Gallery */}
        <div className="max-h-96">
          <ImageGallery
            images={[
              product.images?.[0] ?? product.imageUrl,
              ...(product.images?.slice(1) ?? []),
            ]}
            productName={product.name}
            aspectRatio="aspect-square"
          />
        </div>

        {/* Product Info */}
        <div className="p-6 space-y-6">
          {/* Name and Price */}
          <div>
            <Heading2 className="text-primary-text mb-2">{product.name}</Heading2>
            <div className="flex flex-col gap-1">
              {product.discountRate && product.discountRate > 0 ? (
                <>
                  {/* 버그 3: originalPrice가 실제로 있을 때만 strikethrough 렌더링 */}
                  {product.originalPrice !== undefined && product.originalPrice !== null && (
                    <span className="text-sm text-secondary-text line-through">
                      {formatPrice(product.originalPrice)}
                    </span>
                  )}
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-black text-error">{product.discountRate}%</span>
                    <span className="text-[32px] font-bold text-hot-pink">
                      {formatPrice(product.price)}
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-[32px] font-bold text-hot-pink">
                  {formatPrice(product.price)}
                </span>
              )}
              {product.shippingFee > 0 && (
                <Caption className="text-secondary-text">
                  배송비 +{formatPrice(product.shippingFee)}
                </Caption>
              )}
            </div>
          </div>

          {/* Free Shipping Message */}
          {product.freeShippingMessage && (
            <div className="bg-success/10 border border-success/20 rounded-lg p-3">
              <Body className="text-success">{product.freeShippingMessage}</Body>
            </div>
          )}

          {/* Timer Info */}
          {product.timerEnabled && (
            <div className="bg-hot-pink/10 border border-hot-pink/20 rounded-lg p-3">
              <Body className="text-hot-pink">
                <Timer className="w-4 h-4 inline-block mr-1" aria-hidden="true" /> 장바구니 담기 후{' '}
                {product.timerDuration}분 내 결제 필요
              </Body>
            </div>
          )}

          {/* Stock Info */}
          <div className="flex items-center justify-between p-3 bg-primary-black rounded-lg">
            <Caption className="text-secondary-text">재고</Caption>
            <Body
              className={`font-medium ${product.stock < 5 ? 'text-warning' : 'text-primary-text'}`}
            >
              {product.stock}개 남음
            </Body>
          </div>

          {/* Color Options */}
          {product.colorOptions && product.colorOptions.length > 0 && (
            <div>
              <Caption className="text-secondary-text mb-2">컬러</Caption>
              <div className="grid grid-cols-4 gap-2">
                {product.colorOptions.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`
                      px-4 py-2 rounded-button text-caption transition-all
                      ${
                        selectedColor === color
                          ? 'bg-hot-pink text-white'
                          : 'bg-primary-black text-secondary-text hover:bg-content-bg'
                      }
                    `}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size Options */}
          {product.sizeOptions && product.sizeOptions.length > 0 && (
            <div>
              <Caption className="text-secondary-text mb-2">사이즈</Caption>
              <div className="grid grid-cols-4 gap-2">
                {product.sizeOptions.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`
                      px-4 py-2 rounded-button text-caption transition-all
                      ${
                        selectedSize === size
                          ? 'bg-hot-pink text-white'
                          : 'bg-primary-black text-secondary-text hover:bg-content-bg'
                      }
                    `}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity Selector */}
          <div className="border-t border-border-color pt-6">
            <Caption className="text-secondary-text mb-3">수량</Caption>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                className="w-10 h-10 bg-content-bg hover:bg-border-color disabled:opacity-30 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors"
              >
                <Minus className="w-4 h-4 text-primary-text" />
              </button>
              <span className="text-lg font-bold text-primary-text w-12 text-center">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                disabled={quantity >= maxQuantity}
                className="w-10 h-10 bg-content-bg hover:bg-border-color disabled:opacity-30 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors"
              >
                <Plus className="w-4 h-4 text-primary-text" />
              </button>
            </div>
          </div>

          {/* Total Price */}
          <div className="bg-content-bg rounded-lg p-4 border border-border-color">
            <div className="flex items-center justify-between">
              <Caption className="text-secondary-text">총 금액</Caption>
              <span className="text-2xl font-bold text-hot-pink">{formatPrice(totalPrice)}</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleAddToCart}
              disabled={product.status === ProductStatus.SOLD_OUT || product.stock === 0}
              className={`
                w-full py-4 rounded-button font-bold text-body transition-all flex items-center justify-center gap-2
                ${
                  addedToCart
                    ? 'bg-success text-white'
                    : product.status === ProductStatus.SOLD_OUT || product.stock === 0
                      ? 'bg-content-bg text-secondary-text cursor-not-allowed'
                      : 'bg-hot-pink text-white hover:bg-hot-pink-dark active:scale-95'
                }
              `}
            >
              {addedToCart ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>장바구니에 담았습니다!</span>
                </>
              ) : product.status === ProductStatus.SOLD_OUT || product.stock === 0 ? (
                '품절'
              ) : (
                '장바구니에 담기'
              )}
            </button>
            {onBuyNow && (
              <button
                onClick={handleBuyNow}
                disabled={product.status === ProductStatus.SOLD_OUT || product.stock === 0}
                className={`
                  w-full py-4 rounded-button font-bold text-body transition-colors
                  ${
                    product.status === ProductStatus.SOLD_OUT || product.stock === 0
                      ? 'bg-content-bg text-secondary-text cursor-not-allowed'
                      : 'bg-border-color text-primary-text hover:bg-secondary-text/20'
                  }
                `}
              >
                바로 구매
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
