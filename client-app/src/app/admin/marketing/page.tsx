'use client';

import { Megaphone } from 'lucide-react';
import { Display, Body } from '@/components/common/Typography';

export default function AdminMarketingPage() {
  return (
    <div className="space-y-6">
      <div className="mb-8">
        <Display className="text-hot-pink mb-2 flex items-center gap-3">
          <Megaphone className="w-8 h-8" />
          마케팅
        </Display>
        <Body className="text-secondary-text">마케팅 캠페인 및 프로모션을 관리합니다</Body>
      </div>

      <div className="bg-content-bg rounded-button p-12 text-center">
        <div className="w-16 h-16 mb-4 rounded-xl bg-hot-pink/10 flex items-center justify-center mx-auto">
          <Megaphone className="w-8 h-8 text-hot-pink" />
        </div>
        <h2 className="text-xl font-semibold text-secondary-text mb-2">준비 중입니다</h2>
        <Body className="text-secondary-text">마케팅 기능은 곧 제공됩니다</Body>
      </div>
    </div>
  );
}
