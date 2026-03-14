'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { Display, Heading2, Body } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { useOrdersInfinite, useAllOrdersForCounts } from '@/lib/hooks/queries/use-orders';
import { OrderStatus } from '@/lib/types';
import { Package, Clock, CheckCircle, XCircle, Truck } from 'lucide-react';

const STATUS_TABS: { label: string; value: OrderStatus | 'ALL' }[] = [
  { label: '전체', value: 'ALL' },
  { label: '입금 대기', value: OrderStatus.PENDING_PAYMENT },
  { label: '결제 완료', value: OrderStatus.PAYMENT_CONFIRMED },
  { label: '배송중', value: OrderStatus.SHIPPED },
  { label: '배송 완료', value: OrderStatus.DELIVERED },
  { label: '취소', value: OrderStatus.CANCELLED },
];

export default function OrdersPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'ALL'>('ALL');
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useOrdersInfinite(selectedStatus === 'ALL' ? undefined : selectedStatus);

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

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getOrderRowStatusInfo = (orderStatus: string, paymentStatus: string) => {
    if (orderStatus === 'CANCELLED') {
      return { text: '주문 취소', color: 'text-error', icon: XCircle, bgColor: 'bg-error/20' };
    }
    if (orderStatus === 'SHIPPED') {
      return { text: '배송 중', color: 'text-info', icon: Truck, bgColor: 'bg-blue-100/10' };
    }
    if (orderStatus === 'DELIVERED') {
      return {
        text: '배송 완료',
        color: 'text-success',
        icon: CheckCircle,
        bgColor: 'bg-success/10',
      };
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

  const getShippingStatusInfo = (status: string) => {
    switch (status) {
      case 'SHIPPED':
        return { text: '배송 중', color: 'text-info' };
      case 'DELIVERED':
        return { text: '배송 완료', color: 'text-success' };
      default:
        return null;
    }
  };

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
                      <Body className="text-secondary-text text-xs font-mono">{order.id}</Body>
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
                {selectedStatus === 'ALL' ? '주문 내역이 없습니다' : '해당 상태의 주문이 없습니다'}
              </Heading2>
              <Body className="text-secondary-text mb-8">
                {selectedStatus === 'ALL'
                  ? '라이브 방송에서 상품을 주문해보세요'
                  : '다른 상태를 선택해보세요'}
              </Body>
              {selectedStatus === 'ALL' ? (
                <Button variant="primary" size="lg" onClick={() => router.push('/live')}>
                  라이브 방송 보러 가기
                </Button>
              ) : (
                <Button variant="outline" onClick={() => handleStatusChange('ALL')}>
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
                const shippingStatus = getShippingStatusInfo(order.shippingStatus);
                const StatusIcon = paymentStatus.icon;
                const isCancelled = order.status === 'CANCELLED';

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
                      <Body className="text-secondary-text text-xs font-mono">{order.id}</Body>
                    </div>

                    {/* Order Items */}
                    <div className="p-4">
                      {order.items.slice(0, 2).map((item, index) => (
                        <div
                          key={item.id}
                          className={index > 0 ? 'mt-3 pt-3 border-t border-border-color' : ''}
                        >
                          <div className="flex justify-between items-start">
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
                              {formatPrice(item.price * item.quantity)}
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
                          {shippingStatus && (
                            <div className="flex items-center gap-1.5">
                              <Truck className={`w-3.5 h-3.5 ${shippingStatus.color}`} />
                              <Body className={`text-xs ${shippingStatus.color}`}>
                                {shippingStatus.text}
                              </Body>
                            </div>
                          )}
                        </div>
                        <Display className="text-hot-pink">{formatPrice(order.total)}</Display>
                      </div>
                    </div>

                    {/* Actions — only for PENDING_PAYMENT */}
                    {order.status === 'PENDING_PAYMENT' && order.paymentStatus === 'PENDING' && (
                      <div className="p-4 border-t border-border-color bg-content-bg/50">
                        <Button
                          variant="primary"
                          size="sm"
                          fullWidth
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/orders/${order.id}`);
                          }}
                        >
                          입금 정보 확인 →
                        </Button>
                      </div>
                    )}
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
