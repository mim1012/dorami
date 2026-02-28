'use client';

import { TrendingUp, Radio, Package, Users } from 'lucide-react';

const liveSessionRevenue = [
  { session: '봄 컬렉션 런칭', date: '2025-02-27', revenue: 2847000, orders: 47 },
  { session: '주말 플래시 세일', date: '2025-02-26', revenue: 3215000, orders: 58 },
  { session: '신상품 쇼케이스', date: '2025-02-25', revenue: 1876000, orders: 34 },
  { session: '겨울 클리어런스', date: '2025-02-24', revenue: 4123000, orders: 72 },
];

const topProducts = [
  { name: '울 블렌드 롱 코트', sales: 142, revenue: 13916000 },
  { name: '캐시미어 터틀넥', sales: 98, revenue: 6762000 },
  { name: '슬림핏 슬랙스', sales: 87, revenue: 4263000 },
  { name: '핑크 스프링 드레스', sales: 76, revenue: 5168000 },
  { name: '라벤더 니트', sales: 64, revenue: 4992000 },
];

const optionSales = [
  { option: 'M / 베이지', sales: 234 },
  { option: 'L / 블랙', sales: 187 },
  { option: 'S / 화이트', sales: 156 },
  { option: 'M / 핑크', sales: 142 },
  { option: 'L / 베이지', sales: 128 },
];

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary-text">분석</h1>
        <p className="text-sm text-secondary-text mt-1">성과 지표 및 인사이트</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-content-bg rounded-card border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-hot-pink/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-hot-pink" />
            </div>
          </div>
          <p className="text-sm text-secondary-text mb-1">총 매출</p>
          <p className="text-2xl font-bold text-primary-text">₩12,061,000</p>
          <p className="text-xs text-success font-medium mt-2">지난주 대비 +18.2%</p>
        </div>

        <div className="bg-content-bg rounded-card border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Radio className="w-5 h-5 text-purple-400" />
            </div>
          </div>
          <p className="text-sm text-secondary-text mb-1">라이브 세션</p>
          <p className="text-2xl font-bold text-primary-text">12회</p>
          <p className="text-xs text-success font-medium mt-2">지난주 대비 +3</p>
        </div>

        <div className="bg-content-bg rounded-card border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-info" />
            </div>
          </div>
          <p className="text-sm text-secondary-text mb-1">총 주문</p>
          <p className="text-2xl font-bold text-primary-text">211건</p>
          <p className="text-xs text-success font-medium mt-2">지난주 대비 +12.5%</p>
        </div>

        <div className="bg-content-bg rounded-card border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-success" />
            </div>
          </div>
          <p className="text-sm text-secondary-text mb-1">전환율</p>
          <p className="text-2xl font-bold text-primary-text">8.4%</p>
          <p className="text-xs text-success font-medium mt-2">지난주 대비 +1.2%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-content-bg rounded-card border border-gray-200 p-6">
          <h2 className="font-semibold text-primary-text mb-4">라이브 세션별 매출</h2>
          <div className="space-y-3">
            {liveSessionRevenue.map((session) => (
              <div
                key={session.session}
                className="pb-3 border-b border-white/10 last:border-0 last:pb-0"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-medium text-primary-text text-sm">{session.session}</p>
                    <p className="text-xs text-secondary-text mt-0.5">{session.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary-text">
                      ₩{session.revenue.toLocaleString()}
                    </p>
                    <p className="text-xs text-secondary-text mt-0.5">{session.orders}건 주문</p>
                  </div>
                </div>
                <div className="w-full h-2 bg-gray-100/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-hot-pink to-[#FF6BA0] rounded-full"
                    style={{ width: `${(session.revenue / 5000000) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-content-bg rounded-card border border-gray-200 p-6">
          <h2 className="font-semibold text-primary-text mb-4">인기 상품</h2>
          <div className="space-y-3">
            {topProducts.map((product, index) => (
              <div
                key={product.name}
                className="pb-3 border-b border-white/10 last:border-0 last:pb-0"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-hot-pink to-[#B084CC] flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">{index + 1}</span>
                    </div>
                    <p className="font-medium text-primary-text text-sm">{product.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary-text text-sm">
                      ₩{product.revenue.toLocaleString()}
                    </p>
                    <p className="text-xs text-secondary-text">{product.sales}개 판매</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-content-bg rounded-card border border-gray-200 p-6">
          <h2 className="font-semibold text-primary-text mb-4">옵션별 판매 현황</h2>
          <div className="space-y-3">
            {optionSales.map((item) => (
              <div key={item.option} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-primary-text">{item.option}</span>
                    <span className="text-sm font-semibold text-primary-text">{item.sales}개</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#B084CC] to-[#D4A5FF] rounded-full"
                      style={{ width: `${(item.sales / 250) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-content-bg rounded-card border border-gray-200 p-6">
          <h2 className="font-semibold text-primary-text mb-4">전환율 지표</h2>
          <div className="space-y-4">
            <div className="p-4 bg-white/5 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-secondary-text">라이브 시청자</span>
                <span className="text-lg font-bold text-primary-text">2,547명</span>
              </div>
              <div className="text-xs text-secondary-text">세션당 평균: 212명</div>
            </div>

            <div className="p-4 bg-white/5 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-secondary-text">장바구니 추가</span>
                <span className="text-lg font-bold text-primary-text">314건</span>
              </div>
              <div className="text-xs text-secondary-text">시청자의 12.3%</div>
            </div>

            <div className="p-4 bg-hot-pink/10 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-hot-pink font-medium">구매 완료</span>
                <span className="text-lg font-bold text-hot-pink">211건</span>
              </div>
              <div className="text-xs text-hot-pink">전환율 8.4%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
