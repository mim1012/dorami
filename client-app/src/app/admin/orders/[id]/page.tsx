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
  phone: string;
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

interface OrderDetail {
  id: string;
  userId: string;
  userEmail: string;
  depositorName: string;
  instagramId: string;
  shippingAddress: ShippingAddress | null;
  status: 'PENDING_PAYMENT' | 'PAYMENT_CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
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

const ORDER_STATUS_LABELS: Record<OrderDetail['status'], string> = {
  PENDING_PAYMENT: '입금 대기',
  PAYMENT_CONFIRMED: '입금 완료',
  SHIPPED: '배송중',
  DELIVERED: '배송 완료',
  CANCELLED: '취소',
};

const ORDER_STATUS_UPDATE_OPTIONS = [
  { value: 'PENDING_PAYMENT', label: '입금 대기' },
  { value: 'PAYMENT_CONFIRMED', label: '입금 완료' },
  { value: 'CANCELLED', label: '취소' },
];

export default function AdminOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchOrderDetail = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<OrderDetail>(`/admin/orders/${orderId}`);
      setOrder(response.data);
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
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getOrderStatusBadge = (status: string) => {
    const colors: Record<OrderDetail['status'], string> = {
      PENDING_PAYMENT: 'bg-warning/10 text-warning border-warning',
      PAYMENT_CONFIRMED: 'bg-success/10 text-success border-success',
      SHIPPED: 'bg-info/10 text-info border-info',
      DELIVERED: 'bg-success/10 text-success border-success',
      CANCELLED: 'bg-error/10 text-error border-error',
    };
    const labels = ORDER_STATUS_LABELS;

    return (
      <span
        className={`px-3 py-2 rounded-button border text-sm font-medium ${
          colors[status as OrderStatus] || 'bg-secondary-text/10 text-secondary-text border-secondary-text'
        }`}
      >
        {labels[status as OrderStatus] || status}
      </span>
    );
  };

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
            disabled={isUpdating || !ORDER_STATUS_UPDATE_OPTIONS.some((option) => option.value === order.status)}
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
              <Body className="text-hot-pink">@{order.customer.instagramId || '-'}</Body>
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
                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}
              </Body>
              <Body>Tel: {order.shippingAddress.phone}</Body>
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
              className="flex items-center gap-4 bg-white rounded-button p-4 border border-gray-100"
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
              <div className="text-right">
                <Body className="font-medium">{formatCurrency(item.price)}</Body>
                <Body className="text-secondary-text text-caption">x{item.quantity}</Body>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
