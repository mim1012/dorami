'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { apiClient } from '@/lib/api/client';
import { Table, Column } from '@/components/common/Table';
import { Pagination } from '@/components/common/Pagination';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Display, Body, Heading2 } from '@/components/common/Typography';
import { useToast } from '@/components/common/Toast';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { Download } from 'lucide-react';

interface OrderListItem {
  id: string;
  userId: string;
  userEmail: string;
  depositorName: string;
  instagramId: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  itemCount: number;
  createdAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  streamKey: string | null;
}

interface OrderListResponse {
  orders: OrderListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function AdminOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Query params
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [pageSize, setPageSize] = useState(parseInt(searchParams.get('limit') || '20', 10));
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
  );

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string[]>(
    searchParams.get('orderStatus')?.split(',').filter(Boolean) || [],
  );
  const [streamKeyFilter, setStreamKeyFilter] = useState(searchParams.get('streamKey') || '');
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'ADMIN') {
        router.push('/');
      }
    }
  }, [user, authLoading, router]);

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', pageSize.toString());
    params.set('sortBy', sortBy);
    params.set('sortOrder', sortOrder);

    if (debouncedSearch) params.set('search', debouncedSearch);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (orderStatusFilter.length > 0) params.set('orderStatus', orderStatusFilter.join(','));
    if (streamKeyFilter) params.set('streamKey', streamKeyFilter);

    router.push(`/admin/orders?${params.toString()}`, { scroll: false });
  }, [
    page,
    pageSize,
    sortBy,
    sortOrder,
    debouncedSearch,
    dateFrom,
    dateTo,
    orderStatusFilter,
    streamKeyFilter,
    router,
  ]);

  // Fetch orders
  useEffect(() => {
    const fetchOrders = async () => {
      if (!user || user.role !== 'ADMIN') return;

      setIsLoading(true);
      setError(null);

      try {
        const params: any = {
          page,
          limit: pageSize,
          sortBy,
          sortOrder,
        };

        if (debouncedSearch) params.search = debouncedSearch;
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
        if (orderStatusFilter.length > 0) params.orderStatus = orderStatusFilter;
        if (streamKeyFilter) params.streamKey = streamKeyFilter;

        const response = await apiClient.get<OrderListResponse>('/admin/orders', { params });

        setOrders(response.data.orders);
        setTotal(response.data.total);
        setTotalPages(response.data.totalPages);
      } catch (err: any) {
        console.error('Failed to fetch orders:', err);
        setError(err.response?.data?.message || '주문 목록을 불러오는데 실패했습니다');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [
    user,
    page,
    pageSize,
    sortBy,
    sortOrder,
    debouncedSearch,
    dateFrom,
    dateTo,
    orderStatusFilter,
    streamKeyFilter,
  ]);

  const handleSort = (key: string) => {
    if (key === sortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setOrderStatusFilter([]);
    setStreamKeyFilter('');
    setPage(1);
  };

  const handleStatusToggle = (status: string) => {
    setOrderStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
    setPage(1);
  };

  const handleConfirmPayment = async (order: OrderListItem) => {
    const confirmed = await confirm({
      title: '입금 확인',
      message: `주문번호: ${order.id}\n고객: @${order.instagramId?.replace(/^@/, '')}\n입금자명: ${order.depositorName}\n금액: ${formatCurrency(order.total)}\n\n은행 계좌로 위 금액의 입금을 확인하셨습니까?`,
      confirmText: '확인',
      variant: 'info',
    });

    if (!confirmed) return;

    setConfirmingOrderId(order.id);
    try {
      await apiClient.patch(`/admin/orders/${order.id}/confirm-payment`);
      showToast(`주문 ${order.id} 입금이 확인되었습니다`, 'success');

      // Refetch orders to update the list
      const params: any = {
        page,
        limit: pageSize,
        sortBy,
        sortOrder,
      };

      if (debouncedSearch) params.search = debouncedSearch;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (orderStatusFilter.length > 0) params.orderStatus = orderStatusFilter;

      const response = await apiClient.get<OrderListResponse>('/admin/orders', { params });
      setOrders(response.data.orders);
      setTotal(response.data.total);
      setTotalPages(response.data.totalPages);
    } catch (err: any) {
      console.error('Failed to confirm payment:', err);
      const errorMessage = err.message || '입금 확인 중 오류가 발생했습니다. 다시 시도해주세요';
      showToast(errorMessage, 'error');
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const handleSendReminder = async (order: OrderListItem) => {
    const confirmed = await confirm({
      title: '알림 전송',
      message: `주문번호: ${order.id}\n고객: @${order.instagramId?.replace(/^@/, '')}\n입금자명: ${order.depositorName}\n금액: ${formatCurrency(order.total)}\n\n고객에게 KakaoTalk 결제 알림을 전송하시겠습니까?`,
      confirmText: '전송',
      variant: 'warning',
    });

    if (!confirmed) return;

    setSendingReminderId(order.id);
    try {
      await apiClient.patch(`/admin/orders/${order.id}/send-reminder`);
      showToast(`주문 ${order.id} 결제 알림이 전송되었습니다`, 'success');
    } catch (err: any) {
      console.error('Failed to send reminder:', err);
      const errorMessage = err.message || '알림 전송 중 오류가 발생했습니다. 다시 시도해주세요';
      showToast(errorMessage, 'error');
    } finally {
      setSendingReminderId(null);
    }
  };

  const handleExportCsv = async () => {
    try {
      const params: Record<string, string> = {
        sortBy,
        sortOrder,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (orderStatusFilter.length > 0) params.orderStatus = orderStatusFilter.join(',');

      const queryStr = new URLSearchParams(params).toString();

      const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api';
      const csrfToken = document.cookie.match(/csrf-token=([^;]+)/)?.[1] || '';
      const response = await fetch(`${apiBase}/admin/orders/export?${queryStr}`, {
        credentials: 'include',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `orders_${date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('엑셀 파일이 다운로드되었습니다.', 'success');
    } catch (err: any) {
      console.error('Failed to export orders:', err);
      showToast('엑셀 내보내기에 실패했습니다.', 'error');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
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
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-warning/10 text-warning border-warning',
      PENDING_PAYMENT: 'bg-warning/10 text-warning border-warning',
      CONFIRMED: 'bg-success/10 text-success border-success',
      PAYMENT_CONFIRMED: 'bg-success/10 text-success border-success',
      SHIPPED: 'bg-info/10 text-info border-info',
      DELIVERED: 'bg-success/10 text-success border-success',
      CANCELLED: 'bg-error/10 text-error border-error',
    };

    const labels: Record<string, string> = {
      PENDING: '입금 대기',
      PENDING_PAYMENT: '입금 대기',
      CONFIRMED: '결제 완료',
      PAYMENT_CONFIRMED: '결제 완료',
      SHIPPED: '배송중',
      DELIVERED: '배송 완료',
      CANCELLED: '취소됨',
    };

    const color =
      colors[status] || 'bg-secondary-text/10 text-secondary-text border-secondary-text';
    const label = labels[status] || status;

    return <span className={`px-2 py-1 rounded text-caption border ${color}`}>{label}</span>;
  };

  const columns: Column<OrderListItem>[] = [
    {
      key: 'id',
      label: '주문번호',
      sortable: true,
      render: (order) => <span className="font-mono text-caption">{order.id}</span>,
    },
    {
      key: 'streamKey',
      label: '방송(스트림키)',
      sortable: false,
      render: (order) =>
        order.streamKey ? (
          <span className="font-mono text-caption text-hot-pink">{order.streamKey}</span>
        ) : (
          <span className="text-secondary-text text-caption">-</span>
        ),
    },
    {
      key: 'userEmail',
      label: '고객',
      sortable: false,
      render: (order) => (
        <div className="flex flex-col">
          <span className="text-caption">{order.userEmail}</span>
          <span className="text-caption text-secondary-text">
            @{order.instagramId?.replace(/^@/, '')}
          </span>
        </div>
      ),
    },
    {
      key: 'depositorName',
      label: '입금자명',
      sortable: false,
    },
    {
      key: 'status',
      label: '주문 상태',
      render: (order) => getStatusBadge(order.status),
    },
    {
      key: 'total',
      label: '합계',
      sortable: true,
      render: (order) => (
        <div className="flex flex-col">
          <span className="font-medium">{formatCurrency(order.total)}</span>
          <span className="text-caption text-secondary-text">{order.itemCount}개</span>
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: '주문일',
      sortable: true,
      render: (order) => formatDate(order.createdAt),
    },
    {
      key: 'actions',
      label: '작업',
      render: (order) => (
        <div className="flex gap-2 items-center justify-end">
          {order.paymentStatus === 'PENDING' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSendReminder(order)}
                disabled={sendingReminderId === order.id}
                className="text-info border-info hover:bg-info/10"
              >
                {sendingReminderId === order.id ? '전송중...' : '알림전송'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleConfirmPayment(order)}
                disabled={confirmingOrderId === order.id}
                className="bg-success hover:bg-success/80 text-white border-success"
              >
                {confirmingOrderId === order.id ? '처리중...' : '입금확인'}
              </Button>
            </>
          )}
          {order.paymentStatus === 'CONFIRMED' && (
            <span className="text-success font-medium text-caption">✓ 확인완료</span>
          )}
        </div>
      ),
    },
  ];

  const hasActiveFilters = debouncedSearch || dateFrom || dateTo || orderStatusFilter.length > 0;

  if (authLoading || (user && user.role !== 'ADMIN')) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Body>Loading...</Body>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Display className="text-hot-pink mb-2">주문 관리</Display>
          <Body className="text-secondary-text">모든 고객 주문을 조회하고 관리합니다</Body>
        </div>
        <Button variant="outline" onClick={handleExportCsv} className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          엑셀 내보내기
        </Button>
      </div>

      {error && (
        <div className="bg-error/10 border border-error rounded-button p-4 mb-6">
          <Body className="text-error">{error}</Body>
        </div>
      )}

      {/* Search and Filter Section */}
      <div className="bg-content-bg rounded-button p-6 mb-6 space-y-4">
        {/* Search Input */}
        <div className="flex gap-4">
          <Input
            placeholder="주문번호, 이메일, 입금자명, 인스타그램 ID로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
          />
          <Button
            variant={isFilterOpen ? 'primary' : 'outline'}
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="whitespace-nowrap"
          >
            {isFilterOpen ? '필터 숨기기' : '필터 보기'}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" onClick={handleClearFilters}>
              전체 초기화
            </Button>
          )}
        </div>

        {/* Filter Panel */}
        {isFilterOpen && (
          <div className="pt-4 border-t border-gray-200 space-y-4">
            <Heading2 className="text-hot-pink text-body">필터</Heading2>

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="주문일 시작"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                fullWidth
              />
              <Input
                label="주문일 종료"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                fullWidth
              />
            </div>

            {/* Order Status Filter */}
            <div>
              <Body className="text-primary-text font-medium mb-2">주문 상태</Body>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: 'PENDING_PAYMENT', label: '입금 대기' },
                  { value: 'PAYMENT_CONFIRMED', label: '결제 완료' },
                  { value: 'CANCELLED', label: '취소됨' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => handleStatusToggle(value)}
                    className={`px-4 py-2 rounded-button text-caption transition-colors ${
                      orderStatusFilter.includes(value)
                        ? 'bg-hot-pink text-white'
                        : 'bg-white text-secondary-text hover:bg-gray-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* StreamKey Filter */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="스트림키"
                placeholder="특정 방송 스트림키 입력..."
                value={streamKeyFilter}
                onChange={(e) => {
                  setStreamKeyFilter(e.target.value);
                  setPage(1);
                }}
                fullWidth
              />
            </div>

            {/* 배송사 미연동 — 배송/결제 필터 불필요 */}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Body className="text-secondary-text">주문 목록 불러오는 중...</Body>
        </div>
      ) : (
        <>
          <Table
            columns={columns}
            data={orders}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onRowClick={(order) => router.push(`/admin/orders/${order.id}`)}
            emptyMessage="필터 조건에 맞는 주문이 없습니다"
            getRowClassName={(order) =>
              order.paymentStatus === 'PENDING' ? 'border-l-4 border-warning bg-warning/5' : ''
            }
          />

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={total}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Body>불러오는 중...</Body>
        </div>
      }
    >
      <AdminOrdersContent />
    </Suspense>
  );
}
