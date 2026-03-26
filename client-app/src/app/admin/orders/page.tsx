'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { apiClient } from '@/lib/api/client';
import { Table, Column } from '@/components/common/Table';
import { Pagination } from '@/components/common/Pagination';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Display, Body } from '@/components/common/Typography';
import { useToast } from '@/components/common/Toast';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { Download } from 'lucide-react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '@/lib/config/socket-url';
import { OrderMobileCard } from './OrderMobileCard';

interface OrderItem {
  productName: string;
  price: string;
  quantity: number;
  color?: string | null;
  size?: string | null;
}

interface OrderListItem {
  id: string;
  userId: string;
  userEmail: string;
  depositorName: string;
  instagramId: string;
  status: 'PENDING_PAYMENT' | 'PAYMENT_CONFIRMED' | 'CANCELLED';
  createdAt: string;
  paidAt: string | null;
  items?: OrderItem[];
}

interface OrderListResponse {
  orders: OrderListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ORDER_STATUS_UPDATE_OPTIONS = [
  { value: 'PENDING_PAYMENT', label: '입금 대기' },
  { value: 'PAYMENT_CONFIRMED', label: '입금 완료' },
  { value: 'CANCELLED', label: '취소' },
] as const;

const ORDER_STATUS_FILTER_OPTIONS = [
  { value: 'PENDING_PAYMENT', label: '입금 대기' },
  { value: 'PAYMENT_CONFIRMED', label: '입금 완료' },
  { value: 'CANCELLED', label: '취소' },
] as const;

const ORDER_STATUS_LABELS = {
  PENDING_PAYMENT: '입금 대기',
  PAYMENT_CONFIRMED: '입금 완료',
  CANCELLED: '취소',
} as const;

function AdminOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const isMobile = useIsMobile();

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [pageSize, setPageSize] = useState(parseInt(searchParams.get('limit') || '20', 10));
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
  );

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string[]>(
    searchParams.get('orderStatus')?.split(',').filter(Boolean) || [],
  );

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'ADMIN') {
        router.push('/');
      }
    }
  }, [user, authLoading, router]);

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
    router,
  ]);

  const fetchOrders = useCallback(async () => {
    if (!user || user.role !== 'ADMIN') return;

    setIsLoading(true);
    setError(null);

    try {
      const params: Record<string, string | number | boolean | string[]> = {
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
      setError(err.response?.data?.message || '주문 목록을 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
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
  ]);

  useEffect(() => {
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
  ]);

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') return;

    const socket = io(SOCKET_URL, { withCredentials: true });
    const handleRefreshOrders = () => {
      void fetchOrders();
    };

    socket.on('order:new', handleRefreshOrders);
    socket.on('order:paid', handleRefreshOrders);
    socket.on('order:cancelled', handleRefreshOrders);

    return () => {
      socket.off('order:new', handleRefreshOrders);
      socket.off('order:paid', handleRefreshOrders);
      socket.off('order:cancelled', handleRefreshOrders);
      socket.disconnect();
    };
  }, [user, fetchOrders]);

  const handleSort = (key: string) => {
    if (key === sortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handlePageChange = (newPage: number) => setPage(newPage);

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setOrderStatusFilter([]);
    setPage(1);
  };

  const handleStatusToggle = (status: string) => {
    setOrderStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
    setPage(1);
  };

  const handleStatusChange = async (order: OrderListItem, newStatus: OrderListItem['status']) => {
    if (order.status === newStatus) return;
    const label = ORDER_STATUS_LABELS[newStatus] || newStatus;

    const confirmed = await confirm({
      title: '주문 상태 변경',
      message: `주문번호 ${order.id}의 상태를 "${label}"(으)로 변경할까요?`,
      confirmText: '변경',
      variant: newStatus === 'CANCELLED' ? 'danger' : 'info',
    });
    if (!confirmed) return;

    setIsUpdating(order.id);
    try {
      await apiClient.patch(`/admin/orders/${order.id}/status`, { status: newStatus });
      showToast(`주문 ${order.id} 상태가 "${label}"로 변경되었습니다`, 'success');
      await fetchOrders();
    } catch (err: any) {
      showToast(err.response?.data?.message || '상태 변경에 실패했습니다', 'error');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    const label = ORDER_STATUS_LABELS[newStatus as keyof typeof ORDER_STATUS_LABELS] || newStatus;
    const confirmed = await confirm({
      title: '일괄 상태 변경',
      message: `${selectedOrderIds.size}개 주문의 상태를 "${label}"(으)로 변경할까요?`,
      confirmText: '변경',
      variant: newStatus === 'CANCELLED' ? 'danger' : 'info',
    });
    if (!confirmed) return;

    try {
      await apiClient.patch('/admin/orders/bulk-status', {
        orderIds: Array.from(selectedOrderIds),
        status: newStatus,
      });
      showToast(`${selectedOrderIds.size}개 주문 상태가 변경되었습니다`, 'success');
      setSelectedOrderIds(new Set());
      setIsSelectionMode(false);
      await fetchOrders();
    } catch (err: any) {
      showToast(err.message || '일괄 변경에 실패했습니다', 'error');
    }
  };

  const handleDeleteOrder = async (order: OrderListItem) => {
    if (order.status !== 'CANCELLED') {
      showToast('취소된 주문만 삭제할 수 있습니다', 'error');
      return;
    }
    const confirmed = await confirm({
      title: '주문 삭제',
      message: `주문번호 ${order.id}을(를) 삭제하시겠습니까? 삭제된 주문은 목록에서 숨겨집니다.`,
      confirmText: '삭제',
      variant: 'danger',
    });
    if (!confirmed) return;

    setIsUpdating(order.id);
    try {
      await apiClient.delete(`/admin/orders/${order.id}`);
      showToast(`주문 ${order.id}이(가) 삭제되었습니다`, 'success');
      await fetchOrders();
    } catch (err: any) {
      showToast(err.response?.data?.message || '삭제에 실패했습니다', 'error');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleBulkDelete = async () => {
    const selectedOrders = orders.filter((o) => selectedOrderIds.has(o.id));
    const nonCancelled = selectedOrders.filter((o) => o.status !== 'CANCELLED');
    if (nonCancelled.length > 0) {
      showToast('취소된 주문만 삭제할 수 있습니다', 'error');
      return;
    }

    const confirmed = await confirm({
      title: '일괄 삭제',
      message: `${selectedOrderIds.size}개 주문을 삭제하시겠습니까? 삭제된 주문은 목록에서 숨겨집니다.`,
      confirmText: '삭제',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      const result = await apiClient.post('/admin/orders/bulk-delete', {
        orderIds: Array.from(selectedOrderIds),
      });
      const data = result as any;
      showToast(
        `${data.success}개 삭제 완료${data.failed > 0 ? `, ${data.failed}개 실패` : ''}`,
        data.failed > 0 ? 'error' : 'success',
      );
      setSelectedOrderIds(new Set());
      setIsSelectionMode(false);
      await fetchOrders();
    } catch (err: any) {
      showToast(err.message || '일괄 삭제에 실패했습니다', 'error');
    }
  };

  const handleToggleSelectionMode = () => {
    setIsSelectionMode((prev) => !prev);
    setSelectedOrderIds(new Set());
  };

  const handleToggleSelectAll = () => {
    if (selectedOrderIds.size === orders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(orders.map((o) => o.id)));
    }
  };

  const handleToggleSelect = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const handleExportCsv = async () => {
    if (isExporting) return;
    setIsExporting(true);
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
      const csrfToken = document.cookie.match(/csrf-token=([^;]+)/)?.[1] || '';
      const response = await fetch(`/api/admin/orders/export?${queryStr}`, {
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
      a.download = `order_export_${date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('엑셀 파일이 다운로드되었습니다.', 'success');
    } catch (err: any) {
      showToast('엑셀 내보내기에 실패했습니다.', 'error');
    } finally {
      setIsExporting(false);
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

  const collectProductSummary = (items?: OrderItem[]) => {
    if (!items || items.length === 0) return '-';
    return items
      .map((item) => `${item.productName} x${item.quantity}`)
      .filter(Boolean)
      .join(', ');
  };

  const collectUnique = (items: OrderListItem['items'], key: 'color' | 'size') => {
    if (!items || items.length === 0) return '-';
    const values = items
      .map((item) => item[key])
      .filter((value): value is string => Boolean(value && value.trim().length > 0));
    const unique = Array.from(new Set(values));
    return unique.length > 0 ? unique.join(', ') : '-';
  };

  const columns: Column<OrderListItem>[] = [
    {
      key: 'select',
      label: '',
      sortable: false,
      render: (order) =>
        isSelectionMode ? (
          <div onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selectedOrderIds.has(order.id)}
              onChange={() => handleToggleSelect(order.id)}
              className="w-4 h-4 accent-hot-pink"
            />
          </div>
        ) : null,
    },
    {
      key: 'instagramId',
      label: '고객',
      sortable: false,
      render: (order) => (
        <div>
          <span className="font-medium">
            {order.instagramId
              ? order.instagramId.startsWith('@')
                ? order.instagramId
                : `@${order.instagramId}`
              : order.depositorName || '-'}
          </span>
          {order.instagramId && order.depositorName && (
            <div className="text-xs text-secondary-text">{order.depositorName}</div>
          )}
        </div>
      ),
    },
    {
      key: 'productName',
      label: '상품 (색상/사이즈)',
      sortable: false,
      render: (order) => {
        const items = order.items ?? [];
        const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
        const totalAmountCents = items.reduce(
          (sum, i) => sum + Math.round(Number(i.price) * 100) * i.quantity,
          0,
        );
        const totalAmount = totalAmountCents / 100;
        return (
          <div className="space-y-1">
            {items.map((item, idx) => {
              const option = [item.color, item.size].filter(Boolean).join('/');
              return (
                <div key={idx} className="flex items-center gap-2 text-caption">
                  <span className="text-primary-text">{item.productName}</span>
                  {option && (
                    <span className="text-secondary-text text-xs bg-border-color/30 px-1.5 py-0.5 rounded">
                      {option}
                    </span>
                  )}
                  <span className="text-secondary-text">x{item.quantity}</span>
                </div>
              );
            })}
            {items.length > 0 && (
              <div className="pt-1 border-t border-border-color/30 flex items-center gap-2 text-xs">
                <span className="text-secondary-text">{totalQty}개</span>
                <span className="text-hot-pink font-semibold">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                    totalAmount,
                  )}
                </span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      label: '주문일시',
      sortable: true,
      render: (order) => formatDate(order.createdAt),
    },
    {
      key: 'paidAt',
      label: '결제일시',
      sortable: true,
      render: (order) => formatDate(order.paidAt),
    },
    {
      key: 'status',
      label: '상태',
      sortable: true,
      render: (order) => (
        <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
          {ORDER_STATUS_UPDATE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleStatusChange(order, option.value)}
              disabled={isUpdating === order.id}
              className={`inline-flex min-h-[44px] items-center justify-center px-2.5 py-2 text-xs rounded border ${
                order.status === option.value
                  ? 'bg-hot-pink text-white border-hot-pink'
                  : 'bg-transparent text-secondary-text hover:bg-content-bg'
              }`}
            >
              {option.label}
            </button>
          ))}
          {order.status === 'CANCELLED' && (
            <button
              type="button"
              onClick={() => handleDeleteOrder(order)}
              disabled={isUpdating === order.id}
              className="inline-flex min-h-[44px] items-center justify-center px-2.5 py-2 text-xs rounded border bg-transparent text-gray-400 hover:text-error hover:bg-error/10"
            >
              삭제
            </button>
          )}
        </div>
      ),
    },
  ];

  const hasActiveFilters = debouncedSearch || dateFrom || dateTo || orderStatusFilter.length > 0;
  const allSelected = orders.length > 0 && selectedOrderIds.size === orders.length;

  if (authLoading || (user && user.role !== 'ADMIN')) {
    return (
      <div className="flex items-center justify-center py-24">
        <Body>Loading...</Body>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Display className="text-hot-pink mb-2">주문 관리</Display>
          <Body className="text-secondary-text">모든 고객 주문을 조회하고 관리합니다</Body>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={isSelectionMode ? 'primary' : 'outline'}
            onClick={handleToggleSelectionMode}
            className="flex-1 sm:flex-none"
          >
            {isSelectionMode ? '선택 취소' : '선택 모드'}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2"
          >
            {isExporting ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
                />
              </svg>
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isExporting ? '내보내는 중...' : '엑셀 내보내기'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-error/10 border border-error rounded-button p-4 mb-6">
          <Body className="text-error">{error}</Body>
        </div>
      )}

      {/* Filter section */}
      <div className="bg-content-bg rounded-button p-4 sm:p-6 mb-6 space-y-4">
        <div className="flex flex-col gap-2">
          <Input
            placeholder="주문번호, 이메일, 입금자명, 인스타그램 ID로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
          />
          <div className="flex gap-2">
            <Button
              variant={isFilterOpen ? 'primary' : 'outline'}
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="flex-1 sm:flex-none whitespace-nowrap"
            >
              {isFilterOpen ? '필터 숨기기' : '필터 보기'}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" onClick={handleClearFilters} className="flex-1 sm:flex-none">
                전체 초기화
              </Button>
            )}
          </div>
        </div>

        {isFilterOpen && (
          <div className="pt-4 border-t border-gray-200 space-y-4">
            <div>
              <Body className="text-primary-text font-medium mb-2">주문 상태</Body>
              <div className="flex gap-2 flex-wrap">
                {ORDER_STATUS_FILTER_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => handleStatusToggle(value)}
                    className={`inline-flex min-h-[44px] items-center justify-center px-4 py-2.5 rounded-button text-caption transition-colors ${
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

            <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2">
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
          </div>
        )}
      </div>

      {/* Selection mode: select-all bar */}
      {isSelectionMode && (
        <div className="flex items-center gap-3 px-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={handleToggleSelectAll}
            className="w-4 h-4 accent-hot-pink"
          />
          <Body className="text-secondary-text text-sm">
            {allSelected ? '전체 해제' : `전체 선택 (${orders.length}개)`}
          </Body>
          {selectedOrderIds.size > 0 && (
            <Body className="text-hot-pink text-sm font-medium">
              {selectedOrderIds.size}개 선택됨
            </Body>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Body className="text-secondary-text">주문 목록 불러오는 중...</Body>
        </div>
      ) : isMobile ? (
        /* Mobile card list */
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Body className="text-secondary-text">필터 조건에 맞는 주문이 없습니다</Body>
            </div>
          ) : (
            orders.map((order) => (
              <OrderMobileCard
                key={order.id}
                order={order}
                isUpdating={isUpdating === order.id}
                isSelectionMode={isSelectionMode}
                isSelected={selectedOrderIds.has(order.id)}
                isExpanded={expandedOrderId === order.id}
                onCardClick={() => router.push(`/admin/orders/${order.id}`)}
                onToggleExpand={() =>
                  setExpandedOrderId(expandedOrderId === order.id ? null : order.id)
                }
                onStatusChange={handleStatusChange}
                onDelete={handleDeleteOrder}
                onSelectionToggle={() => handleToggleSelect(order.id)}
                formatDate={formatDate}
                collectProductSummary={collectProductSummary}
              />
            ))
          )}
        </div>
      ) : (
        /* Desktop table */
        <Table
          columns={columns}
          data={orders}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          onRowClick={(order) => router.push(`/admin/orders/${order.id}`)}
          emptyMessage="필터 조건에 맞는 주문이 없습니다"
          getRowClassName={(order) =>
            order.status === 'PENDING_PAYMENT' ? 'border-l-4 border-warning bg-warning/5' : ''
          }
        />
      )}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={total}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {/* Bulk action sticky bar */}
      {isSelectionMode && selectedOrderIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-content-bg border-t border-border-color p-4 flex items-center justify-between z-50 gap-4">
          <span className="text-primary-text font-medium whitespace-nowrap">
            {selectedOrderIds.size}개 선택
          </span>
          <div className="flex gap-2 flex-wrap justify-end">
            {ORDER_STATUS_UPDATE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleBulkStatusChange(option.value)}
                className={`px-4 py-2 min-h-[44px] rounded-lg text-white text-sm font-medium ${
                  option.value === 'CANCELLED' ? 'bg-error' : 'bg-hot-pink'
                }`}
              >
                {option.label}
              </button>
            ))}
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 min-h-[44px] rounded-lg text-white text-sm font-medium bg-gray-600 hover:bg-gray-700"
            >
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Body>불러오는 중...</Body>
        </div>
      }
    >
      <AdminOrdersContent />
    </Suspense>
  );
}
