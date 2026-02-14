'use client';

import Link from 'next/link';
import { usePointBalance } from '@/lib/hooks/queries/use-points';
import { Body, Heading2 } from '@/components/common/Typography';
import { Coins, ChevronRight } from 'lucide-react';

function formatPoints(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value);
}

export function PointsBalanceCard() {
  const { data: balance, isLoading, error } = usePointBalance();

  if (isLoading) {
    return (
      <div className="bg-content-bg shadow-sm rounded-2xl p-6 border border-border-color mb-6 animate-pulse">
        <div className="h-6 bg-border-color rounded w-32 mb-4" />
        <div className="h-10 bg-border-color rounded w-48" />
      </div>
    );
  }

  if (error || !balance) {
    return null;
  }

  return (
    <div className="bg-content-bg shadow-sm rounded-2xl p-6 border border-border-color mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-hot-pink" />
          <Heading2 className="text-hot-pink">내 포인트</Heading2>
        </div>
        <Link
          href="/my-page/points"
          className="flex items-center gap-1 text-hot-pink text-sm hover:underline"
        >
          <span>포인트 내역</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="text-center py-2">
        <p className="text-4xl font-bold text-hot-pink">
          {formatPoints(balance.currentBalance)} <span className="text-xl">P</span>
        </p>
      </div>

      <div className="h-px bg-border-color my-4" />

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <Body className="text-secondary-text text-xs">누적 적립</Body>
          <Body className="text-primary-text font-medium text-sm">
            {formatPoints(balance.lifetimeEarned)} P
          </Body>
        </div>
        <div>
          <Body className="text-secondary-text text-xs">누적 사용</Body>
          <Body className="text-primary-text font-medium text-sm">
            {formatPoints(balance.lifetimeUsed)} P
          </Body>
        </div>
        <div>
          <Body className="text-secondary-text text-xs">만료</Body>
          <Body className="text-primary-text font-medium text-sm">
            {formatPoints(balance.lifetimeExpired)} P
          </Body>
        </div>
      </div>
    </div>
  );
}
