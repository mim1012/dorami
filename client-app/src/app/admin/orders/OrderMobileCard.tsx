'use client';

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

/** Group items by productName for compact display */
function groupByProduct(items: OrderItem[]): { productName: string; options: OrderItem[] }[] {
  const map = new Map<string, OrderItem[]>();
  for (const item of items) {
    const existing = map.get(item.productName);
    if (existing) {
      existing.push(item);
    } else {
      map.set(item.productName, [item]);
    }
  }
  return Array.from(map.entries()).map(([productName, options]) => ({ productName, options }));
}

export function OrderMobileCard({
  order,
  isUpdating,
  isSelectionMode,
  isSelected,
  onCardClick,
  onStatusChange,
  onSelectionToggle,
  formatDate,
}: OrderMobileCardProps) {
  const statusBadgeClasses = STATUS_BADGE_CLASSES[order.status] ?? 'bg-gray-500/20 text-gray-400';
  const statusLabel = ORDER_STATUS_LABELS[order.status] ?? order.status;
  const items = order.items ?? [];
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
  const grouped = groupByProduct(items);

  return (
    <div
      className={`bg-content-bg rounded-xl border overflow-hidden transition-colors ${
        isSelected ? 'border-hot-pink' : 'border-border-color'
      } ${order.status === 'PENDING_PAYMENT' ? 'border-l-4 border-l-warning' : ''}`}
    >
      {/* Header: @instaID + date + status badge */}
      <button
        type="button"
        onClick={onCardClick}
        className="w-full p-3 pb-2 flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isSelectionMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectionToggle();
              }}
              className="w-5 h-5 rounded border-2 border-border-color flex-shrink-0 flex items-center justify-center"
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
          <span className="text-sm font-medium text-primary-text truncate">
            {order.instagramId ? `@${order.instagramId}` : order.depositorName || '고객'}
          </span>
          <span className="text-xs text-secondary-text whitespace-nowrap flex-shrink-0">
            {formatDate(order.createdAt)}
          </span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap flex-shrink-0 ${statusBadgeClasses}`}
        >
          {statusLabel}
        </span>
      </button>

      {/* Items: grouped by product, options inline */}
      {items.length > 0 && (
        <button type="button" onClick={onCardClick} className="w-full px-3 pb-2 text-left">
          <div className="border-t border-border-color/50 pt-2 space-y-1.5">
            {grouped.map((group) => (
              <div key={group.productName}>
                <Body className="text-xs font-semibold text-primary-text">{group.productName}</Body>
                {group.options.map((item, idx) => {
                  const optionLabel = [item.color, item.size].filter(Boolean).join(' / ');
                  return (
                    <div key={idx} className="flex justify-between items-center pl-2 text-xs">
                      <span className="text-secondary-text">
                        {optionLabel || '기본'}{' '}
                        <span className="text-primary-text">x{item.quantity}</span>
                      </span>
                      <span className="text-primary-text font-medium">
                        {formatPrice(Number(item.price) * item.quantity)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </button>
      )}

      {/* Footer: depositor + total */}
      <div className="px-3 py-2 border-t border-border-color/50 flex justify-between items-center">
        <span className="text-xs text-secondary-text">{order.depositorName || ''}</span>
        <div className="text-right">
          <span className="text-xs text-secondary-text mr-2">{totalQty}개</span>
          <span className="text-sm font-bold text-hot-pink">{formatPrice(totalAmount)}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-0 border-t border-border-color">
        {ORDER_STATUS_UPDATE_OPTIONS.map((option, idx) => (
          <button
            key={option.value}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange(order, option.value);
            }}
            disabled={isUpdating}
            className={`flex-1 min-h-[40px] px-2 py-2 text-xs font-medium transition-colors ${
              idx < ORDER_STATUS_UPDATE_OPTIONS.length - 1 ? 'border-r border-border-color' : ''
            } ${
              order.status === option.value
                ? 'bg-hot-pink text-white'
                : 'bg-transparent text-secondary-text hover:bg-white/5'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
