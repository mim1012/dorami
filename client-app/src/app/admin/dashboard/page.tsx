'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api/client';
import { Display, Heading2, Body, Caption } from '@/components/common/Typography';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  DollarSign,
  Clock,
  Radio,
  Package,
  BarChart3,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const fetchDashboardStats = async () => {
    try {
      if (!stats) setIsLoading(true);
      setError(null);

      const response = await apiClient.get<DashboardStats>('/admin/dashboard/stats');
      setStats(response.data);
    } catch (err: any) {
      console.error('Failed to fetch dashboard stats:', err);
      if (err?.statusCode === 401 || err?.statusCode === 403) {
        stopPolling();
      }
      setError(err?.message || '대시보드 통계를 불러오지 못했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 초기 데이터 조회
    fetchDashboardStats();

    // 30초마다 자동 새로고침
    pollingRef.current = setInterval(() => {
      fetchDashboardStats();
    }, 30000);

    // 컴포넌트 언마운트 시 인터벌 정리
    return () => stopPolling();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Body className="text-secondary-text">대시보드 로딩 중...</Body>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-error/10 border border-error rounded-button p-4">
            <Caption className="text-error">{error || '데이터가 없습니다'}</Caption>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <Display className="text-hot-pink mb-2">대시보드 현황</Display>
          <Body className="text-secondary-text">
            최근 7일간의 비즈니스 성과를 한눈에 확인하세요
          </Body>
        </div>

        {/* 주요 통계 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* 총 매출 */}
          <div className="bg-content-bg rounded-button p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-hot-pink/10 rounded-button">
                <DollarSign className="w-6 h-6 text-hot-pink" />
              </div>
              <div
                className={`flex items-center gap-1 ${stats.revenue.trendUp ? 'text-success' : 'text-error'}`}
              >
                {stats.revenue.trendUp ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <Caption className="font-medium">{stats.revenue.trend}</Caption>
              </div>
            </div>
            <Caption className="text-secondary-text mb-1">총 매출</Caption>
            <Heading2 className="text-hot-pink mb-1">{stats.revenue.formatted}</Heading2>
            <Caption className="text-secondary-text">최근 7일</Caption>
          </div>

          {/* 총 주문 */}
          <div className="bg-content-bg rounded-button p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-info/10 rounded-button">
                <ShoppingCart className="w-6 h-6 text-info" />
              </div>
              <div
                className={`flex items-center gap-1 ${stats.orders.trendUp ? 'text-success' : 'text-error'}`}
              >
                {stats.orders.trendUp ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <Caption className="font-medium">{stats.orders.trend}</Caption>
              </div>
            </div>
            <Caption className="text-secondary-text mb-1">총 주문</Caption>
            <Heading2 className="text-primary-text mb-1">{stats.orders.formatted}</Heading2>
            <Caption className="text-secondary-text">이전 7일 대비</Caption>
          </div>

          {/* 결제 대기 */}
          <div className="bg-content-bg rounded-button p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-warning/10 rounded-button">
                <Clock className="w-6 h-6 text-warning" />
              </div>
            </div>
            <Caption className="text-secondary-text mb-1">결제 대기</Caption>
            <Heading2 className="text-warning mb-1">{stats.pendingPayments.formatted}</Heading2>
            <Caption className="text-secondary-text">결제 대기 중인 주문</Caption>
          </div>

          {/* 진행 중인 라이브 */}
          <div className="bg-content-bg rounded-button p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-success/10 rounded-button">
                <Radio className="w-6 h-6 text-success" />
              </div>
            </div>
            <Caption className="text-secondary-text mb-1">진행 중인 라이브</Caption>
            <Heading2 className="text-success mb-1">{stats.activeLiveStreams.formatted}</Heading2>
            <Caption className="text-secondary-text">현재 방송 중</Caption>
          </div>

          {/* 채팅 메시지 */}
          <div className="bg-content-bg rounded-button p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-purple-500/10 rounded-button">
                <Package className="w-6 h-6 text-purple-500" />
              </div>
              <div
                className={`flex items-center gap-1 ${stats.messages.trendUp ? 'text-success' : 'text-error'}`}
              >
                {stats.messages.trendUp ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <Caption className="font-medium">{stats.messages.trend}</Caption>
              </div>
            </div>
            <Caption className="text-secondary-text mb-1">채팅 메시지</Caption>
            <Heading2 className="text-primary-text mb-1">{stats.messages.formatted}</Heading2>
            <Caption className="text-secondary-text">최근 7일</Caption>
          </div>
        </div>

        {/* 매출 추이 차트 */}
        {stats.dailyRevenue && stats.dailyRevenue.length > 0 && (
          <div className="bg-content-bg rounded-button p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-hot-pink/10 rounded-button">
                <BarChart3 className="w-5 h-5 text-hot-pink" />
              </div>
              <Heading2 className="text-hot-pink">일별 매출 추이 (최근 7일)</Heading2>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.dailyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                  style={{ fontSize: '12px', fill: '#6B7280' }}
                />
                <YAxis
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                  style={{ fontSize: '12px', fill: '#6B7280' }}
                />
                <Tooltip
                  formatter={(value: number | undefined) => {
                    if (value === undefined) return ['', '매출액'];
                    return [
                      new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        maximumFractionDigits: 0,
                      }).format(value),
                      '매출액',
                    ];
                  }}
                  labelFormatter={(label: any) => {
                    const date = new Date(label);
                    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                  }}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #FF1B8D',
                    borderRadius: '8px',
                    padding: '8px',
                  }}
                />
                <Bar dataKey="revenue" fill="#FF1B8D" radius={[8, 8, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>

            <Caption className="text-secondary-text text-center mt-3">
              입금 확인된 주문 기준 • 마우스를 올리면 상세 정보를 확인할 수 있습니다
            </Caption>
          </div>
        )}

        {/* 판매 상위 상품 */}
        {stats.topProducts.length > 0 && (
          <div className="bg-content-bg rounded-button p-6">
            <Heading2 className="text-hot-pink mb-4">판매 상위 5개 상품</Heading2>
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
                      <Caption className="text-secondary-text">
                        ID: {product.productId.substring(0, 8)}
                      </Caption>
                    </div>
                  </div>
                  <div className="text-right">
                    <Body className="text-hot-pink font-bold">{product.totalSold}</Body>
                    <Caption className="text-secondary-text">판매</Caption>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.topProducts.length === 0 && (
          <div className="bg-content-bg rounded-button p-12 text-center">
            <div className="w-16 h-16 mb-4 rounded-xl bg-gray-100 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                />
              </svg>
            </div>
            <Heading2 className="text-secondary-text mb-2">판매 데이터 없음</Heading2>
            <Body className="text-secondary-text">
              확정된 주문이 생기면 인기 판매 상품이 여기에 표시됩니다
            </Body>
          </div>
        )}
      </div>
    </div>
  );
}
