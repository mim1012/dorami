'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import {
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingBag,
  Percent,
  Radio,
  Eye,
  MoreVertical,
} from 'lucide-react';

// --- Types ---

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

interface DailyRevenue {
  date: string;
  revenue: number;
  orderCount: number;
}

interface DashboardStats {
  revenue: StatItem;
  orders: StatItem;
  messages: StatItem;
  pendingPayments: { value: number; formatted: string };
  activeLiveStreams: { value: number; formatted: string };
  topProducts: TopProduct[];
  dailyRevenue: DailyRevenue[];
}

interface LiveStream {
  id: string;
  streamKey: string;
  title: string;
  status: string;
  viewerCount?: number;
  peakViewers?: number;
  startedAt?: string | null;
  scheduledTime?: string | null;
  totalRevenue?: number;
}

interface OrderItem {
  id: string;
  depositorName: string;
  instagramId: string;
  status: string;
  paymentStatus: string;
  total: number;
  itemCount: number;
  createdAt: string;
}

// --- Status helpers ---

const streamStatusColors: Record<string, string> = {
  LIVE: 'bg-red-100 text-red-700',
  PENDING: 'bg-blue-100 text-blue-700',
  OFFLINE: 'bg-gray-100 text-gray-700',
};

const streamStatusLabels: Record<string, string> = {
  LIVE: '방송중',
  PENDING: '예정',
  OFFLINE: '종료',
};

const paymentStatusColors: Record<string, string> = {
  CONFIRMED: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  FAILED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-gray-100 text-gray-700',
};

const paymentStatusLabels: Record<string, string> = {
  CONFIRMED: '결제완료',
  PENDING: '대기중',
  FAILED: '실패',
  REFUNDED: '환불',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function formatKRW(value: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value);
}

