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

interface UserListItem {
  id: string;
  email: string;
  name: string;
  instagramId: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  status: string;
  role: string;
  totalOrders: number;
  totalPurchaseAmount: number;
}

interface UserListResponse {
  users: UserListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function AdminUsersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  const [users, setUsers] = useState<UserListItem[]>([]);
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
  const [statusFilter, setStatusFilter] = useState<string[]>(
    searchParams.get('status')?.split(',').filter(Boolean) || [],
  );

  // [DEV] Auth check disabled for development
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
    if (statusFilter.length > 0) params.set('status', statusFilter.join(','));

    router.push(`/admin/users?${params.toString()}`, { scroll: false });
  }, [page, pageSize, sortBy, sortOrder, debouncedSearch, dateFrom, dateTo, statusFilter, router]);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      // [DEV] if (!user || user.role !== 'ADMIN') return;

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
        if (statusFilter.length > 0) params.status = statusFilter;

        const response = await apiClient.get<UserListResponse>('/admin/users', { params });

        setUsers(response.data.users);
        setTotal(response.data.total);
        setTotalPages(response.data.totalPages);
      } catch (err: any) {
        console.error('Failed to fetch users:', err);
        setError(err.response?.data?.message || 'Failed to load users');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [user, page, pageSize, sortBy, sortOrder, debouncedSearch, dateFrom, dateTo, statusFilter]);

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
    setStatusFilter([]);
    setPage(1);
  };

  const handleStatusToggle = (status: string) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
    setPage(1);
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

  const getStatusBadge = (status: string) => {
    const colors = {
      ACTIVE: 'bg-success/10 text-success border-success',
      INACTIVE: 'bg-secondary-text/10 text-secondary-text border-secondary-text',
      SUSPENDED: 'bg-error/10 text-error border-error',
    };

    const color = colors[status as keyof typeof colors] || colors.INACTIVE;

    return <span className={`px-2 py-1 rounded text-caption border ${color}`}>{status}</span>;
  };

  const columns: Column<UserListItem>[] = [
    {
      key: 'instagramId',
      label: 'Instagram ID',
      sortable: true,
      render: (user) => user.instagramId || '-',
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
    },
    {
      key: 'name',
      label: 'Name',
      sortable: true,
    },
    {
      key: 'createdAt',
      label: 'Registration Date',
      sortable: true,
      render: (user) => formatDate(user.createdAt),
    },
    {
      key: 'lastLoginAt',
      label: 'Last Login',
      sortable: true,
      render: (user) => formatDate(user.lastLoginAt),
    },
    {
      key: 'totalOrders',
      label: 'Total Orders',
      render: (user) => user.totalOrders.toString(),
    },
    {
      key: 'totalPurchaseAmount',
      label: 'Total Purchase',
      render: (user) => formatCurrency(user.totalPurchaseAmount),
    },
    {
      key: 'status',
      label: 'Status',
      render: (user) => getStatusBadge(user.status),
    },
  ];

  const hasActiveFilters =
    debouncedSearch || dateFrom || dateTo || statusFilter.length > 0;

  if (false && (authLoading || (user && user.role !== 'ADMIN'))) { // [DEV] disabled
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Body>Loading...</Body>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Display className="text-hot-pink mb-2">User Management</Display>
          <Body className="text-secondary-text">View and manage all registered users</Body>
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
              placeholder="Search by name, email, or Instagram ID..."
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
                  label="Registration Date From"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  fullWidth
                />
                <Input
                  label="Registration Date To"
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  fullWidth
                />
              </div>

              {/* Status Filter */}
              <div>
                <Body className="text-primary-text font-medium mb-2">Status</Body>
                <div className="flex gap-2">
                  {['ACTIVE', 'INACTIVE', 'SUSPENDED'].map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusToggle(status)}
                      className={`px-4 py-2 rounded-button text-caption transition-colors ${
                        statusFilter.includes(status)
                          ? 'bg-hot-pink text-white'
                          : 'bg-white text-secondary-text hover:bg-gray-100'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <Body className="text-secondary-text text-caption">
                Note: Order count and purchase amount filters will be available in Epic 8
              </Body>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Body className="text-secondary-text">Loading users...</Body>
          </div>
        ) : (
          <>
            <Table
              columns={columns}
              data={users}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              emptyMessage="No users found matching your filters"
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

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Body>Loading...</Body>
        </div>
      }
    >
      <AdminUsersContent />
    </Suspense>
  );
}
