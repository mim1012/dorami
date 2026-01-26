'use client';

import { Users, DollarSign, MessageSquare, Eye, TrendingUp, ShoppingBag } from 'lucide-react';
import StatCard from '@/components/admin/dashboard/StatCard';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';

interface DashboardStats {
  revenue: { value: number; formatted: string; trend: string; trendUp: boolean };
  viewers: { value: number; formatted: string; trend: string; trendUp: boolean };
  orders: { value: number; formatted: string; trend: string; trendUp: boolean };
  messages: { value: number; formatted: string; trend: string; trendUp: boolean };
}

interface LiveStatus {
  isLive: boolean;
  streamId: string | null;
  title: string | null;
  duration: string | null;
  viewerCount: number;
  startedAt: string | null;
}

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, liveRes] = await Promise.all([
          apiClient.get<DashboardStats>('/admin/dashboard/stats'),
          apiClient.get<LiveStatus>('/streaming/live-status'),
        ]);

        setStats(statsRes.data);
        setLiveStatus(liveRes.data);
      } catch (error) {
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
        <div className="text-secondary-text">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            반갑습니다, <span className="text-hot-pink">관리자님</span> 👋
          </h1>
          <p className="text-secondary-text">오늘의 스토어 현황을 확인하세요.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-content-bg border border-white/10 rounded-lg text-sm font-medium text-white hover:bg-white/5 transition-colors">
            리포트 다운로드
          </button>
          <button className="px-4 py-2 bg-hot-pink hover:bg-hot-pink/90 text-white rounded-lg text-sm font-medium shadow-[0_0_15px_rgba(255,0,122,0.4)] transition-all">
            방송 시작하기
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
        <StatCard
          title="채팅 메시지"
          value={stats?.messages.formatted || '0'}
          trend={stats?.messages.trend || '+0%'}
          trendUp={stats?.messages.trendUp ?? true}
          icon={MessageSquare}
          color="green"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Area (Placeholder for now) */}
        <div className="lg:col-span-2 bg-content-bg border border-white/5 rounded-card p-6 min-h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">매출 현황</h3>
            <select className="bg-primary-black border border-white/10 rounded-lg text-sm text-secondary-text px-3 py-1 focus:outline-none">
              <option>이번 주</option>
              <option>이번 달</option>
              <option>올해</option>
            </select>
          </div>
          <div className="w-full h-[300px] flex items-center justify-center border-2 border-dashed border-white/10 rounded-lg bg-primary-black/30">
            <div className="text-center text-secondary-text">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>차트 컴포넌트 시각화 영역</p>
            </div>
          </div>
        </div>

        {/* Recent Activity / Live Status */}
        <div className="bg-content-bg border border-white/5 rounded-card p-6">
          <h3 className="text-lg font-bold text-white mb-6">Live Status</h3>

          <div className="space-y-6">
            {liveStatus?.isLive ? (
              <div className="p-4 rounded-xl bg-primary-black/50 border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2 py-1 rounded text-xs font-bold bg-hot-pink text-white animate-pulse">LIVE</span>
                  <span className="text-xs text-secondary-text">{liveStatus.duration || '00:00:00'}</span>
                </div>
                <div className="aspect-video bg-gray-800 rounded-lg mb-3 relative overflow-hidden group">
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="px-4 py-2 bg-white text-black rounded-full text-sm font-bold">View Stream</button>
                  </div>
                </div>
                <p className="text-sm font-medium text-white truncate">{liveStatus.title || 'Live Stream'}</p>
                <p className="text-xs text-secondary-text mt-2">{liveStatus.viewerCount} 명 시청 중</p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-primary-black/50 border border-white/5 text-center">
                <p className="text-secondary-text">현재 진행 중인 방송이 없습니다</p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium text-secondary-text mb-4">Recent Actions</h4>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-secondary-text" />
                    </div>
                    <div>
                      <p className="text-sm text-white">New user registered</p>
                      <p className="text-xs text-secondary-text">2 minutes ago</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
