'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { apiClient } from '@/lib/api/client';
import { Table, Column } from '@/components/common/Table';
import { Pagination } from '@/components/common/Pagination';
import { Display, Body } from '@/components/common/Typography';

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

    router.push(`/admin/users?${params.toString()}`, { scroll: false });
  }, [page, pageSize, sortBy, sortOrder, router]);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      if (!user || user.role !== 'ADMIN') return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.get<UserListResponse>('/admin/users', {
          params: {
            page,
            limit: pageSize,
            sortBy,
            sortOrder,
          },
        });

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
  }, [user, page, pageSize, sortBy, sortOrder]);

  const handleSort = (key: string) => {
    if (key === sortBy) {
      // Toggle sort order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New sort column, default to desc
      setSortBy(key);
      setSortOrder('desc');
    }
    setPage(1); // Reset to first page
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
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

    return (
      <span className={`px-2 py-1 rounded text-caption border ${color}`}>
        {status}
      </span>
    );
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

  if (authLoading || (user && user.role !== 'ADMIN')) {
    return (
      <div className="min-h-screen bg-primary-black flex items-center justify-center">
        <Body>Loading...</Body>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-black py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Display className="text-hot-pink mb-2">User Management</Display>
          <Body className="text-secondary-text">
            View and manage all registered users
          </Body>
        </div>

        {error && (
          <div className="bg-error/10 border border-error rounded-button p-4 mb-6">
            <Body className="text-error">{error}</Body>
          </div>
        )}

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
              emptyMessage="No users found"
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
        <div className="min-h-screen bg-primary-black flex items-center justify-center">
          <Body>Loading...</Body>
        </div>
      }
    >
      <AdminUsersContent />
    </Suspense>
  );
}
