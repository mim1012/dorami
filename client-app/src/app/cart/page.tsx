'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/hooks/use-auth';
import { apiClient } from '@/lib/api/client';
import { getUserMessage } from '@/lib/errors/error-messages';
import {
  useCart,
  useUpdateCartItem,
  useRemoveCartItem,
  cartKeys,
} from '@/lib/hooks/queries/use-cart';
import { Heading1, Body, Caption } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import CartTimer from '@/components/cart/CartTimer';
import { CartItemCard } from '@/components/cart/CartItemCard';
import { CartSummaryCard } from '@/components/cart/CartSummaryCard';
import { CartEmptyState } from '@/components/cart/CartEmptyState';
import { formatPrice } from '@/lib/utils/format';
import { calculateDynamicShipping } from '@/lib/utils/shipping';
import { ShoppingCart, ArrowLeft, Trash2 } from 'lucide-react';
import { useToast } from '@/components/common/Toast';
import { useConfirm } from '@/components/common/ConfirmDialog';

function CartPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const {
    data: cart,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useCart({ enabled: !authLoading });

  const updateCartItem = useUpdateCartItem();
  const removeCartItem = useRemoveCartItem();

  // Selection state
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Keep selection in sync when cart items change (remove ids no longer in cart)
  useEffect(() => {
    if (!cart) return;
    const validIds = new Set(cart.items.map((i) => i.id));
    setSelectedItemIds((prev) => {
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [cart]);

  useEffect(() => {
    if (searchParams.get('expired') === '1') {
      showToast('예약 시간이 만료되어 장바구니로 돌아왔습니다. 다시 담아주세요.', 'error');
    }
  }, [searchParams, showToast]);

  const handleCartExpired = () => {
    showToast(
      '예약 시간이 만료되어 장바구니에서 제거되었습니다. 라이브 방송에서 다시 담아주세요.',
      'error',
    );
    queryClient.invalidateQueries({ queryKey: cartKeys.all });
  };

  const handleUpdateQuantity = (cartItemId: string, newQuantity: number) => {
    if (newQuantity < 1 || newQuantity > 10) return;
    updateCartItem.mutate(
      { itemId: cartItemId, quantity: newQuantity },
      {
        onError: (err: any) => {
          showToast(getUserMessage(err), 'error');
        },
      },
    );
  };

  const handleRemoveItem = async (cartItemId: string) => {
    const confirmed = await confirm({
      title: '상품 삭제',
      message: '이 상품을 장바구니에서 삭제하시겠습니까?',
      confirmText: '삭제',
      variant: 'danger',
    });
    if (!confirmed) return;
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      next.delete(cartItemId);
      return next;
    });
    removeCartItem.mutate(cartItemId, {
      onError: () => {
        showToast('삭제에 실패했습니다.', 'error');
      },
    });
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
      setSelectedItemIds((prev) => {
        const expiredIds = new Set(expiredItems.map((i) => i.id));
        const next = new Set([...prev].filter((id) => !expiredIds.has(id)));
        return next;
      });
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
      showToast('만료된 상품을 삭제했습니다.', 'success');
    } catch {
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleRemoveSoldOutItems = async () => {
    const soldOutItems = cart?.items.filter((item) => item.product?.status === 'SOLD_OUT') ?? [];
    if (soldOutItems.length === 0) return;
    try {
      await Promise.all(soldOutItems.map((item) => apiClient.delete(`/cart/${item.id}`)));
      setSelectedItemIds((prev) => {
        const soldOutIds = new Set(soldOutItems.map((i) => i.id));
        const next = new Set([...prev].filter((id) => !soldOutIds.has(id)));
        return next;
      });
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
      showToast('품절된 상품을 삭제했습니다.', 'success');
    } catch {
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleRemoveSelectedItems = async () => {
    if (selectedItemIds.size === 0) return;
    const confirmed = await confirm({
      title: '선택 상품 삭제',
      message: `선택한 ${selectedItemIds.size}개 상품을 장바구니에서 삭제하시겠습니까?`,
      confirmText: '삭제',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await Promise.all([...selectedItemIds].map((id) => apiClient.delete(`/cart/${id}`)));
      setSelectedItemIds(new Set());
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
      showToast('선택한 상품을 삭제했습니다.', 'success');
    } catch {
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  // Derive active (non-expired, non-sold-out) items for selection
  const activeItems =
    cart?.items.filter(
      (item) => item.status !== 'EXPIRED' && item.product?.status !== 'SOLD_OUT',
    ) ?? [];
  const allActiveSelected =
    activeItems.length > 0 && activeItems.every((item) => selectedItemIds.has(item.id));
  const someSelected = selectedItemIds.size > 0;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItemIds(new Set(activeItems.map((item) => item.id)));
    } else {
      setSelectedItemIds(new Set());
    }
  };

  const handleItemCheckedChange = (itemId: string, checked: boolean) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
      return next;
    });
  };

  // Calculate totals based only on selected active items
  const selectedItems =
    cart?.items.filter(
      (item) =>
        selectedItemIds.has(item.id) &&
        item.status !== 'EXPIRED' &&
        item.product?.status !== 'SOLD_OUT',
    ) ?? [];
  const selectedSubtotalCents = selectedItems.reduce(
    (sum, item) => sum + Math.round(Number(item.price) * 100) * item.quantity,
    0,
  );
  const selectedSubtotal = selectedSubtotalCents / 100;

  // Dynamic shipping based on broadcast free shipping mode
  const selectedShipping = calculateDynamicShipping(selectedItems, cart);

  const selectedTotal = selectedSubtotal + selectedShipping;

  const hasExpiredItems = cart?.items.some(
    (item) =>
      item.status === 'EXPIRED' ||
      (item.expiresAt &&
        item.status === 'ACTIVE' &&
        new Date(item.expiresAt).getTime() <= Date.now()),
  );

  const hasSoldOutItems = cart?.items.some((item) => item.product?.status === 'SOLD_OUT');

  const selectedHasExpired = [...selectedItemIds].some((id) => {
    const item = cart?.items.find((i) => i.id === id);
    return item?.status === 'EXPIRED';
  });

  const selectedHasSoldOut = [...selectedItemIds].some((id) => {
    const item = cart?.items.find((i) => i.id === id);
    return item?.product?.status === 'SOLD_OUT';
  });

  if (isLoading || authLoading) {
    return (
      <>
        <div className="min-h-screen bg-primary-black">
          <div className="flex flex-col gap-4 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-card-bg rounded-xl p-4 flex gap-3">
                <div className="w-20 h-20 bg-border-color rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-border-color rounded w-3/4" />
                  <div className="h-3 bg-border-color rounded w-1/2" />
                  <div className="h-4 bg-border-color rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
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
          {isError && (
            <div className="bg-error/10 border border-error rounded-xl p-4 mb-6 flex items-center justify-between gap-3">
              <Body className="text-error flex-1">장바구니를 불러오는데 실패했습니다.</Body>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                재시도
              </Button>
            </div>
          )}

          {cart && cart.items.length === 0 && !isFetching ? (
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

                {/* Select All row */}
                <div className="flex items-center justify-between mb-4 px-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allActiveSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-5 h-5 rounded border-border-color accent-hot-pink cursor-pointer"
                      aria-label="전체 선택"
                    />
                    <Body className="text-primary-text font-medium">
                      전체 선택{' '}
                      <Caption className="text-secondary-text">({activeItems.length}개)</Caption>
                    </Body>
                  </label>
                  {someSelected && (
                    <button
                      onClick={handleRemoveSelectedItems}
                      className="flex items-center gap-1 text-error text-sm font-medium hover:underline"
                    >
                      <Trash2 className="w-4 h-4" />
                      선택 삭제
                    </button>
                  )}
                </div>

                {/* Cart Items */}
                <div className="space-y-4 mb-6">
                  {cart.items.map((item) => (
                    <CartItemCard
                      key={item.id}
                      item={item}
                      onUpdateQuantity={handleUpdateQuantity}
                      onRemove={handleRemoveItem}
                      onTimerExpired={handleCartExpired}
                      checked={selectedItemIds.has(item.id)}
                      onCheckedChange={handleItemCheckedChange}
                    />
                  ))}
                </div>

                {/* Detailed Summary (for selected items) */}
                <CartSummaryCard
                  itemCount={selectedItems.length}
                  subtotal={selectedSubtotal}
                  totalShippingFee={selectedShipping}
                  grandTotal={selectedTotal}
                  shippingWaived={cart.shippingWaived}
                />

                {/* Secondary actions */}
                <div className="mb-6 space-y-2">
                  {hasSoldOutItems && (
                    <Button
                      variant="outline"
                      size="md"
                      fullWidth
                      onClick={handleRemoveSoldOutItems}
                    >
                      품절 상품 삭제
                    </Button>
                  )}
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
                </div>

                <Button variant="outline" size="lg" fullWidth onClick={() => router.push('/shop')}>
                  쇼핑 계속하기
                </Button>
              </>
            )
          )}
        </div>
      </div>

      {/* Sticky Bottom Price Summary Bar */}
      {cart && cart.items.length > 0 && (
        <div className="sticky bottom-[var(--bottom-tab-height,64px)] z-20 bg-content-bg border-t border-border-color shadow-lg">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <Caption className="text-secondary-text">{selectedItems.length}개 선택</Caption>
              <Body className="text-hot-pink font-bold text-lg leading-tight">
                {formatPrice(selectedTotal)}
              </Body>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={async () => {
                if (selectedItems.length === 0) {
                  showToast('결제할 상품을 선택해주세요.', 'error');
                  return;
                }
                const result = await refetch();
                const freshCart = result.data;
                const freshHasExpired = freshCart?.items.some(
                  (item) =>
                    item.status === 'EXPIRED' ||
                    (item.expiresAt &&
                      item.status === 'ACTIVE' &&
                      new Date(item.expiresAt).getTime() <= Date.now()),
                );
                const freshHasSoldOut = freshCart?.items.some(
                  (item) => selectedItemIds.has(item.id) && item.product?.status === 'SOLD_OUT',
                );
                if (
                  !freshHasExpired &&
                  !selectedHasExpired &&
                  !freshHasSoldOut &&
                  !selectedHasSoldOut
                ) {
                  router.push('/checkout');
                } else if (freshHasSoldOut || selectedHasSoldOut) {
                  showToast('품절된 상품이 포함되어 있습니다. 삭제 후 결제해주세요.', 'error');
                  queryClient.invalidateQueries({ queryKey: cartKeys.all });
                } else {
                  showToast('만료된 상품이 있습니다. 삭제 후 결제해주세요.', 'error');
                  queryClient.invalidateQueries({ queryKey: cartKeys.all });
                }
              }}
              disabled={
                selectedItems.length === 0 || selectedHasExpired || selectedHasSoldOut || isFetching
              }
            >
              {selectedHasSoldOut
                ? '품절 상품 포함'
                : selectedHasExpired
                  ? '만료된 상품 포함'
                  : '결제하기'}
            </Button>
          </div>
        </div>
      )}

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
