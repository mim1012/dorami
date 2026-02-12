'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/common/Button';
import { Display, Body, Heading2, Caption } from '@/components/common/Typography';
import { PointAdjustmentModal } from '@/components/admin/users/PointAdjustmentModal';
import { usePointBalance } from '@/lib/hooks/queries/use-points';
import { useToast } from '@/components/common/Toast';

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
  const { showToast } = useToast();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const { data: pointBalance, refetch: refetchPoints } = usePointBalance(userId);

  useEffect(() => {
    fetchUserDetail();
  }, [userId]);

  const fetchUserDetail = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<UserDetail>(`/admin/users/${userId}`);
      setUser(response.data);
      setSelectedStatus(response.data.status);
    } catch (err: any) {
      console.error('Failed to fetch user detail:', err);
      setError(err.response?.data?.message || 'Failed to load user details');
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
    setIsUpdating(true);
    try {
      await apiClient.patch(`/admin/users/${userId}/status`, {
        status: selectedStatus,
      });

      setShowConfirmModal(false);
      await fetchUserDetail();

      showToast('사용자 상태가 변경되었습니다.', 'success');
    } catch (err: any) {
      console.error('Failed to update user status:', err);
      setError(err.response?.data?.message || 'Failed to update user status');
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
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Body>Loading user details...</Body>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-error/10 border border-error rounded-button p-4 mb-6">
            <Body className="text-error">{error || 'User not found'}</Body>
          </div>
          <Button onClick={() => router.push('/admin/users')}>Back to User List</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Display className="text-hot-pink mb-2">User Details</Display>
            <Body className="text-secondary-text">{user.instagramId || user.email}</Body>
          </div>
          <Button variant="outline" onClick={() => router.push('/admin/users')}>
            ← Back to User List
          </Button>
        </div>

        {error && (
          <div className="bg-error/10 border border-error rounded-button p-4 mb-6">
            <Body className="text-error">{error}</Body>
          </div>
        )}

        {/* Profile and Statistics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* User Profile Card */}
          <div className="bg-content-bg rounded-button p-6">
            <Heading2 className="text-hot-pink mb-4">User Profile</Heading2>

            <div className="space-y-4">
              <div>
                <Body className="text-secondary-text text-caption">Instagram ID</Body>
                <Body className="text-hot-pink font-medium">{user.instagramId || '-'}</Body>
              </div>

              <div>
                <Body className="text-secondary-text text-caption">Email</Body>
                <Body>{user.email}</Body>
              </div>

              <div>
                <Body className="text-secondary-text text-caption">Name</Body>
                <Body>{user.name}</Body>
              </div>

              <div>
                <Body className="text-secondary-text text-caption">Depositor Name</Body>
                <Body>{user.depositorName || '-'}</Body>
              </div>

              <div>
                <Body className="text-secondary-text text-caption">Registration Date</Body>
                <Body>{formatDate(user.createdAt)}</Body>
              </div>

              <div>
                <Body className="text-secondary-text text-caption">Last Login</Body>
                <Body>{formatDate(user.lastLoginAt)}</Body>
              </div>

              <div>
                <Body className="text-secondary-text text-caption">Status</Body>
                <select
                  value={selectedStatus}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-button focus:outline-none focus:ring-2 focus:ring-hot-pink"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>

              {user.suspendedAt && (
                <div>
                  <Body className="text-secondary-text text-caption">Suspended At</Body>
                  <Body className="text-error">{formatDate(user.suspendedAt)}</Body>
                </div>
              )}
            </div>
          </div>

          {/* Shipping Address Card */}
          <div className="bg-content-bg rounded-button p-6">
            <Heading2 className="text-hot-pink mb-4">Shipping Address</Heading2>

            {user.shippingAddress ? (
              <div className="space-y-2">
                <Body className="font-medium">{user.shippingAddress.fullName}</Body>
                <Body>{user.shippingAddress.address1}</Body>
                {user.shippingAddress.address2 && <Body>{user.shippingAddress.address2}</Body>}
                <Body>
                  {user.shippingAddress.city}, {user.shippingAddress.state}{' '}
                  {user.shippingAddress.zip}
                </Body>
                <Body>Phone: {user.shippingAddress.phone}</Body>
              </div>
            ) : (
              <Body className="text-secondary-text">No shipping address provided</Body>
            )}
          </div>
        </div>

        {/* User Statistics */}
        <div className="bg-content-bg rounded-button p-6 mb-6">
          <Heading2 className="text-hot-pink mb-4">User Statistics</Heading2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <Display className="text-hot-pink">{user.statistics.totalOrders}</Display>
              <Body className="text-secondary-text text-caption">Total Orders</Body>
            </div>

            <div className="text-center">
              <Display className="text-hot-pink">
                {formatCurrency(user.statistics.totalPurchaseAmount)}
              </Display>
              <Body className="text-secondary-text text-caption">Total Purchase</Body>
            </div>

            <div className="text-center">
              <Display className="text-hot-pink">
                {formatCurrency(user.statistics.averageOrderValue)}
              </Display>
              <Body className="text-secondary-text text-caption">Average Order Value</Body>
            </div>

            <div className="text-center">
              <Display className="text-hot-pink">
                {user.statistics.orderFrequency.toFixed(1)}
              </Display>
              <Body className="text-secondary-text text-caption">Orders/Month</Body>
            </div>
          </div>

          <Body className="text-secondary-text text-caption mt-4">
            Note: Order statistics will be available in Epic 8
          </Body>
        </div>

        {/* Points Section */}
        <div className="bg-content-bg rounded-button p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <Heading2 className="text-hot-pink">Reward Points</Heading2>
            <Button variant="outline" size="sm" onClick={() => setShowPointsModal(true)}>
              Adjust Points
            </Button>
          </div>

          {pointBalance ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <Display className="text-hot-pink">
                  {new Intl.NumberFormat('ko-KR').format(pointBalance.currentBalance)}
                </Display>
                <Caption className="text-secondary-text">Current Balance</Caption>
              </div>
              <div className="text-center">
                <Display className="text-success">
                  {new Intl.NumberFormat('ko-KR').format(pointBalance.lifetimeEarned)}
                </Display>
                <Caption className="text-secondary-text">Lifetime Earned</Caption>
              </div>
              <div className="text-center">
                <Display className="text-info">
                  {new Intl.NumberFormat('ko-KR').format(pointBalance.lifetimeUsed)}
                </Display>
                <Caption className="text-secondary-text">Lifetime Used</Caption>
              </div>
              <div className="text-center">
                <Display className="text-gray-500">
                  {new Intl.NumberFormat('ko-KR').format(pointBalance.lifetimeExpired)}
                </Display>
                <Caption className="text-secondary-text">Expired</Caption>
              </div>
            </div>
          ) : (
            <Body className="text-secondary-text">No points data available</Body>
          )}
        </div>

        {/* Order History Placeholder */}
        <div className="bg-content-bg rounded-button p-6">
          <Heading2 className="text-hot-pink mb-4">Order History</Heading2>
          <Body className="text-secondary-text">Order history will be available in Epic 8</Body>
        </div>
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
            <Heading2 className="text-hot-pink mb-4">Confirm Status Update</Heading2>
            <Body className="mb-6">
              {selectedStatus === 'SUSPENDED'
                ? 'Are you sure you want to suspend this user? They will not be able to log in.'
                : `Are you sure you want to change the user status to ${selectedStatus}?`}
            </Body>
            <div className="flex gap-4">
              <Button
                variant="primary"
                onClick={confirmStatusUpdate}
                disabled={isUpdating}
                className="flex-1"
              >
                {isUpdating ? 'Updating...' : 'Confirm'}
              </Button>
              <Button
                variant="outline"
                onClick={cancelStatusUpdate}
                disabled={isUpdating}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
