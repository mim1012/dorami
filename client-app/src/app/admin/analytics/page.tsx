'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Radio, Package, Users, Layers } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Display, Body } from '@/components/common/Typography';

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

interface OptionSalesItem {
  option: string;
  sales: number;
}

interface DashboardStats {
  revenue: StatItem;
  orders: StatItem;
  messages: StatItem;
  pendingPayments: { value: number; formatted: string };
  activeLiveStreams: { value: number; formatted: string };
  topProducts: TopProduct[];
  dailyRevenue: DailyRevenue[];
  optionSales?: OptionSalesItem[];
}

function formatKRW(value: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await apiClient.get<DashboardStats>('/admin/dashboard/stats');
        setStats(response.data);
      } catch (err: any) {
        setError(err?.message || '분석 데이터를 불러오지 못했습니다');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Display>분석</Display>
        <div className="text-secondary-text">불러오는 중입니다...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <Display>분석</Display>
        <div className="bg-error/10 border border-error rounded-button p-4">
          <Body className="text-error">{error || '분석 데이터를 불러오지 못했습니다'}</Body>
        </div>
      </div>
    );
  }

  const topProducts = stats.topProducts.slice(0, 5);
  const optionSales = (stats.optionSales || []).slice(0, 8);
  const maxOptionSales = Math.max(1, ...optionSales.map((item) => item.sales));

  const maxRevenueDay = Math.max(1, ...stats.dailyRevenue.map((item) => item.orderCount));

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <Display className="text-secondary-text">분석</Display>
        <p className="text-sm text-secondary-text mt-1">실시간 결제완료 주문 기반 KPI</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-content-bg rounded-card border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-hot-pink/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-hot-pink" />
            </div>
          </div>
          <p className="text-sm text-secondary-text mb-1">총 매출 (7일)</p>
          <p className="text-2xl font-bold text-primary-text">{stats.revenue.formatted}</p>
          <p
            className={`text-xs font-medium mt-2 ${
              stats.revenue.trendUp ? 'text-success' : 'text-error'
            }`}
          >
            지난 7일 대비 {stats.revenue.trend}
          </p>
        </div>

        <div className="bg-content-bg rounded-card border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Radio className="w-5 h-5 text-blue-500" />
            </div>
          </div>
          <p className="text-sm text-secondary-text mb-1">라이브 세션</p>
          <p className="text-2xl font-bold text-primary-text">{stats.activeLiveStreams.value}</p>
          <p className="text-xs text-secondary-text mt-2">
            진행중/예정 스트림 수 (최근 지표)
          </p>
        </div>

        <div className="bg-content-bg rounded-card border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-sm text-secondary-text mb-1">결제완료 주문 (7일)</p>
          <p className="text-2xl font-bold text-primary-text">{stats.orders.formatted}</p>
          <p
            className={`text-xs font-medium mt-2 ${
              stats.orders.trendUp ? 'text-success' : 'text-error'
            }`}
          >
            지난 7일 대비 {stats.orders.trend}
          </p>
        </div>

        <div className="bg-content-bg rounded-card border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="text-sm text-secondary-text mb-1">미확정 결제</p>
          <p className="text-2xl font-bold text-primary-text">{stats.pendingPayments.formatted}</p>
          <p className="text-xs text-secondary-text mt-2">PAYMENT_STATUS != CONFIRMED</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-content-bg rounded-card border border-gray-200 p-6">
          <h2 className="font-semibold text-primary-text mb-4">일별 결제완료 주문</h2>
          <div className="space-y-3">
            {stats.dailyRevenue.length === 0 && <Body className="text-secondary-text">데이터 없음</Body>}
            {stats.dailyRevenue.map((daily) => {
              const barWidth = Math.max(10, (daily.orderCount / maxRevenueDay) * 100);
              return (
                <div key={daily.date}>
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="font-medium text-primary-text text-sm">{daily.date}</p>
                      <p className="text-xs text-secondary-text">{daily.orderCount}건 주문</p>
                    </div>
                    <p className="text-sm font-semibold text-primary-text">{formatKRW(daily.revenue)}</p>
                  </div>
                  <div className="w-full h-2 bg-gray-100/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-hot-pink to-[#FF6BA0] rounded-full"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-content-bg rounded-card border border-gray-200 p-6">
          <h2 className="font-semibold text-primary-text mb-4">옵션별 판매현황 (결제완료)</h2>
          <div className="space-y-3">
            {optionSales.length === 0 && <Body className="text-secondary-text">데이터 없음</Body>}
            {optionSales.map((item) => {
              const barWidth = Math.max(10, (item.sales / maxOptionSales) * 100);
              return (
                <div key={item.option} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-primary-text truncate">{item.option}</span>
                      <span className="text-sm font-semibold text-primary-text">{item.sales}개</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#B084CC] to-[#D4A5FF] rounded-full"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-content-bg rounded-card border border-gray-200 p-6">
        <h2 className="font-semibold text-primary-text mb-4">인기 상품 (결제완료 기준)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-secondary-text">
                <th className="py-2 pr-4">
                  <span className="flex items-center gap-1">
                    <Layers className="w-4 h-4" />
                    상품명
                  </span>
                </th>
                <th className="py-2 pr-4">판매수량</th>
              </tr>
            </thead>
            <tbody className="text-secondary-text">
              {topProducts.length === 0 && (
                <tr>
                  <td className="py-4" colSpan={2}>
                    데이터 없음
                  </td>
                </tr>
              )}
              {topProducts.map((product) => (
                <tr key={product.productId} className="border-t border-white/10">
                  <td className="py-3 pr-4 text-primary-text">{product.productName || '-'}</td>
                  <td className="py-3 pr-4 font-semibold text-primary-text">{product.totalSold}개</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
