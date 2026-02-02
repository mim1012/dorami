'use client';

import { ReservationList } from '@/components/reservation';

export default function ReservationsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">예약 관리</h1>
          <p className="text-gray-600">
            품절 상품에 대한 예약 현황을 확인하고 관리할 수 있습니다.
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">💡 예약 시스템 안내</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 품절된 상품에 대해 예약을 신청할 수 있습니다.</li>
            <li>• 재고가 확보되면 예약 순서대로 구매 기회가 제공됩니다.</li>
            <li>• 구매 가능 알림을 받으면 10분 내에 장바구니에 담아주세요.</li>
            <li>• 시간 내에 구매하지 않으면 다음 대기자에게 순서가 넘어갑니다.</li>
          </ul>
        </div>

        {/* Reservation List */}
        <ReservationList />
      </div>
    </div>
  );
}
