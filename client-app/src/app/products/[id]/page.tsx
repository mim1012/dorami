'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Minus, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { getProductById } from '@/lib/api/products';
import type { Product } from '@/lib/types';
import { ProductStatus } from '@/lib/types';
import { apiClient } from '@/lib/api/client';
import { useQueryClient } from '@tanstack/react-query';
import { cartKeys } from '@/lib/hooks/queries/use-cart';
import { Display, Heading2, Body } from '@/components/common/Typography';
import { formatPrice } from '@/lib/utils/price';
import { Button } from '@/components/common/Button';
import { BottomTabBar } from '@/components/layout/BottomTabBar';

const MOCK_PRODUCT: Product = {
  id: 'mock-1',
  streamKey: '',
  name: '샘플 상품',
  price: 29900,
  stock: 10,
  imageUrl: undefined,
  status: ProductStatus.AVAILABLE,
  colorOptions: [],
  sizeOptions: [],
  shippingFee: 0,
  timerEnabled: false,
  timerDuration: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [expandedImageIndex, setExpandedImageIndex] = useState<number | null>(null);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const autoBuyHandled = useRef(false);

  const colors = product?.colorOptions ?? [];
  const sizes = product?.sizeOptions ?? [];
  const preselectedSize = searchParams.get('size');
  const preselectedColor = searchParams.get('color');
  const preselectedQuantity = Number(searchParams.get('quantity') ?? '');
  const preselectedIntent = searchParams.get('intent');

  // 모든 이미지 배열 (대표이미지 + 상세이미지)
  const allImages = product?.imageUrl
    ? [
        { url: product.imageUrl, label: '대표이미지' },
        ...(product.images || []).map((img, idx) => ({ url: img, label: `상세이미지 ${idx + 1}` })),
      ]
    : (product?.images || []).map((img, idx) => ({ url: img, label: `상세이미지 ${idx + 1}` }));

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setTouchEnd(e.changedTouches[0].clientX);
    handleSwipe();
  };

  const handleSwipe = () => {
    if (!allImages.length) return;
    const isLeftSwipe = touchStart - touchEnd > 50;
    const isRightSwipe = touchEnd - touchStart > 50;

    if (isLeftSwipe) {
      setImageIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
    }
    if (isRightSwipe) {
      setImageIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
    }
  };

  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        const data = await getProductById(id);
        setProduct(data);
      } catch {
        setProduct({ ...MOCK_PRODUCT, id });
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [id]);

  useEffect(() => {
    if (!product) return;

    if (preselectedQuantity > 0 && Number.isFinite(preselectedQuantity)) {
      const max = Math.max(product.stock, 1);
      const clamped = Math.min(preselectedQuantity, max);
      setQuantity(clamped >= 1 ? clamped : 1);
    }

    if (preselectedSize && sizes.includes(preselectedSize)) {
      setSelectedSize(preselectedSize);
    }
    if (preselectedColor && colors.includes(preselectedColor)) {
      setSelectedColor(preselectedColor);
    }
  }, [preselectedSize, preselectedColor, preselectedQuantity, product, sizes, colors]);

  const maxQuantity = product ? Math.min(product.stock || 0, 10) : 1;

  const handleQuantityChange = (delta: number) => {
    const next = quantity + delta;
    if (next >= 1 && next <= maxQuantity) setQuantity(next);
  };

  const handleAddToCart = useCallback(async () => {
    if (!product) return;

    if (sizes.length > 0 && !selectedSize) {
      alert('사이즈를 선택해주세요.');
      return;
    }

    if (colors.length > 0 && !selectedColor) {
      alert('색상을 선택해주세요.');
      return;
    }

    try {
      await apiClient.post('/cart', {
        productId: product.id,
        quantity,
        ...(sizes.length > 0 && selectedSize ? { size: selectedSize } : {}),
        ...(colors.length > 0 && selectedColor ? { color: selectedColor } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: cartKeys.all });
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    } catch (error: any) {
      console.error('Failed to add to cart:', error);
      alert(error.response?.data?.message || '장바구니 추가에 실패했습니다.');
    }
  }, [colors, queryClient, product, quantity, selectedColor, selectedSize]);

  const handleBuyNow = useCallback(async () => {
    await handleAddToCart();
    router.push('/cart');
  }, [handleAddToCart, router]);

  useEffect(() => {
    if (preselectedIntent !== 'buy' || !product || autoBuyHandled.current) return;

    autoBuyHandled.current = true;
    (async () => {
      try {
        await handleAddToCart();
        router.replace('/cart');
      } catch {
        autoBuyHandled.current = false;
      }
    })();
  }, [preselectedIntent, product, handleAddToCart, router]);

  if (loading) {
    return (
      <>
        <div className="min-h-screen bg-primary-black pb-24">
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-hot-pink border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <Body className="text-secondary-text">상품 정보를 불러오는 중...</Body>
            </div>
          </div>
        </div>
        <BottomTabBar />
      </>
    );
  }

  if (!product) return null;

  return (
    <>
      <div className="min-h-screen bg-primary-black pb-24">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="fixed top-4 left-4 z-30 w-10 h-10 bg-content-bg backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-border-color transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-primary-text" />
        </button>

        {/* Unified Image Carousel with Touch Slide */}
        {allImages.length > 0 && (
          <div className="px-4 py-4 space-y-4">
            {/* Main Slide */}
            <div
              className="relative w-full aspect-[4/3] bg-content-bg rounded-lg overflow-hidden cursor-pointer active:opacity-90"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onClick={() => setExpandedImageIndex(imageIndex)}
            >
              <Image
                src={allImages[imageIndex].url}
                alt={allImages[imageIndex].label}
                fill
                className="object-contain"
                sizes="100vw"
                unoptimized={allImages[imageIndex].url.startsWith('/uploads/')}
              />

              {/* Image Label */}
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-white text-xs">
                {allImages[imageIndex].label}
              </div>

              {/* Slide Counter */}
              <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-white text-xs">
                {imageIndex + 1} / {allImages.length}
              </div>

              {/* Left Arrow */}
              {allImages.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
              )}

              {/* Right Arrow */}
              {allImages.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
              )}

              {/* SOLD_OUT Badge */}
              {product.status === 'SOLD_OUT' && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Display className="text-white">품절</Display>
                </div>
              )}
            </div>

            {/* Thumbnail Scroll */}
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setImageIndex(idx)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      idx === imageIndex ? 'border-hot-pink' : 'border-border-color'
                    }`}
                  >
                    <Image
                      src={img.url}
                      alt={img.label}
                      width={64}
                      height={64}
                      className="w-full h-full object-contain"
                      unoptimized={img.url.startsWith('/uploads/')}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Expanded Image Modal */}
        {expandedImageIndex !== null && (
          <div
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={() => setExpandedImageIndex(null)}
          >
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <Image
                src={allImages[expandedImageIndex].url}
                alt={allImages[expandedImageIndex].label}
                fill
                className="object-contain"
                sizes="100vw"
                unoptimized={allImages[expandedImageIndex].url.startsWith('/uploads/')}
              />
              <button
                onClick={() => setExpandedImageIndex(null)}
                className="absolute top-4 right-4 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-4 py-6 space-y-6">
          {/* Name & Price */}
          <div>
            <Heading2 className="text-primary-text text-2xl mb-2">{product.name}</Heading2>
            {product.discountRate && product.discountRate > 0 ? (
              <div className="flex flex-col gap-1">
                <span className="text-sm text-secondary-text line-through">
                  {formatPrice(product.originalPrice ?? product.price)}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-black text-error">{product.discountRate}%</span>
                  <Display className="text-hot-pink">{formatPrice(product.price)}</Display>
                </div>
              </div>
            ) : (
              <Display className="text-hot-pink">{formatPrice(product.price)}</Display>
            )}
            <Body className="text-secondary-text text-sm mt-1">재고: {product.stock}개</Body>
          </div>

          {/* Color Selector */}
          {colors.length > 0 && (
            <div className="border-t border-border-color pt-4">
              <Body className="text-primary-text font-semibold mb-3">색상</Body>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(selectedColor === color ? null : color)}
                    className={`px-4 py-2 rounded-full border text-sm transition-colors ${
                      selectedColor === color
                        ? 'border-hot-pink bg-hot-pink/20 text-hot-pink'
                        : 'border-border-color text-secondary-text hover:border-hot-pink/40'
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size Selector */}
          {sizes.length > 0 && (
            <div>
              <Body className="text-primary-text font-semibold mb-3">사이즈</Body>
              <div className="flex flex-wrap gap-2">
                {sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(selectedSize === size ? null : size)}
                    className={`w-12 h-12 rounded-xl border text-sm font-bold transition-colors ${
                      selectedSize === size
                        ? 'border-hot-pink bg-hot-pink/20 text-hot-pink'
                        : 'border-border-color text-secondary-text hover:border-hot-pink/40'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity Selector */}
          <div className="border-t border-border-color pt-4">
            <Body className="text-primary-text font-semibold mb-3">수량</Body>
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity <= 1}
                className="w-11 h-11 bg-content-bg hover:bg-border-color disabled:opacity-30 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-colors"
              >
                <Minus className="w-5 h-5 text-primary-text" />
              </button>
              <Body className="text-primary-text font-bold text-2xl w-8 text-center">
                {quantity}
              </Body>
              <button
                onClick={() => handleQuantityChange(1)}
                disabled={quantity >= maxQuantity}
                className="w-11 h-11 bg-content-bg hover:bg-border-color disabled:opacity-30 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-colors"
              >
                <Plus className="w-5 h-5 text-primary-text" />
              </button>
            </div>
          </div>

          {/* Total */}
          <div className="bg-content-bg rounded-2xl p-4 border border-border-color">
            <div className="flex items-center justify-between">
              <Body className="text-secondary-text">총 금액</Body>
              <Display className="text-hot-pink">{formatPrice(product.price * quantity)}</Display>
            </div>
          </div>
        </div>

        {/* Sticky CTA */}
        <div className="fixed bottom-16 inset-x-0 z-20 px-4 py-3 bg-primary-black/90 backdrop-blur-sm border-t border-border-color">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleAddToCart}
            disabled={product.status === 'SOLD_OUT'}
            className="mb-2"
          >
            {addedToCart ? '✓ 담았습니다!' : '장바구니 담기'}
          </Button>
          <Button
            variant="outline"
            size="lg"
            fullWidth
            onClick={handleBuyNow}
            disabled={product.status === 'SOLD_OUT'}
          >
            바로 구매
          </Button>
        </div>
      </div>

      <BottomTabBar />
    </>
  );
}
