'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { OrderStatus } from '@live-commerce/shared-types';
import { Button } from '@/components/common/Button';
import { Display, Body, Heading2 } from '@/components/common/Typography';
import { useToast } from '@/components/common/Toast';
import { useConfirm } from '@/components/common/ConfirmDialog';

interface ShippingAddress {
  fullName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
}

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  quantity: number;
  price: number;
  color?: string;
  size?: string;
}

interface OrderDetailResponse {
  id: string;
  userId: string;
  userEmail: string;
  depositorName: string;
  instagramId: string;
  shippingAddress: ShippingAddress | null;
  status: 'PENDING_PAYMENT' | 'PAYMENT_CONFIRMED' | 'CANCELLED';
  paymentStatus: string;
  shippingStatus: string;
  subtotal: number | string;
  shippingFee: number | string;
  total: number | string;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    productImage?: string;
    quantity: number;
    price: number | string;
    color?: string;
    size?: string;
  }>;
  customer: {
    id: string;
    email: string;
    name: string;
    instagramId: string | null;
    depositorName: string | null;
  };
}

interface OrderDetail {
  id: string;
  userId: string;
  userEmail: string;
  depositorName: string;
  instagramId: string;
  shippingAddress: ShippingAddress | null;
  status: 'PENDING_PAYMENT' | 'PAYMENT_CONFIRMED' | 'CANCELLED';
  paymentStatus: string;
  shippingStatus: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  items: OrderItem[];
  customer: {
    id: string;
    email: string;
    name: string;
    instagramId: string | null;
    depositorName: string | null;
  };
}

const ORDER_STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  PENDING_PAYMENT: '입금 대기',
  PAYMENT_CONFIRMED: '입금 완료',
  CANCELLED: '취소',
};

const ORDER_STATUS_UPDATE_OPTIONS = [
  { value: 'PENDING_PAYMENT', label: '입금 대기' },
  { value: 'PAYMENT_CONFIRMED', label: '입금 완료' },
  { value: 'CANCELLED', label: '취소' },
];

const normalizeOrderDetail = (order: OrderDetailResponse): OrderDetail => ({
  ...order,
  subtotal: Number(order.subtotal),
  shippingFee: Number(order.shippingFee),
  total: Number(order.total),
  items: order.items.map((item) => ({
    ...item,
    price: Number(item.price),
  })),
});

