'use client';

import { OrderStatus } from '@live-commerce/shared-types';

interface OrderRow {
  id: string;
  customerName: string;
  productName: string;
  amount: string;
  status: OrderStatus;
  createdAt: string;
}

interface OrderTableProps {
  orders: OrderRow[];
  onViewOrder?: (orderId: string) => void;
}

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  [OrderStatus.PENDING_PAYMENT]: {
    label: '결제 대기',
    className: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  },
  [OrderStatus.PAYMENT_CONFIRMED]: {
    label: '결제 확인',
    className: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
  [OrderStatus.SHIPPED]: {
    label: '배송 중',
    className: 'bg-purple-50 text-purple-700 border border-purple-200',
  },
  [OrderStatus.DELIVERED]: {
    label: '배송 완료',
    className: 'bg-green-50 text-green-700 border border-green-200',
  },
  [OrderStatus.CANCELLED]: {
    label: '취소',
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
  },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function OrderTable({ orders, onViewOrder }: OrderTableProps) {
  if (orders.length === 0) {
    return <div className="text-center py-12 text-gray-400 text-sm">주문이 없습니다.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              주문번호
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              고객
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">
              상품
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              금액
            </th>
            <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              상태
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">
              일시
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {orders.map((order) => {
            const status = statusConfig[order.status] ?? {
              label: order.status,
              className: 'bg-gray-100 text-gray-600',
            };
            return (
              <tr
                key={order.id}
                className={`hover:bg-gray-50 transition-colors ${onViewOrder ? 'cursor-pointer' : ''}`}
                onClick={() => onViewOrder?.(order.id)}
              >
                <td className="py-3.5 px-4 font-mono text-xs text-gray-700">{order.id}</td>
                <td className="py-3.5 px-4 font-medium text-gray-900">{order.customerName}</td>
                <td className="py-3.5 px-4 text-gray-600 hidden md:table-cell max-w-[200px] truncate">
                  {order.productName}
                </td>
                <td className="py-3.5 px-4 text-right font-semibold text-gray-900">
                  {order.amount}
                </td>
                <td className="py-3.5 px-4 text-center">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.className}`}
                  >
                    {status.label}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-right text-gray-400 text-xs hidden sm:table-cell">
                  {formatDate(order.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default OrderTable;
