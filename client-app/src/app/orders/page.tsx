'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { Display, Heading2, Body } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { useOrdersInfinite, useAllOrdersForCounts } from '@/lib/hooks/queries/use-orders';
import { useToast } from '@/components/common/Toast';
import { apiClient } from '@/lib/api/client';
import { OrderStatus } from '@/lib/types';
import Image from 'next/image';
import { Package, Clock, CheckCircle, XCircle, ShoppingBag } from 'lucide-react';
import { formatPrice } from '@/lib/utils/price';

const STATUS_TABS: { label: string; value: OrderStatus | 'ALL' }[] = [
  { label: '전체', value: 'ALL' },
  { label: '입금 대기', value: OrderStatus.PENDING_PAYMENT },
  { label: '결제 완료', value: OrderStatus.PAYMENT_CONFIRMED },
  { label: '취소', value: OrderStatus.CANCELLED },
];

type DateFilterValue = '3months' | '6months' | '1year' | 'all';

const DATE_FILTER_CHIPS: { label: string; value: DateFilterValue }[] = [
  { label: '최근 3개월', value: '3months' },
  { label: '6개월', value: '6months' },
  { label: '1년', value: '1year' },
  { label: '전체', value: 'all' },
];

function getStartDateForFilter(filter: DateFilterValue): string | undefined {
  if (filter === 'all') return undefined;
  const now = new Date();
  if (filter === '3months') now.setMonth(now.getMonth() - 3);
  else if (filter === '6months') now.setMonth(now.getMonth() - 6);
  else if (filter === '1year') now.setFullYear(now.getFullYear() - 1);
  return now.toISOString().slice(0, 10);
}

const EMPTY_STATE_MESSAGES: Partial<Record<OrderStatus | 'ALL', string>> = {
  ALL: '아직 주문 내역이 없어요',
  [OrderStatus.PENDING_PAYMENT]: '입금 대기 중인 주문이 없어요',
  [OrderStatus.PAYMENT_CONFIRMED]: '결제 완료된 주문이 없어요',
  [OrderStatus.CANCELLED]: '취소된 주문이 없어요',
};

