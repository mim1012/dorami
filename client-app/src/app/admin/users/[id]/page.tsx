'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/common/Button';
import { Display, Body, Heading2, Caption } from '@/components/common/Typography';
import { PointAdjustmentModal } from '@/components/admin/users/PointAdjustmentModal';
import { usePointBalance } from '@/lib/hooks/queries/use-points';
import { useToast } from '@/components/common/Toast';
import { validateUserStatusForm } from '@/lib/schemas/user';

interface ShippingAddress {
  fullName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

interface UserStatistics {
  totalOrders: number;
  totalPurchaseAmount: number;
  averageOrderValue: number;
  orderFrequency: number;
}

interface UserOrderItem {
  id: string;
  createdAt: string;
  total: number;
  itemCount: number;
  status: string;
  paymentStatus: string;
  shippingStatus: string;
}

interface UserOrderListResponse {
  orders: UserOrderItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UserDetail {
  id: string;
  email: string;
  name: string;
  instagramId: string | null;
  depositorName: string | null;
  shippingAddress: ShippingAddress | null;
  createdAt: string;
  lastLoginAt: string | null;
  status: string;
  role: string;
  suspendedAt: string | null;
  statistics: UserStatistics;
}

export default function AdminUserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [userOrders, setUserOrders] = useState<UserOrderItem[]>([]);
  const { data: pointBalance, refetch: refetchPoints } = usePointBalance(userId);

  useEffect(() => {
    fetchUserDetail();
  }, [userId]);

  const fetchUserDetail = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [userResponse, orderResponse] = await Promise.all([
        apiClient.get<UserDetail>(`/admin/users/${userId}`),
        apiClient.get<UserOrderListResponse>('/admin/orders', {
          params: {
            page: 1,
            limit: 5,
            sortBy: 'createdAt',
            sortOrder: 'desc',
            userId: userId,
          },
        }),
      ]);

      setUser(userResponse.data);
      setSelectedStatus(userResponse.data.status);
      setUserOrders(orderResponse.data.orders || []);
    } catch (err: any) {
      console.error('Failed to fetch user detail:', err);
      setError(err.response?.data?.message || '회원 정보를 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    if (newStatus !== user?.status) {
      setSelectedStatus(newStatus);
      setShowConfirmModal(true);
    }
  };

  const confirmStatusUpdate = async () => {
    const errors = validateUserStatusForm({
      status: selectedStatus as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
    });
    if (Object.keys(errors).length > 0) {
      showToast(errors.status || '유효하지 않은 상태입니다', 'error');
      return;
    }
    setIsUpdating(true);
    try {
      await apiClient.patch(`/admin/users/${userId}/status`, {
        status: selectedStatus,
      });

      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowConfirmModal(false);
      await fetchUserDetail();

      showToast('회원 상태가 변경되었습니다.', 'success');
    } catch (err: any) {
      console.error('Failed to update user status:', err);
      setError(err.response?.data?.message || '상태 변경에 실패했습니다');
      setSelectedStatus(user?.status || '');
    } finally {
      setIsUpdating(false);
    }
  };

  const cancelStatusUpdate = () => {
    setSelectedStatus(user?.status || '');
    setShowConfirmModal(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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

  const getOrderStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING_PAYMENT: '입금 대기',
      PAYMENT_CONFIRMED: '결제 완료',
      SHIPPED: '배송중',
      DELIVERED: '배송 완료',
      CANCELLED: '취소',
    };
    return labels[status] || status;
  };

