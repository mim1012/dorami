'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePointBalance, usePointHistory } from '@/lib/hooks/use-points';
import { Display, Heading2, Body, Caption } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { ArrowLeft, Coins, ChevronLeft, ChevronRight } from 'lucide-react';

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  EARNED_ORDER: '주문 적립',
  USED_ORDER: '주문 사용',
  REFUND_CANCELLED: '취소 환불',
  MANUAL_ADD: '관리자 추가',
  MANUAL_SUBTRACT: '관리자 차감',
  EXPIRED: '만료',
};

const TRANSACTION_TYPE_BADGE_COLORS: Record<string, string> = {
  EARNED_ORDER: 'bg-green-500/20 text-green-400 border-green-500/30',
  USED_ORDER: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  REFUND_CANCELLED: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  MANUAL_ADD: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  MANUAL_SUBTRACT: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  EXPIRED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const FILTER_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'EARNED_ORDER', label: '적립' },
  { value: 'USED_ORDER', label: '사용' },
  { value: 'REFUND_CANCELLED', label: '환불' },
  { value: 'MANUAL_ADD', label: '추가' },
  { value: 'MANUAL_SUBTRACT', label: '차감' },
  { value: 'EXPIRED', label: '만료' },
];

function formatPoints(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PointsHistoryPage() {
  const router = useRouter();
  const { balance, isLoading: balanceLoading } = usePointBalance();
  const [typeFilter, setTypeFilter] = useState('');
  const { data, isLoading: historyLoading, query, setQuery } = usePointHistory(undefined, {
    page: 1,
    limit: 20,
    transactionType: undefined,
  });

  const handleFilterChange = (type: string) => {
    setTypeFilter(type);
    setQuery((prev) => ({
      ...prev,
      page: 1,
      transactionType: type || undefined,
    }));
  };

  const handlePageChange = (newPage: number) => {
    setQuery((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <>
      <div className="min-h-screen bg-[#121212] py-12 px-4 pb-28">
        <div className="w-full md:max-w-4xl md:mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.back()}
              className="text-secondary-text hover:text-primary-text"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <Display className="text-hot-pink">포인트 내역</Display>
          </div>

          {/* Balance Summary */}
          {!balanceLoading && balance && (
            <div className="bg-content-bg rounded-2xl p-6 border border-white/5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Coins className="w-5 h-5 text-hot-pink" />
                <Heading2 className="text-hot-pink">보유 포인트</Heading2>
              </div>
              <div className="text-center py-2">
                <p className="text-4xl font-bold text-hot-pink">
                  {formatPoints(balance.currentBalance)} <span className="text-xl">P</span>
                </p>
              </div>
              <div className="h-px bg-white/10 my-4" />
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
          )}

          {/* Type Filter */}
          <div className="flex flex-wrap gap-2 mb-6">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleFilterChange(option.value)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  typeFilter === option.value
                    ? 'bg-hot-pink text-white border-hot-pink'
                    : 'bg-content-bg text-secondary-text border-white/10 hover:border-hot-pink/50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Transaction History */}
          {historyLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-content-bg rounded-2xl p-4 border border-white/5 animate-pulse">
                  <div className="h-4 bg-white/10 rounded w-24 mb-2" />
                  <div className="h-6 bg-white/10 rounded w-32" />
                </div>
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="bg-content-bg rounded-2xl p-8 border border-white/5 text-center">
              <Coins className="w-12 h-12 text-secondary-text mx-auto mb-3" />
              <Body className="text-secondary-text">포인트 내역이 없습니다</Body>
            </div>
          ) : (
            <>
              {/* Mobile: Card Layout */}
              <div className="space-y-3 md:hidden">
                {data.items.map((tx) => (
                  <div
                    key={tx.id}
                    className="bg-content-bg rounded-2xl p-4 border border-white/5"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs border ${
                          TRANSACTION_TYPE_BADGE_COLORS[tx.transactionType] || 'bg-gray-500/20 text-gray-400'
                        }`}
                      >
                        {TRANSACTION_TYPE_LABELS[tx.transactionType] || tx.transactionType}
                      </span>
                      <Caption className="text-secondary-text">
                        {formatDate(tx.createdAt)}
                      </Caption>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        {tx.orderId && (
                          <Caption className="text-secondary-text">
                            주문: {tx.orderId}
                          </Caption>
                        )}
                        {tx.reason && (
                          <Caption className="text-secondary-text">{tx.reason}</Caption>
                        )}
                      </div>
                      <p
                        className={`text-lg font-bold ${
                          tx.amount > 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {tx.amount > 0 ? '+' : ''}
                        {formatPoints(tx.amount)} P
                      </p>
                    </div>
                    <div className="mt-1 text-right">
                      <Caption className="text-secondary-text">
                        잔액: {formatPoints(tx.balanceAfter)} P
                      </Caption>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: Table Layout */}
              <div className="hidden md:block bg-content-bg rounded-2xl border border-white/5 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left p-4 text-secondary-text text-sm font-normal">일시</th>
                      <th className="text-left p-4 text-secondary-text text-sm font-normal">유형</th>
                      <th className="text-left p-4 text-secondary-text text-sm font-normal">내용</th>
                      <th className="text-right p-4 text-secondary-text text-sm font-normal">금액</th>
                      <th className="text-right p-4 text-secondary-text text-sm font-normal">잔액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((tx) => (
                      <tr key={tx.id} className="border-b border-white/5 last:border-b-0">
                        <td className="p-4">
                          <Caption className="text-primary-text">
                            {formatDate(tx.createdAt)}
                          </Caption>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs border ${
                              TRANSACTION_TYPE_BADGE_COLORS[tx.transactionType] || 'bg-gray-500/20 text-gray-400'
                            }`}
                          >
                            {TRANSACTION_TYPE_LABELS[tx.transactionType] || tx.transactionType}
                          </span>
                        </td>
                        <td className="p-4">
                          <Caption className="text-secondary-text">
                            {tx.orderId && `주문: ${tx.orderId}`}
                            {tx.reason && tx.reason}
                          </Caption>
                        </td>
                        <td className="p-4 text-right">
                          <span
                            className={`font-bold ${
                              tx.amount > 0 ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {tx.amount > 0 ? '+' : ''}
                            {formatPoints(tx.amount)} P
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <Caption className="text-secondary-text">
                            {formatPoints(tx.balanceAfter)} P
                          </Caption>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data.pagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-6">
                  <button
                    onClick={() => handlePageChange(data.pagination.page - 1)}
                    disabled={data.pagination.page <= 1}
                    className="p-2 rounded-lg bg-content-bg border border-white/10 text-secondary-text disabled:opacity-30 hover:border-hot-pink/50"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <Body className="text-primary-text">
                    {data.pagination.page} / {data.pagination.totalPages}
                  </Body>
                  <button
                    onClick={() => handlePageChange(data.pagination.page + 1)}
                    disabled={data.pagination.page >= data.pagination.totalPages}
                    className="p-2 rounded-lg bg-content-bg border border-white/10 text-secondary-text disabled:opacity-30 hover:border-hot-pink/50"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <BottomTabBar />
    </>
  );
}
