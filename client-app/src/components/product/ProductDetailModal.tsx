'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X, Timer } from 'lucide-react';
import { Heading2, Body, Caption } from '@/components/common/Typography';
import { Product, ProductStatus } from '@/lib/types/product';
import { formatPrice } from '@/lib/utils/price';

interface ProductDetailModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (productId: string, selectedColor?: string, selectedSize?: string) => void;
}

export default function ProductDetailModal({
  product,
  isOpen,
  onClose,
  onAddToCart,
}: ProductDetailModalProps) {
  const [selectedColor, setSelectedColor] = useState<string | undefined>(
    product.colorOptions.length > 0 ? product.colorOptions[0] : undefined,
  );
  const [selectedSize, setSelectedSize] = useState<string | undefined>(
    product.sizeOptions.length > 0 ? product.sizeOptions[0] : undefined,
  );

  if (!isOpen) return null;

  const handleAddToCart = () => {
    onAddToCart(product.id, selectedColor, selectedSize);
    onClose();
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

        {/* Product Image */}
        <div className="relative w-full aspect-square bg-primary-black">
          {product.imageUrl ? (
            <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-secondary-text">No Image</span>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="p-6 space-y-6">
          {/* Name and Price */}
          <div>
            <Heading2 className="text-primary-text mb-2">{product.name}</Heading2>
            <div className="flex flex-col gap-1">
              {product.discountRate && product.discountRate > 0 ? (
                <>
                  <span className="text-sm text-secondary-text line-through">
                    {formatPrice(product.originalPrice ?? product.price)}
                  </span>
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
          {product.colorOptions.length > 0 && (
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
          {product.sizeOptions.length > 0 && (
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

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            disabled={product.status === ProductStatus.SOLD_OUT || product.stock === 0}
            className={`
              w-full py-4 rounded-button font-bold text-body transition-colors
              ${
                product.status === ProductStatus.SOLD_OUT || product.stock === 0
                  ? 'bg-content-bg text-secondary-text cursor-not-allowed'
                  : 'bg-hot-pink text-white hover:bg-hot-pink-dark'
              }
            `}
          >
            {product.status === ProductStatus.SOLD_OUT || product.stock === 0
              ? '품절'
              : '장바구니에 담기'}
          </button>
        </div>
      </div>
    </div>
  );
}
