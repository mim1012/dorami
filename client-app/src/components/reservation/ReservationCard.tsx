'use client';

import { useState, useEffect } from 'react';
import { Reservation } from '@/lib/types/reservation';
import { useConfirm } from '@/components/common/ConfirmDialog';

interface ReservationCardProps {
  reservation: Reservation;
  onCancel: (id: string) => Promise<boolean>;
}

export function ReservationCard({ reservation, onCancel }: ReservationCardProps) {
  const confirm = useConfirm();
  const [remainingSeconds, setRemainingSeconds] = useState(
    reservation.remainingSeconds || 0
  );
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (reservation.status !== 'PROMOTED' || !reservation.expiresAt) {
      return;
    }

    const timer = setInterval(() => {
      const expiresAt = new Date(reservation.expiresAt!);
      const now = new Date();
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      setRemainingSeconds(diff);

      if (diff === 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [reservation.expiresAt, reservation.status]);

  const handleCancel = async () => {
    const confirmed = await confirm({
      title: '예약 취소',
      message: '예약을 취소하시겠습니까?',
      confirmText: '취소',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }

    setIsCancelling(true);
    const success = await onCancel(reservation.id);
    if (!success) {
      setIsCancelling(false);
    }
  };

  const getStatusBadge = () => {
    switch (reservation.status) {
      case 'WAITING':
        return (
          <span className="px-3 py-1 bg-info/10 text-info rounded-full text-sm font-medium">
            대기 중
          </span>
        );
      case 'PROMOTED':
        return (
          <span className="px-3 py-1 bg-success/10 text-success rounded-full text-sm font-medium">
            구매 가능
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
            만료됨
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-3 py-1 bg-error/10 text-error rounded-full text-sm font-medium">
            취소됨
          </span>
        );
      default:
        return null;
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-4 border border-gray-200">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {reservation.productName}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            예약 번호: #{reservation.reservationNumber}
          </p>
          <p className="text-sm text-gray-600">
            수량: {reservation.quantity}개
          </p>
        </div>
        {getStatusBadge()}
      </div>

      {reservation.status === 'WAITING' && reservation.queuePosition && (
        <div className="bg-info-bg rounded-lg p-4 mb-4">
          <p className="text-sm text-primary-text font-medium">
            대기 순번: {reservation.queuePosition}번째
          </p>
          <p className="text-xs text-info mt-1">
            재고가 확보되면 순서대로 구매 기회가 제공됩니다.
          </p>
        </div>
      )}

      {reservation.status === 'PROMOTED' && remainingSeconds > 0 && (
        <div className="bg-success-bg rounded-lg p-4 mb-4">
          <p className="text-sm text-primary-text font-medium mb-2">
            🎉 구매 가능 시간이 시작되었습니다!
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-success">남은 시간:</span>
            <span className="text-2xl font-bold text-primary-text">
              {formatTime(remainingSeconds)}
            </span>
          </div>
          <p className="text-xs text-success mt-2">
            시간 내에 장바구니에 담아주세요.
          </p>
        </div>
      )}

      {reservation.status === 'PROMOTED' && remainingSeconds === 0 && (
        <div className="bg-error-bg rounded-lg p-4 mb-4">
          <p className="text-sm text-primary-text font-medium">
            구매 시간이 만료되었습니다.
          </p>
          <p className="text-xs text-error mt-1">
            다음 대기자에게 순서가 넘어갔습니다.
          </p>
        </div>
      )}

      {(reservation.status === 'WAITING' || reservation.status === 'PROMOTED') && (
        <div className="flex justify-end mt-4">
          <button
            onClick={handleCancel}
            disabled={isCancelling}
            className="px-4 py-2 bg-error text-white rounded-lg hover:bg-error/80 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {isCancelling ? '취소 중...' : '예약 취소'}
          </button>
        </div>
      )}

      <div className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-200">
        예약 일시: {new Date(reservation.createdAt).toLocaleString('ko-KR')}
      </div>
    </div>
  );
}