  const getPaymentStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: '입금 대기',
      CONFIRMED: '입금 완료',
      FAILED: '입금 실패',
      REFUNDED: '환불',
    };
    return labels[status] || status;
  };

  const getShippingStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: '준비중',
      SHIPPED: '배송중',
      DELIVERED: '배송 완료',
    };
    return labels[status] || status;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      ACTIVE: '활성',
      INACTIVE: '비활성',
      SUSPENDED: '차단 (블랙리스트)',
    };
    return labels[status] || status;
  };

  const getStatusBadgeColor = (status: string) => {
    const colors = {
      ACTIVE: 'bg-success/10 text-success border-success',
      INACTIVE: 'bg-secondary-text/10 text-secondary-text border-secondary-text',
      SUSPENDED: 'bg-error/10 text-error border-error',
    };
    return colors[status as keyof typeof colors] || colors.INACTIVE;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Body>회원 정보를 불러오는 중...</Body>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-4">
        <div className="bg-error/10 border border-error rounded-button p-4">
          <Body className="text-error">{error || '회원을 찾을 수 없습니다'}</Body>
        </div>
        <Button onClick={() => router.push('/admin/users')}>회원 목록으로</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6 md:mb-8 flex items-center justify-between">
        <div>
          <Display className="text-hot-pink mb-2">회원 상세</Display>
          <Body className="text-secondary-text">{user.instagramId || user.email}</Body>
        </div>
        <Button variant="outline" onClick={() => router.push('/admin/users')}>
          ← 회원 목록
        </Button>
      </div>

      {error && (
        <div className="bg-error/10 border border-error rounded-button p-4 mb-6">
          <Body className="text-error">{error}</Body>
        </div>
      )}

      {/* Blacklist Warning Banner */}
      {user.status === 'SUSPENDED' && (
        <div className="bg-error/10 border-2 border-error rounded-button p-4 mb-6 flex items-center gap-3">
          <span className="text-2xl">🚫</span>
          <div>
            <Body className="text-error font-bold">차단된 회원 (블랙리스트)</Body>
            <Caption className="text-error">
              방송 참여, 장바구니, 알림 등 모든 기능 사용 불가 | 차단일:{' '}
              {formatDate(user.suspendedAt)}
            </Caption>
          </div>
        </div>
      )}

      {/* Profile and Address Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* User Profile Card */}
        <div className="bg-content-bg rounded-button p-6">
          <Heading2 className="text-hot-pink mb-4">회원 정보</Heading2>

          <div className="space-y-4">
            <div>
              <Body className="text-secondary-text text-caption">인스타그램</Body>
              <Body className="text-hot-pink font-medium">{user.instagramId || '-'}</Body>
            </div>

            <div>
              <Body className="text-secondary-text text-caption">이메일</Body>
              <Body>{user.email}</Body>
            </div>

            <div>
              <Body className="text-secondary-text text-caption">이름</Body>
              <Body>{user.name}</Body>
            </div>

            <div>
              <Body className="text-secondary-text text-caption">입금자명</Body>
              <Body>{user.depositorName || '-'}</Body>
            </div>

            <div>
              <Body className="text-secondary-text text-caption">가입일</Body>
              <Body>{formatDate(user.createdAt)}</Body>
            </div>

            <div>
              <Body className="text-secondary-text text-caption">최근 접속</Body>
              <Body>{formatDate(user.lastLoginAt)}</Body>
            </div>

            <div>
              <Body className="text-secondary-text text-caption">상태</Body>
              <select
                value={selectedStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className={`mt-1 block w-full px-4 py-2 border rounded-button focus:outline-none focus:ring-2 focus:ring-hot-pink ${
                  selectedStatus === 'SUSPENDED'
                    ? 'border-error bg-error/5 text-error font-bold'
                    : 'border-gray-300'
                }`}
              >
                <option value="ACTIVE">활성</option>
                <option value="INACTIVE">비활성</option>
                <option value="SUSPENDED">차단 (블랙리스트)</option>
              </select>
            </div>

            {user.suspendedAt && (
              <div>
                <Body className="text-secondary-text text-caption">차단일</Body>
                <Body className="text-error">{formatDate(user.suspendedAt)}</Body>
              </div>
            )}
          </div>
        </div>

        {/* Shipping Address Card */}
        <div className="bg-content-bg rounded-button p-6">
          <Heading2 className="text-hot-pink mb-4">배송지</Heading2>

          {user.shippingAddress ? (
            <div className="space-y-2">
              <Body className="font-medium">{user.shippingAddress.fullName}</Body>
              <Body>{user.shippingAddress.address1}</Body>
              {user.shippingAddress.address2 && <Body>{user.shippingAddress.address2}</Body>}
              <Body>
                {user.shippingAddress.city} {user.shippingAddress.state} {user.shippingAddress.zip}
              </Body>
              <Body>연락처: {user.shippingAddress.phone}</Body>
            </div>
          ) : (
            <Body className="text-secondary-text">배송지 미등록</Body>
          )}
        </div>
      </div>

      {/* User Statistics */}
      <div className="bg-content-bg rounded-button p-6 mb-6">
        <Heading2 className="text-hot-pink mb-4">주문 통계</Heading2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <Display className="text-hot-pink">{user.statistics.totalOrders}</Display>
            <Body className="text-secondary-text text-caption">총 주문</Body>
          </div>

          <div className="text-center">
            <Display className="text-hot-pink">
              {formatCurrency(user.statistics.totalPurchaseAmount)}
            </Display>
            <Body className="text-secondary-text text-caption">총 구매액</Body>
          </div>

          <div className="text-center">
            <Display className="text-hot-pink">
              {formatCurrency(user.statistics.averageOrderValue)}
            </Display>
            <Body className="text-secondary-text text-caption">평균 주문액</Body>
          </div>

          <div className="text-center">
            <Display className="text-hot-pink">{user.statistics.orderFrequency.toFixed(1)}</Display>
            <Body className="text-secondary-text text-caption">월 주문 수</Body>
          </div>
        </div>
      </div>

      {/* Points Section */}
      <div className="bg-content-bg rounded-button p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <Heading2 className="text-hot-pink">적립 포인트</Heading2>
          <Button variant="outline" size="sm" onClick={() => setShowPointsModal(true)}>
            포인트 조정
          </Button>
        </div>

        {pointBalance ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <Display className="text-hot-pink">
                {new Intl.NumberFormat('ko-KR').format(pointBalance.currentBalance)}
              </Display>
              <Caption className="text-secondary-text">현재 잔액</Caption>
            </div>
            <div className="text-center">
              <Display className="text-success">
                {new Intl.NumberFormat('ko-KR').format(pointBalance.lifetimeEarned)}
              </Display>
              <Caption className="text-secondary-text">총 적립</Caption>
            </div>
            <div className="text-center">
              <Display className="text-info">
                {new Intl.NumberFormat('ko-KR').format(pointBalance.lifetimeUsed)}
              </Display>
              <Caption className="text-secondary-text">총 사용</Caption>
            </div>
            <div className="text-center">
              <Display className="text-gray-500">
                {new Intl.NumberFormat('ko-KR').format(pointBalance.lifetimeExpired)}
              </Display>
              <Caption className="text-secondary-text">만료</Caption>
            </div>
          </div>
        ) : (
          <Body className="text-secondary-text">포인트 데이터 없음</Body>
        )}
      </div>

      {/* Order History */}
      <div className="bg-content-bg rounded-button p-6">
        <Heading2 className="text-hot-pink mb-4">주문 내역</Heading2>
        {userOrders.length > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-6 gap-2 text-secondary-text text-sm pb-2 border-b border-gray-200">
              <span className="font-medium">주문번호</span>
              <span className="font-medium">주문일시</span>
              <span className="font-medium">상태</span>
              <span className="font-medium">결제상태</span>
              <span className="font-medium">배송상태</span>
              <span className="font-medium">금액</span>
            </div>

            {userOrders.map((order) => (
              <button
                key={order.id}
                type="button"
                className="w-full grid grid-cols-6 gap-2 text-sm py-3 border-b border-gray-100 hover:bg-gray-50 rounded-button px-2 text-left"
                onClick={() => router.push(`/admin/orders/${order.id}`)}
              >
                <span className="font-mono text-xs md:text-sm">{order.id}</span>
                <span>{formatDate(order.createdAt)}</span>
                <span>{getOrderStatusLabel(order.status)}</span>
                <span>{getPaymentStatusLabel(order.paymentStatus)}</span>
                <span>{getShippingStatusLabel(order.shippingStatus)}</span>
                <span className="font-medium">{formatCurrency(order.total)}</span>
              </button>
            ))}

            {user?.statistics.totalOrders > 5 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto mt-2"
                onClick={() => router.push(`/admin/orders?userId=${user?.id}`)}
              >
                주문관리에서 전체 내역 보기
              </Button>
            )}
          </div>
        ) : (
          <Body className="text-secondary-text">주문 내역이 없습니다.</Body>
        )}
      </div>

      {/* Point Adjustment Modal */}
      <PointAdjustmentModal
        isOpen={showPointsModal}
        onClose={() => setShowPointsModal(false)}
        userId={userId}
        currentBalance={pointBalance?.currentBalance || 0}
        onSuccess={() => {
          refetchPoints();
          fetchUserDetail();
        }}
      />

      {/* Status Update Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-button p-6 max-w-md w-full mx-4">
            <Heading2 className="text-hot-pink mb-4">상태 변경 확인</Heading2>
            <Body className="mb-6">
              {selectedStatus === 'SUSPENDED'
                ? '이 회원을 차단(블랙리스트)하시겠습니까? 방송 참여, 장바구니, 알림 등 모든 기능을 사용할 수 없게 됩니다.'
                : `이 회원의 상태를 "${getStatusLabel(selectedStatus)}"(으)로 변경하시겠습니까?`}
            </Body>
            {selectedStatus === 'SUSPENDED' && (
              <div className="bg-error/10 border border-error rounded-button p-3 mb-4">
                <Caption className="text-error">
                  차단 시 해당 회원은 로그인, 방송 시청, 채팅, 장바구니, 주문, 알림 수신 등 모든
                  서비스 이용이 제한됩니다.
                </Caption>
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <Button
                variant="primary"
                onClick={confirmStatusUpdate}
                disabled={isUpdating}
                className={`flex-1 ${selectedStatus === 'SUSPENDED' ? 'bg-error hover:bg-error/80 border-error' : ''}`}
              >
                {isUpdating ? '처리중...' : selectedStatus === 'SUSPENDED' ? '차단하기' : '확인'}
              </Button>
              <Button
                variant="outline"
                onClick={cancelStatusUpdate}
                disabled={isUpdating}
                className="flex-1"
              >
                취소
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

