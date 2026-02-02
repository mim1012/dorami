'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { Heading1, Heading2, Body, Caption } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import CartTimer from '@/components/cart/CartTimer';
import { ShoppingCart, Trash2, Plus, Minus, ArrowLeft } from 'lucide-react';

interface CartItem {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  color?: string;
  size?: string;
  shippingFee: number;
  timerEnabled: boolean;
  expiresAt?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'COMPLETED';
  createdAt: string;
  updatedAt: string;
  subtotal: number;
  total: number;
  remainingSeconds?: number;
}

interface CartSummary {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  totalShippingFee: number;
  grandTotal: number;
  earliestExpiration?: string;
}

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get<CartSummary>('/cart');
      setCart(response.data);
    } catch (err: any) {
      console.error('Failed to fetch cart:', err);
      setError('장바구니를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateQuantity = async (cartItemId: string, newQuantity: number) => {
    if (newQuantity < 1 || newQuantity > 10) return;

    try {
      await apiClient.patch(`/cart/${cartItemId}`, { quantity: newQuantity });
      await fetchCart();
    } catch (err: any) {
      console.error('Failed to update quantity:', err);
      alert(`수량 변경에 실패했습니다: ${err.message}`);
    }
  };

  const handleRemoveItem = async (cartItemId: string) => {
    if (!confirm('이 상품을 장바구니에서 삭제하시겠습니까?')) return;

    try {
      await apiClient.delete(`/cart/${cartItemId}`);
      await fetchCart();
    } catch (err: any) {
      console.error('Failed to remove item:', err);
      alert('삭제에 실패했습니다.');
    }
  };

  const handleClearCart = async () => {
    if (!confirm('장바구니를 비우시겠습니까?')) return;

    try {
      await apiClient.delete('/cart');
      await fetchCart();
    } catch (err: any) {
      console.error('Failed to clear cart:', err);
      alert('장바구니 비우기에 실패했습니다.');
    }
  };

  const handleCheckout = () => {
    // TODO: Implement checkout flow (Epic 6 Story 6-4)
    router.push('/checkout');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(price);
  };

  if (isLoading) {
    return (
      <>
        <div className="min-h-screen bg-primary-black flex items-center justify-center">
          <Body className="text-white">장바구니를 불러오는 중...</Body>
        </div>
        <BottomTabBar />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-primary-black pb-28">
        {/* Header */}
        <div className="bg-content-bg border-b border-gray-800 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <Heading1 className="text-white flex items-center gap-2">
              <ShoppingCart className="w-8 h-8" />
              장바구니
            </Heading1>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6">
          {error && (
            <div className="bg-error/10 border border-error rounded-xl p-4 mb-6">
              <Body className="text-error">{error}</Body>
            </div>
          )}

          {cart && cart.items.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingCart className="w-24 h-24 text-gray-600 mx-auto mb-4 opacity-30" />
              <Heading2 className="text-white mb-2">장바구니가 비어있습니다</Heading2>
              <Body className="text-gray-400 mb-6">
                라이브 방송에서 상품을 담아보세요!
              </Body>
              <Button variant="primary" onClick={() => router.push('/')}>
                홈으로 가기
              </Button>
            </div>
          ) : (
            cart && (
              <>
                {/* Earliest Timer Warning */}
                {cart.earliestExpiration && (
                  <div className="bg-hot-pink/10 border border-hot-pink/20 rounded-xl p-4 mb-6 flex items-center justify-between">
                    <div>
                      <Body className="text-hot-pink font-bold mb-1">
                        ⚠️ 예약 시간이 얼마 남지 않았습니다!
                      </Body>
                      <Caption className="text-gray-400">
                        시간 내에 결제하지 않으면 예약이 자동으로 취소됩니다.
                      </Caption>
                    </div>
                    <CartTimer expiresAt={cart.earliestExpiration} onExpired={fetchCart} />
                  </div>
                )}

                {/* Cart Items */}
                <div className="space-y-4 mb-6">
                  {cart.items.map((item) => (
                    <div
                      key={item.id}
                      className={`bg-content-bg rounded-xl p-4 border ${
                        item.status === 'EXPIRED'
                          ? 'border-error opacity-60'
                          : 'border-gray-800'
                      }`}
                    >
                      <div className="flex gap-4">
                        {/* Product Info */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <Heading2 className="text-white mb-1">{item.productName}</Heading2>
                              {(item.color || item.size) && (
                                <Caption className="text-gray-400">
                                  {item.color && `색상: ${item.color}`}
                                  {item.color && item.size && ' · '}
                                  {item.size && `사이즈: ${item.size}`}
                                </Caption>
                              )}
                            </div>
                            {item.timerEnabled && item.expiresAt && item.status === 'ACTIVE' && (
                              <CartTimer expiresAt={item.expiresAt} onExpired={fetchCart} />
                            )}
                          </div>

                          {/* Price and Quantity */}
                          <div className="flex items-center justify-between">
                            <div>
                              <Body className="text-hot-pink font-bold text-lg">
                                {formatPrice(item.price)}
                              </Body>
                              {item.shippingFee > 0 && (
                                <Caption className="text-gray-400">
                                  배송비: {formatPrice(item.shippingFee)}
                                </Caption>
                              )}
                            </div>

                            {/* Quantity Controls */}
                            {item.status === 'ACTIVE' && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                  disabled={item.quantity <= 1}
                                  className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Minus className="w-4 h-4 text-white" />
                                </button>
                                <span className="text-white font-bold min-w-[40px] text-center">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                  disabled={item.quantity >= 10}
                                  className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Plus className="w-4 h-4 text-white" />
                                </button>
                                <button
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="p-2 bg-error/20 rounded-lg hover:bg-error/30 transition-colors ml-2"
                                >
                                  <Trash2 className="w-4 h-4 text-error" />
                                </button>
                              </div>
                            )}

                            {item.status === 'EXPIRED' && (
                              <div className="text-error font-bold">예약 만료</div>
                            )}
                          </div>

                          {/* Subtotal */}
                          <div className="mt-2 pt-2 border-t border-gray-800">
                            <div className="flex justify-between">
                              <Caption className="text-gray-400">소계</Caption>
                              <Body className="text-white font-bold">
                                {formatPrice(item.total)}
                              </Body>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Cart Summary */}
                <div className="bg-content-bg rounded-xl p-6 border border-gray-800 mb-6">
                  <Heading2 className="text-white mb-4">주문 요약</Heading2>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Body className="text-gray-400">상품 금액 ({cart.itemCount}개)</Body>
                      <Body className="text-white">{formatPrice(cart.subtotal)}</Body>
                    </div>
                    <div className="flex justify-between">
                      <Body className="text-gray-400">배송비</Body>
                      <Body className="text-white">{formatPrice(cart.totalShippingFee)}</Body>
                    </div>
                    <div className="border-t border-gray-800 pt-2 mt-2">
                      <div className="flex justify-between items-center">
                        <Heading2 className="text-white">총 결제 금액</Heading2>
                        <Heading1 className="text-hot-pink">
                          {formatPrice(cart.grandTotal)}
                        </Heading1>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-4">
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleCheckout}
                    disabled={cart.items.some((item) => item.status === 'EXPIRED')}
                  >
                    {cart.items.some((item) => item.status === 'EXPIRED')
                      ? '만료된 상품이 있습니다'
                      : `${formatPrice(cart.grandTotal)} 결제하기`}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    fullWidth
                    onClick={handleClearCart}
                    className="border-gray-600 text-gray-400 hover:bg-gray-800"
                  >
                    장바구니 비우기
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    fullWidth
                    onClick={() => router.push('/')}
                  >
                    계속 쇼핑하기
                  </Button>
                </div>
              </>
            )
          )}
        </div>
      </div>

      <BottomTabBar />
    </>
  );
}