function streamDuration(startedAt: string | null | undefined): string {
  if (!startedAt) return '';
  const diff = Date.now() - new Date(startedAt).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}시간 ${mins}분`;
  return `${mins}분`;
}

// --- Component ---

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const fetchAll = async (isInitial = false) => {
    try {
      if (isInitial) setIsLoading(true);
      setError(null);

      const [statsRes, activeRes, upcomingRes, ordersRes] = await Promise.allSettled([
        apiClient.get<DashboardStats>('/admin/dashboard/stats'),
        apiClient.get<LiveStream[]>('/streaming/active'),
        apiClient.get<LiveStream[]>('/streaming/upcoming'),
        apiClient.get<{ orders: OrderItem[] }>(
          '/admin/orders?limit=4&sortBy=createdAt&sortOrder=desc',
        ),
      ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      else if (isInitial) throw statsRes.reason;

      const active =
        activeRes.status === 'fulfilled' && activeRes.value.data ? activeRes.value.data : [];
      const upcoming =
        upcomingRes.status === 'fulfilled' && upcomingRes.value.data ? upcomingRes.value.data : [];
      setLiveStreams([...active, ...upcoming].slice(0, 5));

      if (ordersRes.status === 'fulfilled') {
        setRecentOrders(ordersRes.value.data?.orders ?? []);
      }
    } catch (err: any) {
      console.error('Dashboard fetch failed:', err);
      if (err?.statusCode === 401 || err?.statusCode === 403) stopPolling();
      setError(err?.message || '대시보드를 불러오지 못했습니다');
    } finally {
      if (isInitial) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll(true);
    pollingRef.current = setInterval(() => fetchAll(false), 30000);
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 h-64 bg-gray-200 rounded-xl" />
            <div className="h-64 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      label: '총 매출 (7일)',
      value: stats?.revenue.formatted ?? '-',
      change: stats?.revenue.trend ?? '-',
      trendUp: stats?.revenue.trendUp ?? true,
      icon: TrendingUp,
      iconBg: 'bg-pink-100',
      iconColor: 'text-[#FF1493]',
    },
    {
      label: '실시간 시청자',
      value: stats?.activeLiveStreams.formatted ?? '-',
      change: null,
      trendUp: true,
      icon: Users,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      label: '총 주문 (7일)',
      value: stats?.orders.formatted ?? '-',
      change: stats?.orders.trend ?? '-',
      trendUp: stats?.orders.trendUp ?? true,
      icon: ShoppingBag,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
    },
    {
      label: '결제 대기',
      value: stats?.pendingPayments.formatted ?? '-',
      change: null,
      trendUp: false,
      icon: Percent,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Page Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">대시보드</h1>
        <p className="text-sm md:text-base text-gray-600">
          라이브커머스 운영 현황을 한눈에 확인하세요
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-xl p-4 md:p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center ${kpi.iconBg}`}
              >
                <kpi.icon className={`w-5 h-5 md:w-6 md:h-6 ${kpi.iconColor}`} />
              </div>
              {kpi.change !== null && (
                <span
                  className={`flex items-center gap-0.5 text-xs md:text-sm font-semibold ${
                    kpi.trendUp ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {kpi.trendUp ? (
                    <TrendingUp className="w-3 h-3 md:w-4 md:h-4" />
                  ) : (
                    <TrendingDown className="w-3 h-3 md:w-4 md:h-4" />
                  )}
                  {kpi.change}
                </span>
              )}
            </div>
            <p className="text-gray-600 text-xs md:text-sm mb-1">{kpi.label}</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Live Streams + Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Live Streams Section (2/3 width) */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 md:p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 md:w-5 md:h-5 text-gray-700" />
                <h2 className="text-base md:text-lg font-bold text-gray-900">라이브 방송 현황</h2>
              </div>
              <Link
                href="/admin/live-management"
                className="text-xs md:text-sm text-[#FF1493] font-semibold hover:underline"
              >
                전체보기
              </Link>
            </div>
          </div>
          <div className="p-4 md:p-6">
            {liveStreams.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">현재 방송이 없습니다</p>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {liveStreams.map((stream) => (
                  <div
                    key={stream.id}
                    className="flex items-center justify-between p-3 md:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 md:gap-3 mb-2">
                        <h3 className="font-semibold text-sm md:text-base text-gray-900 truncate">
                          {stream.title || '방송 제목 없음'}
                        </h3>
                        <span
                          className={`px-2 md:px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                            streamStatusColors[stream.status] ?? 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {streamStatusLabels[stream.status] ?? stream.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-gray-600">
                        {stream.status === 'LIVE' ? (
                          <>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3 md:w-4 md:h-4" />
                              {(stream.viewerCount ?? 0).toLocaleString()}명
                            </span>
                            <span className="hidden sm:inline">
                              {streamDuration(stream.startedAt)}
                            </span>
                          </>
                        ) : (
                          <span>
                            {stream.scheduledTime
                              ? new Date(stream.scheduledTime).toLocaleString('ko-KR', {
                                  month: 'numeric',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '예정 시간 미정'}
                          </span>
                        )}
                      </div>
                    </div>
                    <button className="p-2 hover:bg-white rounded-lg transition-colors flex-shrink-0">
                      {stream.status === 'LIVE' ? (
                        <Eye className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
                      ) : (
                        <MoreVertical className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Orders Section (1/3 width) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 md:p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 md:w-5 md:h-5 text-gray-700" />
                <h2 className="text-base md:text-lg font-bold text-gray-900">최근 주문</h2>
              </div>
              <Link
                href="/admin/orders"
                className="text-xs md:text-sm text-[#FF1493] font-semibold hover:underline"
              >
                전체보기
              </Link>
            </div>
          </div>
          <div className="p-4 md:p-6">
            {recentOrders.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">최근 주문이 없습니다</p>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="pb-3 md:pb-4 border-b border-gray-100 last:border-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 text-xs md:text-sm truncate">
                          {order.id}
                        </p>
                        <p className="text-xs md:text-sm text-gray-600">
                          {order.depositorName || order.instagramId || '-'}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ml-2 ${
                          paymentStatusColors[order.paymentStatus] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {paymentStatusLabels[order.paymentStatus] ?? order.paymentStatus}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">상품 {order.itemCount}개</p>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm md:text-base text-gray-900">
                        {formatKRW(order.total)}
                      </p>
                      <p className="text-xs text-gray-400">{timeAgo(order.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
