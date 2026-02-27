'use client';

import { BarChart3 } from 'lucide-react';
import { Display, Body } from '@/components/common/Typography';

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="mb-8">
        <Display className="text-hot-pink mb-2 flex items-center gap-3">
          <BarChart3 className="w-8 h-8" />
          분석
        </Display>
        <Body className="text-secondary-text">판매 및 사용자 분석 데이터를 확인합니다</Body>
      </div>

      <div className="bg-content-bg rounded-button p-12 text-center">
        <div className="w-16 h-16 mb-4 rounded-xl bg-hot-pink/10 flex items-center justify-center mx-auto">
          <BarChart3 className="w-8 h-8 text-hot-pink" />
        </div>
        <h2 className="text-xl font-semibold text-secondary-text mb-2">준비 중입니다</h2>
        <Body className="text-secondary-text">분석 기능은 곧 제공됩니다</Body>
      </div>
    </div>
  );
}
