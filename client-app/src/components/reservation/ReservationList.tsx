'use client';

import { useCallback } from 'react';
import { useReservations, useCancelReservation } from '@/lib/hooks/queries/use-reservations';
import { ReservationCard } from './ReservationCard';

export function ReservationList() {
  const { data: reservations, isLoading, error } = useReservations();
  const cancelMutation = useCancelReservation();

  const cancelReservation = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await cancelMutation.mutateAsync(id);
        return true;
      } catch {
        return false;
      }
    },
    [cancelMutation],
  );

  if (isLoading && !reservations) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-info"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error-bg border border-error/20 rounded-lg p-6">
        <p className="text-error font-medium">오류가 발생했습니다</p>
        <p className="text-error text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  if (!reservations || reservations.reservations.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
        <p className="text-gray-600 text-lg">예약 내역이 없습니다.</p>
        <p className="text-gray-500 text-sm mt-2">품절 상품 페이지에서 예약할 수 있습니다.</p>
      </div>
    );
  }

  const activeReservations = reservations.reservations.filter(
    (r) => r.status === 'WAITING' || r.status === 'PROMOTED',
  );

  const inactiveReservations = reservations.reservations.filter(
    (r) => r.status !== 'WAITING' && r.status !== 'PROMOTED',
  );

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-info/20">
        <h2 className="text-xl font-bold text-gray-900 mb-4">예약 현황</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-info">{reservations.totalCount}</p>
            <p className="text-sm text-gray-600 mt-1">전체</p>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-warning">{reservations.waitingCount}</p>
            <p className="text-sm text-gray-600 mt-1">대기 중</p>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-success">{reservations.promotedCount}</p>
            <p className="text-sm text-gray-600 mt-1">구매 가능</p>
          </div>
        </div>
      </div>

      {/* Active Reservations */}
      {activeReservations.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            활성 예약 ({activeReservations.length})
          </h3>
          {activeReservations.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              onCancel={cancelReservation}
            />
          ))}
        </div>
      )}

      {/* Inactive Reservations */}
      {inactiveReservations.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-600 mb-4">
            완료/취소된 예약 ({inactiveReservations.length})
          </h3>
          {inactiveReservations.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              onCancel={cancelReservation}
            />
          ))}
        </div>
      )}
    </div>
  );
}
