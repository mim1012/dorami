'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { useProfileGuard } from '@/lib/hooks/use-profile-guard';
import { Display, Heading2, Body } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { apiClient } from '@/lib/api/client';
import { Package, Clock, CheckCircle, XCircle, Truck } from 'lucide-react';

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  shippingFee: number;
}

interface Order {
  id: string;
  userId: string;
  userEmail: string;
  depositorName: string;
  instagramId: string;
  status: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  paymentStatus: string;
  shippingStatus: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export default function OrdersPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: guardLoading, isProfileComplete } = useProfileGuard();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (guardLoading || !isProfileComplete) return;

    const fetchOrders = async () => {
      try {
        const response = await apiClient.get<Order[]>('/orders');
        setOrders(response.data);
      } catch (err: any) {
        console.error('Failed to fetch orders:', err);
        setError('주문 내역을 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchOrders();
    }
  }, [user, authLoading, router]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPaymentStatusInfo = (status: string) => {
    switch (status) {
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
          text: status,
          color: 'text-secondary-text',
          icon: Package,
          bgColor: 'bg-border-color',
        };
    }
  };

  const getShippingStatusInfo = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { text: '배송 대기', color: 'text-secondary-text' };
      case 'SHIPPED':
        return { text: '배송 중', color: 'text-info' };
      case 'DELIVERED':
        return { text: '배송 완료', color: 'text-success' };
      default:
        return { text: '대기 중', color: 'text-secondary-text' };
    }
  };

  const getOrderStatusInfo = (status: string) => {
    switch (status) {
      case 'PENDING_PAYMENT':
        return { text: '입금 대기 중', color: 'text-warning', icon: Clock };
      case 'PAYMENT_CONFIRMED':
        return { text: '결제 완료', color: 'text-success', icon: CheckCircle };
      case 'SHIPPED':
        return { text: '배송 중', color: 'text-info', icon: Truck };
      case 'DELIVERED':
        return { text: '배송 완료', color: 'text-success', icon: CheckCircle };
      case 'CANCELLED':
        return { text: '취소됨', color: 'text-error', icon: XCircle };
      default:
        return { text: status, color: 'text-secondary-text', icon: Package };
    }
  };

  if (authLoading || isLoading) {
    return (
      <>
        <div className="min-h-screen bg-primary-black flex items-center justify-center">
          <Body className="text-secondary-text">주문 내역을 불러오는 중...</Body>
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
            <Body className="text-secondary-text mb-6">{error}</Body>
            <Button variant="primary" onClick={() => window.location.reload()}>
              다시 시도
            </Button>
          </div>
        </div>
        <BottomTabBar />
      </>
    );
  }

  if (orders.length === 0) {
    return (
      <>
        <div className="min-h-screen bg-primary-black py-12 px-4 pb-24">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <Display className="text-hot-pink mb-2">주문 내역</Display>
              <Body className="text-secondary-text">주문하신 상품 내역을 확인하세요</Body>
            </div>

            <div className="text-center py-16">
              <Package className="w-24 h-24 text-secondary-text mx-auto mb-6 opacity-30" />
              <Heading2 className="text-primary-text mb-4">주문 내역이 없습니다</Heading2>
              <Body className="text-secondary-text mb-8">라이브 방송에서 상품을 주문해보세요</Body>
              <Button variant="primary" size="lg" onClick={() => router.push('/')}>
                쇼핑하러 가기
              </Button>
            </div>
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
          <div className="mb-6">
            <Display className="text-hot-pink mb-2">주문 내역</Display>
            <Body className="text-secondary-text">{orders.length}개의 주문</Body>
          </div>

          {/* Orders List */}
          <div className="space-y-4">
            {orders.map((order) => {
              const paymentStatus = getPaymentStatusInfo(order.paymentStatus);
              const shippingStatus = getShippingStatusInfo(order.shippingStatus);
              const StatusIcon = paymentStatus.icon;

              return (
                <div
                  key={order.id}
                  className="bg-content-bg rounded-2xl border border-border-color overflow-hidden hover:border-hot-pink/30 transition-colors cursor-pointer"
                  onClick={() => router.push(`/orders/${order.id}`)}
                >
                  {/* Order Header */}
                  <div className="p-4 border-b border-border-color">
                    <div className="flex items-center justify-between mb-2">
                      <Body className="text-secondary-text text-sm">
                        {formatDate(order.createdAt)}
                      </Body>
                      <div
                        className={`${paymentStatus.bgColor} ${paymentStatus.color} px-3 py-1 rounded-full flex items-center gap-1.5`}
                      >
                        <StatusIcon className="w-4 h-4" />
                        <Body className="text-sm font-semibold">{paymentStatus.text}</Body>
                      </div>
                    </div>
                    <Body className="text-secondary-text text-xs font-mono">
                      주문번호: {order.id}
                    </Body>
                  </div>

                  {/* Order Items */}
                  <div className="p-4">
                    {order.items.map((item, index) => (
                      <div
                        key={item.id}
                        className={index > 0 ? 'mt-3 pt-3 border-t border-border-color' : ''}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <Body className="text-primary-text font-semibold mb-1">
                              {item.productName}
                            </Body>
                            <Body className="text-secondary-text text-sm">
                              {formatPrice(item.price)} × {item.quantity}개
                            </Body>
                          </div>
                          <Body className="text-primary-text font-bold">
                            {formatPrice(item.price * item.quantity)}
                          </Body>
                        </div>
                      </div>
                    ))}

                    {/* Total */}
                    <div className="mt-4 pt-4 border-t border-border-color flex justify-between items-center">
                      <div>
                        <Body className="text-secondary-text text-sm mb-1">총 결제 금액</Body>
                        {order.shippingStatus && (
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

                  {/* Actions */}
                  <div className="p-4 border-t border-border-color bg-content-bg/50">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        fullWidth
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/orders/${order.id}`);
                        }}
                      >
                        상세 보기
                      </Button>
                      {order.paymentStatus === 'PENDING' && (
                        <Button
                          variant="primary"
                          size="sm"
                          fullWidth
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/order-complete?orderId=${order.id}`);
                          }}
                        >
                          입금 정보 확인
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <BottomTabBar />
    </>
  );
}
