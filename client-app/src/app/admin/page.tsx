'use client';

import { DollarSign, Eye, TrendingUp, ShoppingBag } from 'lucide-react';
import StatCard from '@/components/admin/dashboard/StatCard';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';

interface DashboardStats {
  revenue: { value: number; formatted: string; trend: string; trendUp: boolean };
  viewers: { value: number; formatted: string; trend: string; trendUp: boolean };
  orders: { value: number; formatted: string; trend: string; trendUp: boolean };
}

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Use mock data for demo
        const mockStats: DashboardStats = {
          revenue: {
            value: 12500000,
            formatted: '12,500,000원',
            trend: '+12.5%',
            trendUp: true,
          },
          viewers: {
            value: 8432,
            formatted: '8,432명',
            trend: '+23.1%',
            trendUp: true,
          },
          orders: {
            value: 342,
            formatted: '342건',
            trend: '+8.3%',
            trendUp: true,
          },
        };
        setStats(mockStats);
      } catch (error: any) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-secondary-text">대시보드 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary-text mb-2">
            반갑습니다, <span className="text-hot-pink">관리자님</span> 👋
          </h1>
          <p className="text-sm md:text-base text-secondary-text">오늘의 스토어 현황을 확인하세요.</p>
        </div>
        <div className="flex gap-2 md:gap-3">
          <button className="flex-1 md:flex-none px-3 md:px-4 py-2 bg-content-bg border border-gray-300 rounded-lg text-xs md:text-sm font-medium text-primary-text hover:bg-gray-100 transition-colors">
            리포트 다운로드
          </button>
          <button className="flex-1 md:flex-none px-3 md:px-4 py-2 bg-hot-pink hover:bg-hot-pink/90 text-white rounded-lg text-xs md:text-sm font-medium shadow-[0_0_15px_rgba(255,0,122,0.4)] transition-all">
            방송 시작하기
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="총 매출"
          value={stats?.revenue.formatted || '$0'}
          trend={stats?.revenue.trend || '+0%'}
          trendUp={stats?.revenue.trendUp ?? true}
          icon={DollarSign}
          color="pink"
        />
        <StatCard
          title="실시간 시청자"
          value={stats?.viewers.formatted || '0'}
          trend={stats?.viewers.trend || '+0%'}
          trendUp={stats?.viewers.trendUp ?? true}
          icon={Eye}
          color="blue"
        />
        <StatCard
          title="신규 주문"
          value={stats?.orders.formatted || '0'}
          trend={stats?.orders.trend || '+0%'}
          trendUp={stats?.orders.trendUp ?? true}
          icon={ShoppingBag}
          color="orange"
        />
      </div>

      {/* Chart Area */}
      <div className="bg-content-bg border border-gray-200 rounded-card p-6 min-h-[570px]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-primary-text">매출 현황</h3>
          <select className="bg-white border border-gray-300 rounded-lg text-sm text-primary-text px-3 py-1 focus:outline-none">
            <option>이번 주</option>
            <option>이번 달</option>
            <option>올해</option>
          </select>
        </div>
        <div className="w-full h-[460px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
          <div className="text-center text-secondary-text">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-lg">차트 컴포넌트 시각화 영역</p>
            <p className="text-sm mt-2 opacity-70">(Revenue Chart / Analytics Placeholder)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
