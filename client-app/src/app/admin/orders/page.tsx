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

interface OrderListItem {
  id: string;
  userId: string;
  userEmail: string;
  depositorName: string;
  instagramId: string;
  status: string;
  paymentStatus: string;
  shippingStatus: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  itemCount: number;
  createdAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
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
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string[]>(
    searchParams.get('paymentStatus')?.split(',').filter(Boolean) || [],
  );
  const [shippingStatusFilter, setShippingStatusFilter] = useState<string[]>(
    searchParams.get('shippingStatus')?.split(',').filter(Boolean) || [],
  );
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);

  // Redirect if not admin
  // TEMPORARILY DISABLED FOR TESTING
  // useEffect(() => {
  //   if (!authLoading) {
  //     if (!user) {
  //       router.push('/login');
  //     } else if (user.role !== 'ADMIN') {
  //       router.push('/');
  //     }
  //   }
  // }, [user, authLoading, router]);

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
    if (paymentStatusFilter.length > 0)
      params.set('paymentStatus', paymentStatusFilter.join(','));
    if (shippingStatusFilter.length > 0)
      params.set('shippingStatus', shippingStatusFilter.join(','));

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
    paymentStatusFilter,
    shippingStatusFilter,
    router,
  ]);

  // Fetch orders
  useEffect(() => {
    const fetchOrders = async () => {
      // TEMPORARILY DISABLED FOR TESTING
      // if (!user || user.role !== 'ADMIN') return;

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
        if (paymentStatusFilter.length > 0) params.paymentStatus = paymentStatusFilter;
        if (shippingStatusFilter.length > 0) params.shippingStatus = shippingStatusFilter;

        const response = await apiClient.get<OrderListResponse>('/admin/orders', { params });

        setOrders(response.data.orders);
        setTotal(response.data.total);
        setTotalPages(response.data.totalPages);
      } catch (err: any) {
        console.error('Failed to fetch orders:', err);
        setError(err.response?.data?.message || 'Failed to load orders');
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
    paymentStatusFilter,
    shippingStatusFilter,
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
    setPaymentStatusFilter([]);
    setShippingStatusFilter([]);
    setPage(1);
  };

  const handleStatusToggle = (
    status: string,
    filterType: 'order' | 'payment' | 'shipping',
  ) => {
    if (filterType === 'order') {
      setOrderStatusFilter((prev) =>
        prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
      );
    } else if (filterType === 'payment') {
      setPaymentStatusFilter((prev) =>
        prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
      );
    } else {
      setShippingStatusFilter((prev) =>
        prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
      );
    }
    setPage(1);
  };

  const handleConfirmPayment = async (order: OrderListItem) => {
    const confirmed = window.confirm(
      `입금 확인\n\n` +
      `주문번호: ${order.id}\n` +
      `고객: @${order.instagramId}\n` +
      `입금자명: ${order.depositorName}\n` +
      `금액: ${formatCurrency(order.total)}\n\n` +
      `은행 계좌로 위 금액의 입금을 확인하셨습니까?`
    );

    if (!confirmed) return;

    setConfirmingOrderId(order.id);
    try {
      await apiClient.patch(`/admin/orders/${order.id}/confirm-payment`);
      alert(`주문 ${order.id} 입금이 확인되었습니다`);

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
      if (paymentStatusFilter.length > 0) params.paymentStatus = paymentStatusFilter;
      if (shippingStatusFilter.length > 0) params.shippingStatus = shippingStatusFilter;

      const response = await apiClient.get<OrderListResponse>('/admin/orders', { params });
      setOrders(response.data.orders);
      setTotal(response.data.total);
      setTotalPages(response.data.totalPages);
    } catch (err: any) {
      console.error('Failed to confirm payment:', err);
      const errorMessage = err.message || '입금 확인 중 오류가 발생했습니다. 다시 시도해주세요';
      alert(errorMessage);
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
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
    }).format(amount);
  };

  const getStatusBadge = (status: string, type: 'order' | 'payment' | 'shipping') => {
    const orderColors: Record<string, string> = {
      PENDING_PAYMENT: 'bg-warning/10 text-warning border-warning',
      PAYMENT_CONFIRMED: 'bg-success/10 text-success border-success',
      CANCELLED: 'bg-error/10 text-error border-error',
    };

    const paymentColors: Record<string, string> = {
      PENDING: 'bg-warning/10 text-warning border-warning',
      CONFIRMED: 'bg-success/10 text-success border-success',
      FAILED: 'bg-error/10 text-error border-error',
    };

    const shippingColors: Record<string, string> = {
      PENDING: 'bg-secondary-text/10 text-secondary-text border-secondary-text',
      PROCESSING: 'bg-warning/10 text-warning border-warning',
      SHIPPED: 'bg-info/10 text-info border-info',
      DELIVERED: 'bg-success/10 text-success border-success',
    };

    const colorMap = type === 'order' ? orderColors : type === 'payment' ? paymentColors : shippingColors;
    const color = colorMap[status] || 'bg-secondary-text/10 text-secondary-text border-secondary-text';

    return <span className={`px-2 py-1 rounded text-caption border ${color}`}>{status}</span>;
  };

  const columns: Column<OrderListItem>[] = [
    {
      key: 'id',
      label: 'Order ID',
      sortable: true,
      render: (order) => (
        <span className="font-mono text-caption">{order.id}</span>
      ),
    },
    {
      key: 'userEmail',
      label: 'Customer',
      sortable: false,
      render: (order) => (
        <div className="flex flex-col">
          <span className="text-caption">{order.userEmail}</span>
          <span className="text-caption text-secondary-text">@{order.instagramId}</span>
        </div>
      ),
    },
    {
      key: 'depositorName',
      label: 'Depositor',
      sortable: false,
    },
    {
      key: 'status',
      label: 'Order Status',
      render: (order) => getStatusBadge(order.status, 'order'),
    },
    {
      key: 'paymentStatus',
      label: 'Payment',
      render: (order) => getStatusBadge(order.paymentStatus, 'payment'),
    },
    {
      key: 'shippingStatus',
      label: 'Shipping',
      render: (order) => getStatusBadge(order.shippingStatus, 'shipping'),
    },
    {
      key: 'total',
      label: 'Total',
      sortable: true,
      render: (order) => (
        <div className="flex flex-col">
          <span className="font-medium">{formatCurrency(order.total)}</span>
          <span className="text-caption text-secondary-text">
            {order.itemCount} item{order.itemCount > 1 ? 's' : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (order) => formatDate(order.createdAt),
    },
    {
      key: 'paidAt',
      label: 'Paid',
      sortable: true,
      render: (order) => formatDate(order.paidAt),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (order) => (
        <div className="flex gap-2 items-center justify-end">
          {order.paymentStatus === 'PENDING' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleConfirmPayment(order)}
              disabled={confirmingOrderId === order.id}
              className="bg-green-600 hover:bg-green-700 text-white border-green-600"
            >
              {confirmingOrderId === order.id ? '처리중...' : '입금확인'}
            </Button>
          )}
          {order.paymentStatus === 'CONFIRMED' && (
            <span className="text-green-600 font-medium text-caption">✓ 확인완료</span>
          )}
        </div>
      ),
    },
  ];

  const hasActiveFilters =
    debouncedSearch ||
    dateFrom ||
    dateTo ||
    orderStatusFilter.length > 0 ||
    paymentStatusFilter.length > 0 ||
    shippingStatusFilter.length > 0;

  // TEMPORARILY DISABLED FOR TESTING
  // if (authLoading || (user && user.role !== 'ADMIN')) {
  //   return (
  //     <div className="min-h-screen bg-white flex items-center justify-center">
  //       <Body>Loading...</Body>
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Display className="text-hot-pink mb-2">Order Management</Display>
          <Body className="text-secondary-text">View and manage all customer orders</Body>
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
              placeholder="Search by Order ID, email, depositor name, or Instagram ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              fullWidth
            />
            <Button
              variant={isFilterOpen ? 'primary' : 'outline'}
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="whitespace-nowrap"
            >
              {isFilterOpen ? 'Hide Filters' : 'Show Filters'}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" onClick={handleClearFilters}>
                Clear All
              </Button>
            )}
          </div>

          {/* Filter Panel */}
          {isFilterOpen && (
            <div className="pt-4 border-t border-gray-200 space-y-4">
              <Heading2 className="text-hot-pink text-body">Filters</Heading2>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Order Date From"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  fullWidth
                />
                <Input
                  label="Order Date To"
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
                <Body className="text-primary-text font-medium mb-2">Order Status</Body>
                <div className="flex gap-2 flex-wrap">
                  {['PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'CANCELLED'].map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusToggle(status, 'order')}
                      className={`px-4 py-2 rounded-button text-caption transition-colors ${
                        orderStatusFilter.includes(status)
                          ? 'bg-hot-pink text-white'
                          : 'bg-white text-secondary-text hover:bg-gray-100'
                      }`}
                    >
                      {status.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Status Filter */}
              <div>
                <Body className="text-primary-text font-medium mb-2">Payment Status</Body>
                <div className="flex gap-2 flex-wrap">
                  {['PENDING', 'CONFIRMED', 'FAILED'].map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusToggle(status, 'payment')}
                      className={`px-4 py-2 rounded-button text-caption transition-colors ${
                        paymentStatusFilter.includes(status)
                          ? 'bg-hot-pink text-white'
                          : 'bg-white text-secondary-text hover:bg-gray-100'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shipping Status Filter */}
              <div>
                <Body className="text-primary-text font-medium mb-2">Shipping Status</Body>
                <div className="flex gap-2 flex-wrap">
                  {['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'].map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusToggle(status, 'shipping')}
                      className={`px-4 py-2 rounded-button text-caption transition-colors ${
                        shippingStatusFilter.includes(status)
                          ? 'bg-hot-pink text-white'
                          : 'bg-white text-secondary-text hover:bg-gray-100'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Body className="text-secondary-text">Loading orders...</Body>
          </div>
        ) : (
          <>
            <Table
              columns={columns}
              data={orders}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              emptyMessage="No orders found matching your filters"
              getRowClassName={(order) =>
                order.paymentStatus === 'PENDING' ? 'border-l-4 border-yellow-500 bg-yellow-50/5' : ''
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
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Body>Loading...</Body>
        </div>
      }
    >
      <AdminOrdersContent />
    </Suspense>
  );
}
