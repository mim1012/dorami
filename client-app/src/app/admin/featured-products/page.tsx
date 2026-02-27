'use client';

import { Sparkles } from 'lucide-react';
import { Display, Body } from '@/components/common/Typography';

export default function AdminFeaturedProductsPage() {
  return (
    <div className="space-y-6">
      <div className="mb-8">
        <Display className="text-hot-pink mb-2 flex items-center gap-3">
          <Sparkles className="w-8 h-8" />홈 특가 상품
        </Display>
        <Body className="text-secondary-text">홈화면에 표시될 특가 상품을 관리합니다</Body>
      </div>

      <div className="bg-content-bg rounded-button p-12 text-center">
        <div className="w-16 h-16 mb-4 rounded-xl bg-hot-pink/10 flex items-center justify-center mx-auto">
          <Sparkles className="w-8 h-8 text-hot-pink" />
        </div>
        <h2 className="text-xl font-semibold text-secondary-text mb-2">준비 중입니다</h2>
        <Body className="text-secondary-text">홈 특가 상품 관리 기능은 곧 제공됩니다</Body>
      </div>
    </div>
  );
}
