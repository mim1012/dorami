'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { Display, Heading2, Body, Caption } from '@/components/common/Typography';
import { TrendingUp, TrendingDown, ShoppingCart, DollarSign, Clock, Radio, Package } from 'lucide-react';

interface StatItem {
  value: number;
  formatted: string;
  trend: string;
  trendUp: boolean;
}

interface TopProduct {
  productId: string;
  productName: string;
  totalSold: number;
}

interface DashboardStats {
  revenue: StatItem;
  orders: StatItem;
  messages: StatItem;
  pendingPayments: { value: number; formatted: string };
  activeLiveStreams: { value: number; formatted: string };
  topProducts: TopProduct[];
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initial fetch
    fetchDashboardStats();

    // Auto-refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      fetchDashboardStats();
    }, 30000);

    // Cleanup interval on unmount
    return () => clearInterval(refreshInterval);
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.get<DashboardStats>('/admin/dashboard/stats');
      setStats(response.data);
    } catch (err: any) {
      console.error('Failed to fetch dashboard stats:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard statistics');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Body className="text-secondary-text">Loading dashboard...</Body>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-error/10 border border-error rounded-button p-4">
            <Caption className="text-error">{error || 'No data available'}</Caption>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Display className="text-hot-pink mb-2">Dashboard Overview</Display>
          <Body className="text-secondary-text">
            Monitor your business performance at a glance (Last 7 days)
          </Body>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Total Revenue */}
          <div className="bg-content-bg rounded-button p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-hot-pink/10 rounded-button">
                <DollarSign className="w-6 h-6 text-hot-pink" />
              </div>
              <div className={`flex items-center gap-1 ${stats.revenue.trendUp ? 'text-green-500' : 'text-red-500'}`}>
                {stats.revenue.trendUp ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <Caption className="font-medium">{stats.revenue.trend}</Caption>
              </div>
            </div>
            <Caption className="text-secondary-text mb-1">Total Revenue</Caption>
            <Heading2 className="text-hot-pink mb-1">{stats.revenue.formatted}</Heading2>
            <Caption className="text-secondary-text">Last 7 days</Caption>
          </div>

          {/* Total Orders */}
          <div className="bg-content-bg rounded-button p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-blue-500/10 rounded-button">
                <ShoppingCart className="w-6 h-6 text-blue-500" />
              </div>
              <div className={`flex items-center gap-1 ${stats.orders.trendUp ? 'text-green-500' : 'text-red-500'}`}>
                {stats.orders.trendUp ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <Caption className="font-medium">{stats.orders.trend}</Caption>
              </div>
            </div>
            <Caption className="text-secondary-text mb-1">Total Orders</Caption>
            <Heading2 className="text-primary-text mb-1">{stats.orders.formatted}</Heading2>
            <Caption className="text-secondary-text">vs Previous 7 days</Caption>
          </div>

          {/* Pending Payments */}
          <div className="bg-content-bg rounded-button p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-orange-500/10 rounded-button">
                <Clock className="w-6 h-6 text-orange-500" />
              </div>
            </div>
            <Caption className="text-secondary-text mb-1">Pending Payments</Caption>
            <Heading2 className="text-orange-500 mb-1">{stats.pendingPayments.formatted}</Heading2>
            <Caption className="text-secondary-text">Orders awaiting payment</Caption>
          </div>

          {/* Active Live Streams */}
          <div className="bg-content-bg rounded-button p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-green-500/10 rounded-button">
                <Radio className="w-6 h-6 text-green-500" />
              </div>
            </div>
            <Caption className="text-secondary-text mb-1">Active Live Streams</Caption>
            <Heading2 className="text-green-500 mb-1">{stats.activeLiveStreams.formatted}</Heading2>
            <Caption className="text-secondary-text">Currently broadcasting</Caption>
          </div>

          {/* Chat Messages */}
          <div className="bg-content-bg rounded-button p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-purple-500/10 rounded-button">
                <Package className="w-6 h-6 text-purple-500" />
              </div>
              <div className={`flex items-center gap-1 ${stats.messages.trendUp ? 'text-green-500' : 'text-red-500'}`}>
                {stats.messages.trendUp ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <Caption className="font-medium">{stats.messages.trend}</Caption>
              </div>
            </div>
            <Caption className="text-secondary-text mb-1">Chat Messages</Caption>
            <Heading2 className="text-primary-text mb-1">{stats.messages.formatted}</Heading2>
            <Caption className="text-secondary-text">Last 7 days</Caption>
          </div>
        </div>

        {/* Top Selling Products */}
        {stats.topProducts.length > 0 && (
          <div className="bg-content-bg rounded-button p-6">
            <Heading2 className="text-hot-pink mb-4">Top 5 Selling Products</Heading2>
            <div className="space-y-3">
              {stats.topProducts.map((product, index) => (
                <div
                  key={product.productId}
                  className="flex items-center justify-between p-4 bg-white rounded-button hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-hot-pink/10">
                      <Body className="text-hot-pink font-bold">#{index + 1}</Body>
                    </div>
                    <div>
                      <Body className="text-primary-text font-medium">{product.productName}</Body>
                      <Caption className="text-secondary-text">ID: {product.productId.substring(0, 8)}</Caption>
                    </div>
                  </div>
                  <div className="text-right">
                    <Body className="text-hot-pink font-bold">{product.totalSold}</Body>
                    <Caption className="text-secondary-text">sold</Caption>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.topProducts.length === 0 && (
          <div className="bg-content-bg rounded-button p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <Heading2 className="text-secondary-text mb-2">No Sales Data Yet</Heading2>
            <Body className="text-secondary-text">
              Top selling products will appear here once you have confirmed orders
            </Body>
          </div>
        )}
      </div>
    </div>
  );
}
