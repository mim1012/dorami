'use client';

import { useEffect, useState } from 'react';
import { X, Plus, Minus, ShoppingCart, Heart } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  discountRate?: number;
  image: string;
  host?: string;
  sizeOptions?: string[];
  colorOptions?: string[];
}

type ActionPayload = {
  quantity: number;
  size?: string;
  color?: string;
};

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
  onAddToCart?: (payload: ActionPayload) => void;
  onBuyNow?: (payload: ActionPayload) => void;
}

export function ProductDetailModal({
  product,
  onClose,
  onAddToCart,
  onBuyNow,
}: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const [isLiked, setIsLiked] = useState(false);

  const sizeOptions = product.sizeOptions ?? [];
  const colorOptions = product.colorOptions ?? [];
  const hasSizeOptions = sizeOptions.length > 0;
  const hasColorOptions = colorOptions.length > 0;

  useEffect(() => {
    if (sizeOptions.length === 1) {
      setSelectedSize(sizeOptions[0]);
    }
    if (colorOptions.length === 1) {
      setSelectedColor(colorOptions[0]);
    }
  }, [sizeOptions, colorOptions]);

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= 10) {
      setQuantity(newQuantity);
    }
  };

  const clearValidation = () => {
    if (validationMessage) setValidationMessage('');
  };

  const totalPrice = product.price * quantity;
  const discountLabel = product.discountRate && product.discountRate > 0 ? product.discountRate : 0;

  const isSelectionValid = () => {
    if (hasSizeOptions && !selectedSize) {
      setValidationMessage('사이즈를 선택해주세요.');
      return false;
    }
    if (hasColorOptions && !selectedColor) {
      setValidationMessage('색상을 선택해주세요.');
      return false;
    }
    return true;
  };

  const handlePurchase = () => {
    if (!isSelectionValid()) return;

    onBuyNow?.({
      quantity,
      ...(hasSizeOptions ? { size: selectedSize } : {}),
      ...(hasColorOptions ? { color: selectedColor } : {}),
    });
  };

  const handleAddToCart = () => {
    if (!isSelectionValid()) return;

    onAddToCart?.({
      quantity,
      ...(hasSizeOptions ? { size: selectedSize } : {}),
      ...(hasColorOptions ? { color: selectedColor } : {}),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white w-full md:max-w-2xl md:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
        >
          <X className="w-5 h-5 text-gray-700" />
        </button>

        <div className="relative aspect-square md:aspect-[4/3] overflow-hidden bg-gray-100">
          <ImageWithFallback
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-4 left-4 bg-[#FF4D8D] text-white px-4 py-2 rounded-full shadow-lg">
            <span className="text-sm font-bold">
              {discountLabel > 0 ? `${discountLabel}% OFF` : '할인 정보 없음'}
            </span>
          </div>

          <button
            onClick={() => setIsLiked(!isLiked)}
            className="absolute bottom-4 right-4 w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
          >
            <Heart
              className={`w-6 h-6 transition-colors ${
                isLiked ? 'fill-[#FF4D8D] text-[#FF4D8D]' : 'text-gray-600'
              }`}
            />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-2xl font-bold text-gray-900 flex-1">{product.name}</h2>
            </div>
            <p className="text-sm text-gray-500">판매자: {product.host ?? '도레미'}</p>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-gray-900">
                ₩{product.price.toLocaleString()}
              </span>
              <span className="text-lg text-gray-400 line-through">
                ₩{product.originalPrice.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {hasSizeOptions && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-900">사이즈 선택</label>
              <div className="grid grid-cols-4 gap-2">
                {sizeOptions.map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      clearValidation();
                      setSelectedSize(size);
                    }}
                    className={`py-3 rounded-xl font-semibold transition-all ${
                      selectedSize === size
                        ? 'bg-[#FF4D8D] text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasColorOptions && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-900">색상 선택</label>
              <div className="grid grid-cols-4 gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      clearValidation();
                      setSelectedColor(color);
                    }}
                    className={`py-3 px-4 rounded-xl font-medium transition-all border-2 ${
                      selectedColor === color
                        ? 'border-[#FF4D8D] bg-pink-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <span className="text-sm">{color}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900">수량</label>
            <div className="flex items-center gap-4">
              <div className="flex items-center bg-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => handleQuantityChange(-1)}
                  className="w-12 h-12 flex items-center justify-center hover:bg-gray-200 transition-colors"
                  disabled={quantity <= 1}
                >
                  <Minus className="w-4 h-4 text-gray-700" />
                </button>
                <span className="w-16 text-center font-bold text-gray-900">{quantity}</span>
                <button
                  onClick={() => handleQuantityChange(1)}
                  className="w-12 h-12 flex items-center justify-center hover:bg-gray-200 transition-colors"
                  disabled={quantity >= 10}
                >
                  <Plus className="w-4 h-4 text-gray-700" />
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          <div className="flex items-center justify-between py-2">
            <span className="text-lg font-semibold text-gray-900">총 금액</span>
            <span className="text-2xl font-bold text-[#FF4D8D]">
              ₩{totalPrice.toLocaleString()}
            </span>
          </div>

          {validationMessage && (
            <p className="text-xs text-error text-center md:text-left">{validationMessage}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleAddToCart}
              className="flex-1 bg-white border-2 border-gray-300 text-gray-900 py-4 rounded-2xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-5 h-5" />
              장바구니
            </button>
            <button
              onClick={handlePurchase}
              className="flex-[2] bg-gradient-to-r from-[#FF4D8D] to-[#FF6B9D] text-white py-4 rounded-2xl font-bold hover:shadow-lg transition-all"
            >
              구매하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
