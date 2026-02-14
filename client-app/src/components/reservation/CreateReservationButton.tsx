'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createReservation } from '@/lib/api/reservations';
import { CreateReservationDto } from '@/lib/types/reservation';
import { useToast } from '@/components/common/Toast';

interface CreateReservationButtonProps {
  productId: string;
  productName: string;
  quantity?: number;
  className?: string;
}

export function CreateReservationButton({
  productId,
  productName,
  quantity = 1,
  className = '',
}: CreateReservationButtonProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateReservation = async () => {
    try {
      setIsCreating(true);
      setError(null);

      const data: CreateReservationDto = {
        productId,
        quantity,
      };

      const reservation = await createReservation(data);

      // Show success message
      showToast(`예약이 완료되었습니다! 예약 번호: #${reservation.reservationNumber}`, 'success');

      // Redirect to reservations page
      router.push('/my-page/reservations');
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        '예약 생성에 실패했습니다.';
      setError(errorMessage);
      showToast(`예약 실패: ${errorMessage}`, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleCreateReservation}
        disabled={isCreating}
        className={`
          w-full px-6 py-3 rounded-lg font-medium text-white
          bg-gradient-to-r from-orange-500 to-red-500
          hover:from-orange-600 hover:to-red-600
          disabled:from-content-bg disabled:to-content-bg
          disabled:cursor-not-allowed
          transition-all duration-200
          shadow-md hover:shadow-lg
          ${className}
        `}
      >
        {isCreating ? (
          <span className="flex items-center justify-center">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            예약 생성 중...
          </span>
        ) : (
          '🔔 재입고 알림 예약하기'
        )}
      </button>

      {error && (
        <p className="mt-2 text-sm text-error text-center">{error}</p>
      )}

      <p className="mt-3 text-xs text-secondary-text text-center">
        재고가 확보되면 순서대로 구매 기회를 드립니다
      </p>
    </div>
  );
}