export default function AdminOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = typeof params.id === 'string' ? params.id : undefined;
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [savingQuantityItemId, setSavingQuantityItemId] = useState<string | null>(null);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});

  const fetchOrderDetail = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<OrderDetailResponse>(`/admin/orders/${orderId}`);
      const normalizedOrder = normalizeOrderDetail(response.data);
      setOrder(normalizedOrder);
      setQuantityDrafts(
        Object.fromEntries(normalizedOrder.items.map((item) => [item.id, String(item.quantity)])),
      );
    } catch (err: any) {
      console.error('Failed to fetch order detail:', err);
      setError(err.response?.data?.message || '주문 상세를 불러오지 못했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const handleOrderStatusChange = async (newStatus: OrderDetail['status']) => {
    if (!order || newStatus === order.status) return;

    const statusLabel = ORDER_STATUS_LABELS[newStatus] || newStatus;
    const confirmed = await confirm({
      title: '주문 상태 변경',
      message: `주문번호: ${order.id}\n상태를 "${statusLabel}"(으)로 변경하시겠습니까?`,
      confirmText: '변경',
      variant: newStatus === 'CANCELLED' ? 'danger' : 'info',
    });

    if (!confirmed) return;

    setIsUpdating(true);
    try {
      await apiClient.patch(`/admin/orders/${orderId}/status`, { status: newStatus });
      showToast(`주문 상태가 "${statusLabel}"(으)로 변경되었습니다`, 'success');
      await fetchOrderDetail();
    } catch (err: any) {
      showToast(err.response?.data?.message || '상태 변경에 실패했습니다', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveItem = async (item: OrderItem) => {
    if (!order) return;

    const confirmed = await confirm({
      title: '상품 삭제',
      message: `"${item.productName}"을(를) 주문에서 삭제하시겠습니까?\n재고가 복원됩니다.`,
      confirmText: '삭제',
      variant: 'danger',
    });
    if (!confirmed) return;

    setRemovingItemId(item.id);
    try {
      await apiClient.delete(`/admin/orders/${order.id}/items/${item.id}`);
      showToast(`"${item.productName}" 상품이 삭제되었습니다`, 'success');
      await fetchOrderDetail();
    } catch (err: any) {
      showToast(err.response?.data?.message || '상품 삭제에 실패했습니다', 'error');
    } finally {
      setRemovingItemId(null);
    }
  };

  const handleQuantityDraftChange = (itemId: string, value: string) => {
    setQuantityDrafts((current) => ({ ...current, [itemId]: value }));
  };

  const handleUpdateItemQuantity = async (item: OrderItem) => {
    if (!order) return;

    const draftValue = quantityDrafts[item.id] ?? String(item.quantity);
    const nextQuantity = Number.parseInt(draftValue, 10);

    if (!Number.isInteger(nextQuantity) || nextQuantity < 1) {
      showToast('수량은 1 이상의 숫자여야 합니다', 'error');
      setQuantityDrafts((current) => ({ ...current, [item.id]: String(item.quantity) }));
      return;
    }

    if (nextQuantity === item.quantity) {
      return;
    }

    setSavingQuantityItemId(item.id);
    try {
      await apiClient.patch(`/admin/orders/${order.id}/items/${item.id}`, {
        quantity: nextQuantity,
      });
      showToast(`"${item.productName}" 수량이 ${nextQuantity}개로 변경되었습니다`, 'success');
      await fetchOrderDetail();
    } catch (err: any) {
      showToast(err.response?.data?.message || '수량 변경에 실패했습니다', 'error');
      setQuantityDrafts((current) => ({ ...current, [item.id]: String(item.quantity) }));
    } finally {
      setSavingQuantityItemId(null);
    }
  };

  const handleDeleteOrder = async () => {
    if (!order || order.status !== 'CANCELLED') return;

    const confirmed = await confirm({
      title: '주문 삭제',
      message: `주문번호 ${order.id}을(를) 삭제하시겠습니까?\n삭제된 주문은 목록에서 숨겨집니다.`,
      confirmText: '삭제',
      variant: 'danger',
    });
    if (!confirmed) return;

    setIsUpdating(true);
    try {
      await apiClient.delete(`/admin/orders/${orderId}`);
      showToast('주문이 삭제되었습니다', 'success');
      router.push('/admin/orders');
    } catch (err: any) {
      showToast(err.response?.data?.message || '삭제에 실패했습니다', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getOrderStatusBadge = (status: string) => {
    const colors: Partial<Record<OrderStatus, string>> = {
      PENDING_PAYMENT: 'bg-warning/10 text-warning border-warning',
      PAYMENT_CONFIRMED: 'bg-success/10 text-success border-success',
      CANCELLED: 'bg-error/10 text-error border-error',
    };
    const labels = ORDER_STATUS_LABELS;

    return (
      <span
        className={`px-3 py-2 rounded-button border text-sm font-medium ${
          colors[status as OrderStatus] ||
          'bg-secondary-text/10 text-secondary-text border-secondary-text'
        }`}
      >
        {labels[status as OrderStatus] || status}
      </span>
    );
  };

  if (!orderId)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hot-pink" />
      </div>
    );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Body>주문 상세를 불러오는 중...</Body>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-6">
        <div className="bg-error/10 border border-error rounded-button p-4">
          <Body className="text-error">{error || '주문을 찾을 수 없습니다'}</Body>
        </div>
        <Button onClick={() => router.push('/admin/orders')}>주문 목록으로</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Display className="text-hot-pink mb-2">주문 상세</Display>
          <Body className="text-secondary-text font-mono">{order.id}</Body>
        </div>
        <Button variant="outline" onClick={() => router.push('/admin/orders')}>
          ← 주문 목록
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-content-bg rounded-button p-6">
          <Body className="text-secondary-text text-caption mb-2">주문 상태</Body>
          <select
            value={order.status}
            onChange={(e) => handleOrderStatusChange(e.target.value as OrderDetail['status'])}
            disabled={
              isUpdating ||
              !ORDER_STATUS_UPDATE_OPTIONS.some((option) => option.value === order.status)
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-button focus:outline-none focus:ring-2 focus:ring-hot-pink bg-white"
          >
            {ORDER_STATUS_UPDATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {!ORDER_STATUS_UPDATE_OPTIONS.some((option) => option.value === order.status) && (
            <p className="mt-3 text-xs text-secondary-text">
              배송 상태는 배송 탭에서 배송 완료 처리 후 자동 반영됩니다.
            </p>
          )}
          <div className="mt-3">{getOrderStatusBadge(order.status)}</div>
          {order.status === 'CANCELLED' && (
            <button
              onClick={handleDeleteOrder}
              disabled={isUpdating}
              className="mt-3 w-full px-4 py-2 min-h-[44px] rounded-lg border border-gray-600 text-gray-400 hover:text-error hover:border-error hover:bg-error/10 text-sm font-medium transition-colors"
            >
              주문 삭제
            </button>
          )}
        </div>

        <div className="bg-content-bg rounded-button p-6">
          <Body className="text-secondary-text text-caption mb-2">결제 상태</Body>
          <Body>{order.paymentStatus === 'CONFIRMED' ? '결제 완료' : '미확정'}</Body>
        </div>

        <div className="bg-content-bg rounded-button p-6">
          <Body className="text-secondary-text text-caption mb-2">배송 상태</Body>
          <Body>{order.shippingStatus}</Body>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-content-bg rounded-button p-6">
          <Heading2 className="text-hot-pink mb-4">주문 정보</Heading2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <Body className="text-secondary-text">주문일</Body>
              <Body>{formatDate(order.createdAt)}</Body>
            </div>
            <div className="flex justify-between">
              <Body className="text-secondary-text">결제일</Body>
              <Body>{formatDate(order.paidAt)}</Body>
            </div>
            <div className="flex justify-between">
              <Body className="text-secondary-text">발송일</Body>
              <Body>{formatDate(order.shippedAt)}</Body>
            </div>
            <div className="flex justify-between">
              <Body className="text-secondary-text">배송완료일</Body>
              <Body>{formatDate(order.deliveredAt)}</Body>
            </div>
            <hr className="border-gray-200" />
            <div className="flex justify-between">
              <Body className="text-secondary-text">소계</Body>
              <Body>{formatCurrency(order.subtotal)}</Body>
            </div>
            <div className="flex justify-between">
              <Body className="text-secondary-text">배송비</Body>
              <Body>{formatCurrency(order.shippingFee)}</Body>
            </div>
            <div className="flex justify-between font-bold">
              <Body className="font-bold">합계</Body>
              <Body className="text-hot-pink font-bold">{formatCurrency(order.total)}</Body>
            </div>
          </div>
        </div>

        <div className="bg-content-bg rounded-button p-6">
          <Heading2 className="text-hot-pink mb-4">고객 정보</Heading2>
          <div className="space-y-3">
            <div>
              <Body className="text-secondary-text text-caption">이름</Body>
              <Body>{order.customer.name}</Body>
            </div>
            <div>
              <Body className="text-secondary-text text-caption">이메일</Body>
              <Body>{order.customer.email}</Body>
            </div>
            <div>
              <Body className="text-secondary-text text-caption">인스타그램</Body>
              <Body className="text-hot-pink">
                @{(order.customer.instagramId || '-').replace(/^@/, '')}
              </Body>
            </div>
            <div>
              <Body className="text-secondary-text text-caption">입금자명</Body>
              <Body>{order.depositorName}</Body>
            </div>
          </div>

          {order.shippingAddress && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <Body className="text-secondary-text text-caption mb-2">배송지</Body>
              <Body className="font-medium">{order.shippingAddress.fullName}</Body>
              <Body>{order.shippingAddress.address1}</Body>
              {order.shippingAddress.address2 && <Body>{order.shippingAddress.address2}</Body>}
              <Body>
                {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                {order.shippingAddress.zip}
              </Body>
            </div>
          )}
        </div>
      </div>

      <div className="bg-content-bg rounded-button p-6">
        <Heading2 className="text-hot-pink mb-4">주문 상품 ({order.items.length})</Heading2>
        <div className="space-y-4">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-4 bg-white rounded-button p-4 border border-gray-100 md:flex-row md:items-center"
            >
              {item.productImage && (
                <img
                  src={item.productImage}
                  alt={item.productName}
                  className="w-16 h-16 object-cover rounded-lg"
                />
              )}
              <div className="flex-1 min-w-0">
                <Body className="font-medium truncate">{item.productName}</Body>
                {(item.color || item.size) && (
                  <Body className="text-secondary-text text-caption">
                    {[item.color, item.size].filter(Boolean).join(' / ')}
                  </Body>
                )}
              </div>
              <div className="text-right md:min-w-[120px]">
                <Body className="font-medium">{formatCurrency(item.price)}</Body>
                <Body className="text-secondary-text text-caption">
                  합계 {formatCurrency(item.price * item.quantity)}
                </Body>
              </div>
              {order.status === 'PENDING_PAYMENT' ? (
                <div className="flex flex-col gap-2 md:min-w-[170px]">
                  <label className="text-xs text-secondary-text">수량</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={quantityDrafts[item.id] ?? String(item.quantity)}
                      onChange={(e) => handleQuantityDraftChange(item.id, e.target.value)}
                      disabled={isUpdating || savingQuantityItemId === item.id}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-button focus:outline-none focus:ring-2 focus:ring-hot-pink bg-white"
                    />
                    <button
                      onClick={() => handleUpdateItemQuantity(item)}
                      disabled={
                        isUpdating ||
                        savingQuantityItemId === item.id ||
                        (quantityDrafts[item.id] ?? String(item.quantity)) === String(item.quantity)
                      }
                      className="px-3 py-2 min-h-[44px] rounded-lg border border-hot-pink text-hot-pink hover:bg-hot-pink hover:text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingQuantityItemId === item.id ? '저장 중...' : '수량 저장'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-right md:min-w-[100px]">
                  <Body className="text-secondary-text text-caption">수량</Body>
                  <Body className="font-medium">x{item.quantity}</Body>
                </div>
              )}
              {order.status === 'PENDING_PAYMENT' && order.items.length > 1 && (
                <button
                  onClick={() => handleRemoveItem(item)}
                  disabled={
                    removingItemId === item.id || isUpdating || savingQuantityItemId === item.id
                  }
                  className="px-3 py-2 min-h-[44px] rounded-lg border border-gray-300 text-gray-400 hover:text-error hover:border-error hover:bg-error/10 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {removingItemId === item.id ? '삭제 중...' : '삭제'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
