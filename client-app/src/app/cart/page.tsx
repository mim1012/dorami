'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { apiClient } from '@/lib/api/client';
import { Heading1, Body, Caption } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import CartTimer from '@/components/cart/CartTimer';
import { CartItemCard } from '@/components/cart/CartItemCard';
import { CartSummaryCard } from '@/components/cart/CartSummaryCard';
import { CartEmptyState } from '@/components/cart/CartEmptyState';
import { formatPrice } from '@/lib/utils/format';
import { ShoppingCart, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/common/Toast';
import { useConfirm } from '@/components/common/ConfirmDialog';

interface CartItem {
  id: string;
  productName: string;
  price: number;
  quantity: number;
  color?: string;
  size?: string;
  shippingFee: number;
  timerEnabled: boolean;
  expiresAt?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'COMPLETED';
  total: number;
}

interface CartSummary {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  totalShippingFee: number;
  grandTotal: number;
  earliestExpiration?: string;
}

function CartPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('expired') === '1') {
      showToast('예약 시간이 만료되어 장바구니로 돌아왔습니다. 다시 담아주세요.', 'error');
    }
  }, [searchParams, showToast]);

  const fetchCart = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      fetchCart();
    }
  }, [authLoading, user, fetchCart]);

  const handleCartExpired = async () => {
    showToast(
      '예약 시간이 만료되어 장바구니에서 제거되었습니다. 라이브 방송에서 다시 담아주세요.',
      'error',
    );
    await fetchCart();
  };

  const handleUpdateQuantity = async (cartItemId: string, newQuantity: number) => {
    if (newQuantity < 1 || newQuantity > 10) return;
    try {
      await apiClient.patch(`/cart/${cartItemId}`, { quantity: newQuantity });
      await fetchCart();
    } catch (err: any) {
      console.error('Failed to update quantity:', err);
      showToast(`수량 변경에 실패했습니다: ${err.message}`, 'error');
    }
  };

  const handleRemoveItem = async (cartItemId: string) => {
    const confirmed = await confirm({
      title: '상품 삭제',
      message: '이 상품을 장바구니에서 삭제하시겠습니까?',
      confirmText: '삭제',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await apiClient.delete(`/cart/${cartItemId}`);
      await fetchCart();
    } catch (err: any) {
      console.error('Failed to remove item:', err);
      showToast('삭제에 실패했습니다.', 'error');
    }
  };

  const handleRemoveExpiredItems = async () => {
    const expiredItems =
      cart?.items.filter(
        (item) =>
          item.status === 'EXPIRED' ||
          (item.expiresAt &&
            item.status === 'ACTIVE' &&
            new Date(item.expiresAt).getTime() <= Date.now()),
      ) ?? [];
    if (expiredItems.length === 0) return;
    try {
      await Promise.all(expiredItems.map((item) => apiClient.delete(`/cart/${item.id}`)));
      await fetchCart();
      showToast('만료된 상품을 삭제했습니다.', 'success');
    } catch {
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  const hasExpiredItems = cart?.items.some(
    (item) =>
      item.status === 'EXPIRED' ||
      (item.expiresAt &&
        item.status === 'ACTIVE' &&
        new Date(item.expiresAt).getTime() <= Date.now()),
  );

  if (isLoading) {
    return (
      <>
        <div className="min-h-screen bg-primary-black flex items-center justify-center">
          <Body className="text-primary-text">장바구니를 불러오는 중...</Body>
        </div>
        <BottomTabBar />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-primary-black pb-bottom-nav">
        {/* Header */}
        <div className="bg-content-bg border-b border-border-color sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-content-bg rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-primary-text" />
            </button>
            <Heading1 className="text-primary-text flex items-center gap-2">
              <ShoppingCart className="w-8 h-8" />
              장바구니
            </Heading1>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6">
          {error && (
            <div className="bg-error/10 border border-error rounded-xl p-4 mb-6 flex items-center justify-between gap-3">
              <Body className="text-error flex-1">{error}</Body>
              <Button variant="outline" size="sm" onClick={fetchCart}>
                재시도
              </Button>
            </div>
          )}

          {cart && cart.items.length === 0 ? (
            <CartEmptyState />
          ) : (
            cart && (
              <>
                {/* Earliest Timer Warning */}
                {cart.earliestExpiration && (
                  <div className="bg-hot-pink/10 border border-hot-pink/20 rounded-xl p-4 mb-6 flex flex-col sm:flex-row gap-2">
                    <div>
                      <Body className="text-hot-pink font-bold mb-1">
                        예약 시간이 얼마 남지 않았습니다!
                      </Body>
                      <Caption className="text-secondary-text">
                        시간 내에 결제하지 않으면 예약이 자동으로 취소됩니다.
                      </Caption>
                    </div>
                    <CartTimer expiresAt={cart.earliestExpiration} onExpired={handleCartExpired} />
                  </div>
                )}

                {/* Cart Items */}
                <div className="space-y-4 mb-6">
                  {cart.items.map((item) => (
                    <CartItemCard
                      key={item.id}
                      item={item}
                      onUpdateQuantity={handleUpdateQuantity}
                      onRemove={handleRemoveItem}
                      onTimerExpired={handleCartExpired}
                    />
                  ))}
                </div>

                <CartSummaryCard
                  itemCount={cart.itemCount}
                  subtotal={cart.subtotal}
                  totalShippingFee={cart.totalShippingFee}
                  grandTotal={cart.grandTotal}
                />

                {/* Action Buttons */}
                <div className="space-y-4">
                  {hasExpiredItems && (
                    <Button
                      variant="outline"
                      size="md"
                      fullWidth
                      onClick={handleRemoveExpiredItems}
                    >
                      만료 상품 삭제
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="md"
                    fullWidth
                    onClick={() => {
                      if (!hasExpiredItems) {
                        router.push('/checkout');
                      }
                    }}
                    disabled={hasExpiredItems}
                  >
                    {hasExpiredItems
                      ? '만료된 상품이 있습니다'
                      : `${formatPrice(cart.grandTotal)} 결제하기`}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    fullWidth
                    onClick={() => router.push('/shop')}
                  >
                    쇼핑 계속하기
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

export default function CartPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-primary-black flex items-center justify-center">
          <Body className="text-primary-text">장바구니를 불러오는 중...</Body>
        </div>
      }
    >
      <CartPageContent />
    </Suspense>
  );
}
