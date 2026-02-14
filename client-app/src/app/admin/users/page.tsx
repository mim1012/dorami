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
        setError(err.response?.data?.message || '회원 목록을 불러오지 못했습니다');
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
    return date.toLocaleDateString('ko-KR', {
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

  const getStatusBadge = (status: string) => {
    const colors = {
      ACTIVE: 'bg-success/10 text-success border-success',
      INACTIVE: 'bg-secondary-text/10 text-secondary-text border-secondary-text',
      SUSPENDED: 'bg-error/10 text-error border-error',
    };

    const color = colors[status as keyof typeof colors] || colors.INACTIVE;

    const statusLabels: Record<string, string> = {
      ACTIVE: '활성',
      INACTIVE: '비활성',
      SUSPENDED: '정지',
    };
    return <span className={`px-2 py-1 rounded text-caption border ${color}`}>{statusLabels[status] || status}</span>;
  };

  const columns: Column<UserListItem>[] = [
    {
      key: 'instagramId',
      label: '인스타그램 ID',
      sortable: true,
      render: (user) => user.instagramId || '-',
    },
    {
      key: 'email',
      label: '이메일',
      sortable: true,
    },
    {
      key: 'name',
      label: '이름',
      sortable: true,
    },
    {
      key: 'createdAt',
      label: '가입일',
      sortable: true,
      render: (user) => formatDate(user.createdAt),
    },
    {
      key: 'lastLoginAt',
      label: '최근 로그인',
      sortable: true,
      render: (user) => formatDate(user.lastLoginAt),
    },
    {
      key: 'totalOrders',
      label: '총 주문수',
      render: (user) => user.totalOrders.toString(),
    },
    {
      key: 'totalPurchaseAmount',
      label: '총 구매액',
      render: (user) => formatCurrency(user.totalPurchaseAmount),
    },
    {
      key: 'status',
      label: '상태',
      render: (user) => getStatusBadge(user.status),
    },
  ];

  const hasActiveFilters =
    debouncedSearch || dateFrom || dateTo || statusFilter.length > 0;

  // [DEV] Auth check disabled for development
  // if (authLoading || (user && user?.role !== 'ADMIN')) {
  //   return (
  //     <div className="min-h-screen bg-white flex items-center justify-center">
  //       <Body>Loading...</Body>
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="mb-8">
        <Display className="text-hot-pink mb-2">회원 관리</Display>
        <Body className="text-secondary-text">등록된 회원을 조회하고 관리합니다</Body>
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
            placeholder="이름, 이메일 또는 인스타그램 ID로 검색..."
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
                label="가입일 시작"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                fullWidth
              />
              <Input
                label="가입일 종료"
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
              <Body className="text-primary-text font-medium mb-2">상태</Body>
              <div className="flex gap-2">
                {(['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const).map((status) => {
                  const statusLabelsFilter: Record<string, string> = {
                    ACTIVE: '활성',
                    INACTIVE: '비활성',
                    SUSPENDED: '정지',
                  };
                  return (
                  <button
                    key={status}
                    onClick={() => handleStatusToggle(status)}
                    className={`px-4 py-2 rounded-button text-caption transition-colors ${
                      statusFilter.includes(status)
                        ? 'bg-hot-pink text-white'
                        : 'bg-white text-secondary-text hover:bg-gray-100'
                    }`}
                  >
                    {statusLabelsFilter[status]}
                  </button>
                  );
                })}
              </div>
            </div>

            <Body className="text-secondary-text text-caption">
              참고: 주문수 및 구매액 필터는 Epic 8에서 추가될 예정입니다
            </Body>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Body className="text-secondary-text">회원 목록을 불러오는 중...</Body>
        </div>
      ) : (
        <>
          <Table
            columns={columns}
            data={users}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            emptyMessage="필터 조건에 맞는 회원이 없습니다"
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

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Body>불러오는 중...</Body>
        </div>
      }
    >
      <AdminUsersContent />
    </Suspense>
  );
}