export default function OrdersPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'ALL'>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilterValue>('3months');
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const startDate = getStartDateForFilter(dateFilter);

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useOrdersInfinite(selectedStatus === 'ALL' ? undefined : selectedStatus, startDate, undefined);

  const { data: allOrdersData } = useAllOrdersForCounts();

  const allOrders = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  const allOrdersForCounts = allOrdersData?.items ?? [];
  const statusCounts = allOrdersForCounts.reduce<Record<string, number>>((acc, order) => {
    acc[order.status] = (acc[order.status] ?? 0) + 1;
    return acc;
  }, {});
  const pendingOrders = allOrdersForCounts.filter(
    (o) => o.status === 'PENDING_PAYMENT' && o.paymentStatus === 'PENDING',
  );

  // Deduplicate pinned orders from main list
  const pinnedOrderIds = new Set(pendingOrders.map((o) => o.id));
  const displayOrders =
    selectedStatus === 'ALL' && pendingOrders.length > 0
      ? allOrders.filter((o) => !pinnedOrderIds.has(o.id))
      : allOrders;

  // Intersection observer for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleStatusChange = (status: OrderStatus | 'ALL') => {
    setSelectedStatus(status);
  };

  // Use global formatPrice from @/lib/utils/price (imported at top)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleReorder = async (
    orderId: string,
    items: Array<{ productId: string; quantity: number; color?: string; size?: string }>,
  ) => {
    setReorderingId(orderId);
    try {
      await Promise.all(
        items.map((item) =>
          apiClient.post('/cart', {
            productId: item.productId,
            quantity: item.quantity,
            ...(item.color ? { color: item.color } : {}),
            ...(item.size ? { size: item.size } : {}),
          }),
        ),
      );
      showToast('장바구니에 담았습니다', 'success');
    } catch {
      showToast('장바구니 담기에 실패했습니다', 'error');
    } finally {
      setReorderingId(null);
    }
  };

  const getOrderRowStatusInfo = (orderStatus: string, paymentStatus: string) => {
    if (orderStatus === 'CANCELLED') {
      return { text: '주문 취소', color: 'text-error', icon: XCircle, bgColor: 'bg-error/20' };
    }
    if (orderStatus === 'PAYMENT_CONFIRMED') {
      return {
        text: '결제 완료',
        color: 'text-success',
        icon: CheckCircle,
        bgColor: 'bg-success/10',
      };
    }
    switch (paymentStatus) {
      case 'PENDING':
        return { text: '입금 대기', color: 'text-warning', icon: Clock, bgColor: 'bg-warning/20' };
      case 'CONFIRMED':
        return {
          text: '결제 확인',
          color: 'text-success',
          icon: CheckCircle,
          bgColor: 'bg-success/10',
        };
      case 'FAILED':
        return { text: '결제 실패', color: 'text-error', icon: XCircle, bgColor: 'bg-error/20' };
      default:
        return {
          text: paymentStatus,
          color: 'text-secondary-text',
          icon: Package,
          bgColor: 'bg-border-color',
        };
    }
  };

  const canReorder = (orderStatus: string) =>
    orderStatus !== 'CANCELLED' && orderStatus !== 'PENDING_PAYMENT';

  if (authLoading || (isLoading && allOrders.length === 0)) {
    return (
      <>
        <div className="min-h-screen bg-primary-black py-6 px-4 pb-24">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <Display className="text-hot-pink mb-2">주문 내역</Display>
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-content-bg rounded-2xl border border-border-color overflow-hidden animate-pulse"
                >
                  <div className="p-4 border-b border-border-color">
                    <div className="h-4 bg-border-color/50 rounded w-32 mb-2" />
                    <div className="h-3 bg-border-color/50 rounded w-48" />
                  </div>
                  <div className="p-4">
                    <div className="h-4 bg-border-color/50 rounded w-full mb-2" />
                    <div className="h-3 bg-border-color/50 rounded w-24" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <BottomTabBar />
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="min-h-screen bg-primary-black py-12 px-4 pb-24">
          <div className="max-w-4xl mx-auto text-center">
            <Display className="text-error mb-4">오류</Display>
            <Body className="text-secondary-text mb-6">주문 내역을 불러오는데 실패했습니다.</Body>
            <Button variant="primary" onClick={() => window.location.reload()}>
              다시 시도
            </Button>
          </div>
        </div>
        <BottomTabBar />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-primary-black py-6 px-4 pb-24">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-4">
            <Display className="text-hot-pink mb-1">주문 내역</Display>
            <Body className="text-secondary-text">{total > 0 ? `총 ${total}개의 주문` : ''}</Body>
          </div>

          {/* Date Period Filter Chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
            {DATE_FILTER_CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => setDateFilter(chip.value)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  dateFilter === chip.value
                    ? 'bg-hot-pink text-white'
                    : 'bg-content-bg text-secondary-text border border-border-color hover:border-hot-pink/30'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
            {STATUS_TABS.map((tab) => {
              const count = tab.value === 'ALL' ? allOrdersData?.total : statusCounts[tab.value];
              const hasPendingBadge = tab.value === OrderStatus.PENDING_PAYMENT && (count ?? 0) > 0;
              return (
                <button
                  key={tab.value}
                  onClick={() => handleStatusChange(tab.value)}
                  className={`relative flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedStatus === tab.value
                      ? 'bg-hot-pink/20 text-hot-pink border border-hot-pink/40'
                      : 'bg-content-bg text-secondary-text border border-border-color hover:border-hot-pink/30'
                  }`}
                >
                  {hasPendingBadge && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-hot-pink" />
                  )}
                  {tab.label}
                  {count != null && count > 0 && (
                    <span
                      className={`ml-1 text-xs ${
                        selectedStatus === tab.value ? 'text-hot-pink/80' : 'text-secondary-text/70'
                      }`}
                    >
                      ({count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Pending Payment Pinned Section */}
          {selectedStatus === 'ALL' && pendingOrders.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-hot-pink" />
                <Body className="text-hot-pink font-semibold text-sm">
                  입금 대기 ({pendingOrders.length}건)
                </Body>
              </div>
              <div className="space-y-2">
                {pendingOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-hot-pink/5 border border-hot-pink/30 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:border-hot-pink/60 transition-colors"
                    onClick={() => router.push(`/orders/${order.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <Body className="text-primary-text font-semibold text-sm truncate">
                        {order.items[0]?.productName}
                        {order.items.length > 1 && ` 외 ${order.items.length - 1}개`}
                      </Body>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <Body className="text-hot-pink font-bold text-sm">
                        {formatPrice(order.total)}
                      </Body>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/orders/${order.id}`);
                        }}
                      >
                        입금 확인 →
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {displayOrders.length === 0 && !isLoading && (
            <div className="text-center py-16">
              <Package className="w-12 h-12 text-secondary-text mx-auto mb-4 opacity-30" />
              <Heading2 className="text-primary-text mb-2">
                {EMPTY_STATE_MESSAGES[selectedStatus]}
              </Heading2>
              {selectedStatus === 'ALL' ? (
                <>
                  <Body className="text-secondary-text mb-8">
                    라이브 방송에서 쇼핑을 시작해보세요
                  </Body>
                  <Button variant="primary" size="lg" onClick={() => router.push('/shop')}>
                    쇼핑하러 가기
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  className="mt-6"
                  onClick={() => handleStatusChange('ALL')}
                >
                  전체 주문 보기
                </Button>
              )}
            </div>
          )}

          {/* Orders List */}
          {displayOrders.length > 0 && (
            <div className="space-y-4">
              {displayOrders.map((order) => {
                const paymentStatus = getOrderRowStatusInfo(order.status, order.paymentStatus);
                const StatusIcon = paymentStatus.icon;
                const isCancelled = order.status === 'CANCELLED';
                const showReorder = canReorder(order.status);

                return (
                  <div
                    key={order.id}
                    className={`bg-content-bg rounded-2xl border overflow-hidden transition-colors cursor-pointer ${
                      isCancelled
                        ? 'border-border-color opacity-60'
                        : order.status === 'PENDING_PAYMENT'
                          ? 'border-hot-pink/40 hover:border-hot-pink/60'
                          : 'border-border-color hover:border-hot-pink/30'
                    }`}
                    onClick={() => router.push(`/orders/${order.id}`)}
                  >
                    {/* Order Header */}
                    <div className="p-4 border-b border-border-color">
                      <div className="flex items-center justify-between mb-1">
                        <Body className="text-secondary-text text-sm">
                          {formatDate(order.createdAt)}
                        </Body>
                        <div
                          className={`${paymentStatus.bgColor} ${paymentStatus.color} px-3 py-1 rounded-full flex items-center gap-1.5`}
                        >
                          <StatusIcon className="w-3.5 h-3.5" />
                          <Body className="text-xs font-semibold">{paymentStatus.text}</Body>
                        </div>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="p-4">
                      {order.items.slice(0, 2).map((item, index) => (
                        <div
                          key={item.id}
                          className={index > 0 ? 'mt-3 pt-3 border-t border-border-color' : ''}
                        >
                          <div className="flex items-start gap-3">
                            {/* Product image */}
                            <div className="w-14 h-14 rounded-lg bg-border-color/30 flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                              {item.imageUrl ? (
                                <Image
                                  src={item.imageUrl}
                                  alt={item.productName}
                                  fill
                                  className="object-cover"
                                  sizes="56px"
                                />
                              ) : (
                                <Package className="w-6 h-6 text-secondary-text/40" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 pr-2">
                              <Body className="text-primary-text font-semibold mb-0.5 truncate">
                                {item.productName}
                              </Body>
                              {(item.color || item.size) && (
                                <div className="text-secondary-text text-xs mb-0.5">
                                  {[item.color, item.size].filter(Boolean).join(' · ')}
                                </div>
                              )}
                              <Body className="text-secondary-text text-sm">
                                {formatPrice(item.price)} × {item.quantity}개
                              </Body>
                            </div>
                            <Body className="text-primary-text font-bold flex-shrink-0">
                              {formatPrice(Number(item.price) * item.quantity)}
                            </Body>
                          </div>
                        </div>
                      ))}
                      {order.items.length > 2 && (
                        <Body className="text-secondary-text text-sm mt-2">
                          + 외 {order.items.length - 2}개 더
                        </Body>
                      )}

                      {/* Total */}
                      <div className="mt-4 pt-4 border-t border-border-color flex justify-between items-center">
                        <div>
                          <Body className="text-secondary-text text-sm mb-1">총 결제 금액</Body>
                        </div>
                        <Display className="text-hot-pink">{formatPrice(order.total)}</Display>
                      </div>
                    </div>

                    {/* Actions */}
                    {(order.status === 'PENDING_PAYMENT' && order.paymentStatus === 'PENDING') ||
                    showReorder ? (
                      <div
                        className="p-4 border-t border-border-color bg-content-bg/50 flex gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {order.status === 'PENDING_PAYMENT' &&
                          order.paymentStatus === 'PENDING' && (
                            <Button
                              variant="primary"
                              size="sm"
                              fullWidth
                              onClick={() => router.push(`/orders/${order.id}`)}
                            >
                              입금 정보 확인 →
                            </Button>
                          )}
                        {showReorder && (
                          <Button
                            variant="outline"
                            size="sm"
                            fullWidth
                            disabled={reorderingId === order.id}
                            onClick={() =>
                              handleReorder(
                                order.id,
                                order.items.map((i) => ({
                                  productId: i.productId,
                                  quantity: i.quantity,
                                  color: i.color,
                                  size: i.size,
                                })),
                              )
                            }
                          >
                            <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />
                            {reorderingId === order.id ? '담는 중...' : '다시 주문하기'}
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-4" />

          {/* Loading more spinner */}
          {isFetchingNextPage && (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hot-pink" />
            </div>
          )}
        </div>
      </div>

      <BottomTabBar />
    </>
  );
}
