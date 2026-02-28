'use client';

import { useEffect, useState, useRef } from 'react';
import { X, Plus, Minus, ShoppingCart, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  discountRate?: number;
  image: string;
  images?: string[];
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
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  const sizeOptions = product.sizeOptions ?? [];
  const colorOptions = product.colorOptions ?? [];
  const hasSizeOptions = sizeOptions.length > 0;
  const hasColorOptions = colorOptions.length > 0;

  // Build image list: prefer product.images if present, else use product.image
  const imageList: string[] =
    product.images && product.images.length > 0 ? product.images : [product.image];
  const hasMultipleImages = imageList.length > 1;

  useEffect(() => {
    if (sizeOptions.length === 1) {
      setSelectedSize(sizeOptions[0]);
    }
    if (colorOptions.length === 1) {
      setSelectedColor(colorOptions[0]);
    }
  }, [sizeOptions, colorOptions]);

  // Reset carousel index when product changes
  useEffect(() => {
    setCurrentImageIndex(0);
  }, [product.id]);

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

  const goPrevImage = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? imageList.length - 1 : prev - 1));
  };

  const goNextImage = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === imageList.length - 1 ? 0 : prev + 1));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartXRef.current) return;

    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;
    const threshold = 50; // minimum swipe distance

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        // Swiped left → next image
        goNextImage(e);
      } else {
        // Swiped right → previous image
        goPrevImage(e);
      }
    }

    touchStartXRef.current = null;
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

        {/* Image carousel */}
        <div
          className="relative aspect-square md:aspect-[4/3] overflow-hidden bg-gray-100 cursor-pointer"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={() => setIsFullScreenOpen(true)}
        >
          <ImageWithFallback
            src={imageList[currentImageIndex]}
            alt={product.name}
            className="w-full h-full object-cover"
          />

          {/* Zoom indicator */}
          <div className="absolute bottom-3 right-3 bg-white/80 backdrop-blur-sm rounded-full p-2 opacity-0 hover:opacity-100 transition-opacity">
            <ZoomIn className="w-5 h-5 text-gray-700" />
          </div>

          <div className="absolute top-4 left-4 bg-[#FF4D8D] text-white px-4 py-2 rounded-full shadow-lg">
            <span className="text-sm font-bold">
              {discountLabel > 0 ? `${discountLabel}% OFF` : '할인 정보 없음'}
            </span>
          </div>

          {/* Prev / Next arrows — only when multiple images */}
          {hasMultipleImages && (
            <>
              <button
                onClick={goPrevImage}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
                aria-label="이전 이미지"
              >
                <ChevronLeft className="w-5 h-5 text-gray-700" />
              </button>
              <button
                onClick={goNextImage}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
                aria-label="다음 이미지"
              >
                <ChevronRight className="w-5 h-5 text-gray-700" />
              </button>

              {/* Dot indicators */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {imageList.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(idx);
                    }}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === currentImageIndex ? 'bg-[#FF4D8D] w-4' : 'bg-white/70 hover:bg-white'
                    }`}
                    aria-label={`이미지 ${idx + 1}`}
                  />
                ))}
              </div>
            </>
          )}
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

      {/* Full-screen image viewer modal */}
      {isFullScreenOpen && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center">
          {/* Close button */}
          <button
            onClick={() => setIsFullScreenOpen(false)}
            className="absolute top-4 right-4 z-[70] w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
            aria-label="닫기"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Image container */}
          <div
            className="relative w-full h-full flex items-center justify-center px-4"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <ImageWithFallback
              src={imageList[currentImageIndex]}
              alt={product.name}
              className="max-w-full max-h-full object-contain"
            />

            {/* Navigation arrows */}
            {hasMultipleImages && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goPrevImage(e);
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
                  aria-label="이전 이미지"
                >
                  <ChevronLeft className="w-6 h-6 text-white" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goNextImage(e);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
                  aria-label="다음 이미지"
                >
                  <ChevronRight className="w-6 h-6 text-white" />
                </button>

                {/* Image counter and dot indicators */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
                  <div className="text-white text-sm font-medium">
                    {currentImageIndex + 1} / {imageList.length}
                  </div>
                  <div className="flex gap-2">
                    {imageList.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentImageIndex(idx);
                        }}
                        className={`rounded-full transition-all ${
                          idx === currentImageIndex
                            ? 'bg-white w-2 h-2'
                            : 'bg-white/50 hover:bg-white/70 w-1.5 h-1.5'
                        }`}
                        aria-label={`이미지 ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
