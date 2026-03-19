'use client';

import { ChevronDown } from 'lucide-react';
import { Body } from '@/components/common/Typography';

interface OrderItem {
  productName: string;
  price: string;
  quantity: number;
  color?: string | null;
  size?: string | null;
}

interface OrderListItem {
  id: string;
  userId: string;
  userEmail: string;
  depositorName: string;
  instagramId: string;
  status: 'PENDING_PAYMENT' | 'PAYMENT_CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  createdAt: string;
  paidAt: string | null;
  items?: OrderItem[];
}

const ORDER_STATUS_LABELS = {
  PENDING_PAYMENT: '입금 대기',
  PAYMENT_CONFIRMED: '입금 완료',
  SHIPPED: '배송중',
  DELIVERED: '배송 완료',
  CANCELLED: '취소',
} as const;

const ORDER_STATUS_UPDATE_OPTIONS = [
  { value: 'PENDING_PAYMENT', label: '입금 대기' },
  { value: 'PAYMENT_CONFIRMED', label: '입금 완료' },
  { value: 'CANCELLED', label: '취소' },
] as const;

const STATUS_BADGE_CLASSES: Record<string, string> = {
  PENDING_PAYMENT: 'bg-warning/20 text-warning',
  PAYMENT_CONFIRMED: 'bg-success/20 text-success',
  SHIPPED: 'bg-blue-500/20 text-blue-400',
  DELIVERED: 'bg-green-600/20 text-green-400',
  CANCELLED: 'bg-error/20 text-error',
};

interface OrderMobileCardProps {
  order: OrderListItem;
  isUpdating: boolean;
  isSelectionMode: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  onCardClick: () => void;
  onToggleExpand: () => void;
  onStatusChange: (order: OrderListItem, status: OrderListItem['status']) => void;
  onSelectionToggle: () => void;
  formatDate: (date: string | null) => string;
  collectProductSummary: (items?: OrderItem[]) => string;
}

const formatPrice = (price: string | number) => {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

export function OrderMobileCard({
  order,
  isUpdating,
  isSelectionMode,
  isSelected,
  isExpanded,
  onCardClick,
  onToggleExpand,
  onStatusChange,
  onSelectionToggle,
  formatDate,
  collectProductSummary,
}: OrderMobileCardProps) {
  const statusBadgeClasses = STATUS_BADGE_CLASSES[order.status] ?? 'bg-gray-500/20 text-gray-400';
  const statusLabel = ORDER_STATUS_LABELS[order.status] ?? order.status;

  return (
    <div
      className={`bg-content-bg rounded-xl border p-4 space-y-3 transition-colors ${
        isSelected ? 'border-hot-pink' : 'border-border-color'
      } ${order.status === 'PENDING_PAYMENT' ? 'border-l-4 border-l-warning' : ''}`}
    >
      <div className="flex items-start gap-3">
        {isSelectionMode && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectionToggle();
            }}
            className="mt-0.5 w-5 h-5 rounded border-2 border-border-color flex-shrink-0 flex items-center justify-center"
            style={isSelected ? { background: '#FF1493', borderColor: '#FF1493' } : {}}
          >
            {isSelected && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 6l3 3 5-5"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <button
              type="button"
              onClick={onCardClick}
              className="font-mono text-xs text-secondary-text text-left truncate"
            >
              {order.id}
            </button>
            <span className="text-xs text-secondary-text whitespace-nowrap flex-shrink-0">
              {formatDate(order.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Product summary + expand toggle */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={onCardClick} className="flex-1 text-left min-w-0">
          <Body className="text-sm text-primary-text truncate block">
            {collectProductSummary(order.items)}
          </Body>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="flex-shrink-0 p-1 rounded hover:bg-white/5 transition-colors"
          aria-label={isExpanded ? '접기' : '펼치기'}
        >
          <ChevronDown
            className={`w-4 h-4 text-secondary-text transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Accordion expanded content */}
      {isExpanded && order.items && order.items.length > 0 && (
        <div className="pt-2 border-t border-border-color space-y-2">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-start text-xs">
              <div className="flex-1 min-w-0">
                <span className="text-primary-text">{item.productName}</span>
                {(item.color || item.size) && (
                  <span className="text-secondary-text ml-1">
                    ({[item.color, item.size].filter(Boolean).join(' / ')})
                  </span>
                )}
                <span className="text-secondary-text ml-1">×{item.quantity}</span>
              </div>
              <span className="text-primary-text font-medium flex-shrink-0 ml-2">
                {formatPrice(Number(item.price) * item.quantity)}
              </span>
            </div>
          ))}
          <div className="pt-2 border-t border-border-color/50 space-y-1 text-xs">
            {order.depositorName && (
              <div className="flex justify-between">
                <span className="text-secondary-text">입금자명</span>
                <span className="text-primary-text">{order.depositorName}</span>
              </div>
            )}
            {order.instagramId && (
              <div className="flex justify-between">
                <span className="text-secondary-text">인스타</span>
                <span className="text-primary-text">@{order.instagramId}</span>
              </div>
            )}
            {order.paidAt && (
              <div className="flex justify-between">
                <span className="text-secondary-text">결제일시</span>
                <span className="text-primary-text">{formatDate(order.paidAt)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <span className="text-xs text-secondary-text">
          {order.instagramId ? `@${order.instagramId}` : ''}
        </span>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadgeClasses}`}>
          {statusLabel}
        </span>
      </div>

      <div className="flex gap-2 pt-2 border-t border-border-color">
        {ORDER_STATUS_UPDATE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange(order, option.value);
            }}
            disabled={isUpdating}
            className={`flex-1 min-h-[44px] px-2 py-2 text-xs rounded border transition-colors ${
              order.status === option.value
                ? 'bg-hot-pink text-white border-hot-pink'
                : 'bg-transparent text-secondary-text border-border-color hover:bg-white/5'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
