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
import { Display, Body } from '@/components/common/Typography';
import { useToast } from '@/components/common/Toast';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { Download } from 'lucide-react';

interface OrderItem {
  productName: string;
  color?: string | null;
  size?: string | null;
}

interface OrderListItem {
  id: string;
  userId: string;
  userEmail: string;
  depositorName: string;
  instagramId: string;
  status: 'PENDING_PAYMENT' | 'PAYMENT_CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
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
  { value: 'SHIPPED', label: '배송중' },
  { value: 'DELIVERED', label: '배송 완료' },
  { value: 'CANCELLED', label: '취소' },
] as const;

const ORDER_STATUS_LABELS = {
  PENDING_PAYMENT: '입금 대기',
  PAYMENT_CONFIRMED: '입금 완료',
  SHIPPED: '배송중',
  DELIVERED: '배송 완료',
  CANCELLED: '취소',
} as const;

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
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

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
  }, [page, pageSize, sortBy, sortOrder, debouncedSearch, dateFrom, dateTo, orderStatusFilter, router]);

  const fetchOrders = async () => {
    if (!user || user.role !== 'ADMIN') return;

    setIsLoading(true);
    setError(null);

    try {
      const params: Record<string, unknown> = {
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
      console.error('Failed to fetch orders:', err);
      setError(err.response?.data?.message || '주문 목록을 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

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

  const collectProductNames = (items?: OrderItem[]) => {
    if (!items || items.length === 0) return '-';
    return items.map((item) => item.productName).filter(Boolean).join(', ');
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
      key: 'id',
      label: '주문번호',
      sortable: true,
      render: (order) => <span className="font-mono text-caption">{order.id}</span>,
    },
    {
      key: 'productName',
      label: '상품명',
      sortable: false,
      render: (order) => <span className="text-caption">{collectProductNames(order.items)}</span>,
    },
    {
      key: 'color',
      label: '색상',
      sortable: false,
      render: (order) => <span className="text-caption">{collectUnique(order.items, 'color')}</span>,
    },
    {
      key: 'size',
      label: '사이즈',
      sortable: false,
      render: (order) => <span className="text-caption">{collectUnique(order.items, 'size')}</span>,
    },
    {
      key: 'instagramId',
      label: '인스타 ID',
      sortable: false,
      render: (order) => <span>{order.instagramId ? `@${order.instagramId}` : '-'}</span>,
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
              className={`px-2 py-1 text-xs rounded border ${
                order.status === option.value
                  ? 'bg-hot-pink text-white border-hot-pink'
                  : 'bg-transparent text-secondary-text hover:bg-content-bg'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ),
    },
  ];

  const hasActiveFilters = debouncedSearch || dateFrom || dateTo || orderStatusFilter.length > 0;

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
          <Display className="text-hot-pink mb-2">주문관리</Display>
          <Body className="text-secondary-text">주문 내역을 조회하고 상태를 바로 변경합니다</Body>
        </div>
        <Button
          variant="outline"
          onClick={handleExportCsv}
          className="w-full sm:w-auto flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          주문 내역 다운로드
        </Button>
      </div>

      {error && (
        <div className="bg-error/10 border border-error rounded-button p-4 mb-6">
          <Body className="text-error">{error}</Body>
        </div>
      )}

      <div className="bg-content-bg rounded-button p-6 mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-4">
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
            <Button variant="ghost" onClick={handleClearFilters} className="w-full sm:w-auto">
              전체 초기화
            </Button>
          )}
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
            getRowClassName={(order) => (order.status === 'PENDING_PAYMENT' ? 'border-l-4 border-warning bg-warning/5' : '')}
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
        <div className="flex items-center justify-center py-24">
          <Body>불러오는 중...</Body>
        </div>
      }
    >
      <AdminOrdersContent />
    </Suspense>
  );
}
