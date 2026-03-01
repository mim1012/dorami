'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { apiClient } from '@/lib/api/client';
import { Table, Column } from '@/components/common/Table';
import { Pagination } from '@/components/common/Pagination';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Display, Body } from '@/components/common/Typography';

interface UserListItem {
  id: string;
  email: string;
  phone: string | null;
  instagramId: string | null;
  shippingAddressSummary?: string | null;
  createdAt: string;
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

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', pageSize.toString());
    params.set('sortBy', sortBy);
    params.set('sortOrder', sortOrder);

    if (debouncedSearch) params.set('search', debouncedSearch);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);

    router.push(`/admin/users?${params.toString()}`, { scroll: false });
  }, [page, pageSize, sortBy, sortOrder, debouncedSearch, dateFrom, dateTo, router]);

  useEffect(() => {
    const fetchUsers = async () => {
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
  }, [page, pageSize, sortBy, sortOrder, debouncedSearch, dateFrom, dateTo]);

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
    setPage(1);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(amount);

  const columns: Column<UserListItem>[] = [
    {
      key: 'instagramId',
      label: '인스타아이디',
      sortable: false,
      render: (user) => user.instagramId || '-',
    },
    {
      key: 'phone',
      label: '전화번호',
      sortable: false,
      render: (user) => user.phone || '-',
    },
    {
      key: 'shippingAddress',
      label: '배송지',
      sortable: false,
      render: (user) => user.shippingAddressSummary || '-',
    },
    {
      key: 'totalOrders',
      label: '주문횟수',
      sortable: true,
      render: (user) => `${user.totalOrders}건`,
    },
    {
      key: 'totalPurchaseAmount',
      label: '총 구매액',
      sortable: true,
      render: (user) => formatCurrency(user.totalPurchaseAmount),
    },
    {
      key: 'createdAt',
      label: '가입일',
      sortable: true,
      render: (user) => formatDate(user.createdAt),
    },
    {
      key: 'email',
      label: '카카오톡 이메일',
      sortable: true,
      render: (user) => user.email || '-',
    },
  ];

  const hasActiveFilters = debouncedSearch || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      <div className="mb-6 md:mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Display className="text-hot-pink mb-2">사용자관리</Display>
          <Body className="text-secondary-text">인스타 아이디 기준으로 사용자를 조회합니다</Body>
        </div>
      </div>

      {error && (
        <div className="bg-error/10 border border-error rounded-button p-4 mb-6">
          <Body className="text-error">{error}</Body>
        </div>
      )}

      <div className="bg-content-bg rounded-button p-6 mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-4">
          <Input
            placeholder="인스타그램 ID 또는 카카오톡 이메일 검색..."
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

        {isFilterOpen && (
          <div className="pt-4 border-t border-gray-200 space-y-4">
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
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Body className="text-secondary-text">회원 목록 불러오는 중...</Body>
        </div>
      ) : (
        <>
          <Table
            columns={columns}
            data={users}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onRowClick={(user) => router.push(`/admin/users/${user.id}`)}
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
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Body>불러오는 중...</Body>
      </div>
    }>
      <AdminUsersContent />
    </Suspense>
  );
}
