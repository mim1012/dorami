'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Minus, Plus, ShoppingBag } from 'lucide-react';
import { getProductById, type Product } from '@/lib/api/products';
import { useCart } from '@/lib/contexts/CartContext';
import { Display, Heading2, Body } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { BottomTabBar } from '@/components/layout/BottomTabBar';

const MOCK_PRODUCT: Product = {
  id: 'mock-1',
  name: '샘플 상품',
  description: '이 상품은 현재 서버에서 불러올 수 없어 임시로 표시됩니다.',
  price: 29900,
  stock: 10,
  imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
  status: 'AVAILABLE',
  colorOptions: [],
  sizeOptions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { addItem } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);

  const colors = product?.colorOptions ?? [];
  const sizes = product?.sizeOptions ?? [];

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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(price);
  };

  const maxQuantity = product ? Math.min(product.stock || 0, 10) : 1;

  const handleQuantityChange = (delta: number) => {
    const next = quantity + delta;
    if (next >= 1 && next <= maxQuantity) setQuantity(next);
  };

  const handleAddToCart = () => {
    if (!product) return;
    addItem({
      productId: product.id,
      productName: product.name,
      price: product.price,
      quantity,
      imageUrl: product.imageUrl,
      stock: product.stock || 0,
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleBuyNow = () => {
    handleAddToCart();
    router.push('/cart');
  };

  if (loading) {
    return (
      <>
        <div className="min-h-screen bg-white pb-24">
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-hot-pink border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <Body className="text-gray-500">상품 정보를 불러오는 중...</Body>
            </div>
          </div>
        </div>
        <BottomTabBar />
      </>
    );
  }

  if (!product) return null;

  const imageUrl =
    product.imageUrl ||
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80';

  return (
    <>
      <div className="min-h-screen bg-white pb-24">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="fixed top-4 left-4 z-30 w-10 h-10 bg-white/70 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/90 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>

        {/* Product Image */}
        <div className="relative w-full aspect-[4/3] bg-gray-100">
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          {product.status === 'SOLD_OUT' && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <Display className="text-white">품절</Display>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-4 py-6 space-y-6">
          {/* Name & Price */}
          <div>
            <Heading2 className="text-gray-900 text-2xl mb-2">
              {product.name}
            </Heading2>
            <Display className="text-hot-pink">
              {formatPrice(product.price)}
            </Display>
            <Body className="text-gray-500 text-sm mt-1">
              재고: {product.stock}개
            </Body>
          </div>

          {/* Description */}
          {product.description && (
            <div className="border-t border-gray-200 pt-4">
              <Body className="text-gray-900 font-semibold mb-2">상품 설명</Body>
              <Body className="text-gray-500 leading-relaxed">
                {product.description}
              </Body>
            </div>
          )}

          {/* Color Selector */}
          {colors.length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <Body className="text-gray-900 font-semibold mb-3">색상</Body>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(selectedColor === color ? null : color)}
                    className={`px-4 py-2 rounded-full border text-sm transition-colors ${
                      selectedColor === color
                        ? 'border-hot-pink bg-hot-pink/20 text-hot-pink'
                        : 'border-gray-300 text-gray-500 hover:border-gray-400'
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
              <Body className="text-gray-900 font-semibold mb-3">사이즈</Body>
              <div className="flex flex-wrap gap-2">
                {sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(selectedSize === size ? null : size)}
                    className={`w-12 h-12 rounded-xl border text-sm font-bold transition-colors ${
                      selectedSize === size
                        ? 'border-hot-pink bg-hot-pink/20 text-hot-pink'
                        : 'border-gray-300 text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity Selector */}
          <div className="border-t border-gray-200 pt-4">
            <Body className="text-gray-900 font-semibold mb-3">수량</Body>
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity <= 1}
                className="w-11 h-11 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-colors"
              >
                <Minus className="w-5 h-5 text-gray-700" />
              </button>
              <Body className="text-gray-900 font-bold text-2xl w-8 text-center">
                {quantity}
              </Body>
              <button
                onClick={() => handleQuantityChange(1)}
                disabled={quantity >= maxQuantity}
                className="w-11 h-11 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-colors"
              >
                <Plus className="w-5 h-5 text-gray-700" />
              </button>
            </div>
          </div>

          {/* Total */}
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <Body className="text-gray-500">총 금액</Body>
              <Display className="text-hot-pink">
                {formatPrice(product.price * quantity)}
              </Display>
            </div>
          </div>
        </div>

        {/* Sticky CTA */}
        <div className="fixed bottom-16 inset-x-0 z-20 px-4 py-3 bg-white/90 backdrop-blur-sm border-t border-gray-200">
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
