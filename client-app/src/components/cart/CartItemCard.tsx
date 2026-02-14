'use client';

import { Heading2, Body, Caption } from '@/components/common/Typography';
import CartTimer from '@/components/cart/CartTimer';
import { Trash2, Plus, Minus } from 'lucide-react';
import { formatPrice } from '@/lib/utils/format';

interface CartItemCardProps {
  item: {
    id: string;
    productName: string;
    color?: string;
    size?: string;
    price: number;
    shippingFee: number;
    quantity: number;
    timerEnabled: boolean;
    expiresAt?: string;
    status: 'ACTIVE' | 'EXPIRED' | 'COMPLETED';
    total: number;
  };
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  onTimerExpired: () => void;
}

export function CartItemCard({
  item,
  onUpdateQuantity,
  onRemove,
  onTimerExpired,
}: CartItemCardProps) {
  const isExpired = item.status === 'EXPIRED';

  return (
    <div
      className={`bg-content-bg rounded-xl p-4 border ${
        isExpired ? 'border-error opacity-60' : 'border-border-color'
      }`}
    >
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <Heading2 className="text-primary-text mb-1">{item.productName}</Heading2>
              {(item.color || item.size) && (
                <Caption className="text-secondary-text">
                  {item.color && `색상: ${item.color}`}
                  {item.color && item.size && ' · '}
                  {item.size && `사이즈: ${item.size}`}
                </Caption>
              )}
            </div>
            {item.timerEnabled && item.expiresAt && item.status === 'ACTIVE' && (
              <CartTimer expiresAt={item.expiresAt} onExpired={onTimerExpired} />
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Body className="text-hot-pink font-bold text-lg">{formatPrice(item.price)}</Body>
              {item.shippingFee > 0 && (
                <Caption className="text-secondary-text">배송비: {formatPrice(item.shippingFee)}</Caption>
              )}
            </div>

            {item.status === 'ACTIVE' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                  disabled={item.quantity <= 1}
                  className="p-2 bg-content-bg rounded-lg hover:bg-content-bg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus className="w-4 h-4 text-primary-text" />
                </button>
                <span className="text-primary-text font-bold min-w-[40px] text-center">
                  {item.quantity}
                </span>
                <button
                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                  disabled={item.quantity >= 10}
                  className="p-2 bg-content-bg rounded-lg hover:bg-content-bg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-4 h-4 text-primary-text" />
                </button>
                <button
                  onClick={() => onRemove(item.id)}
                  className="p-2 bg-error/20 rounded-lg hover:bg-error/30 transition-colors ml-2"
                >
                  <Trash2 className="w-4 h-4 text-error" />
                </button>
              </div>
            )}

            {isExpired && <div className="text-error font-bold">예약 만료</div>}
          </div>

          <div className="mt-2 pt-2 border-t border-border-color">
            <div className="flex justify-between">
              <Caption className="text-secondary-text">소계</Caption>
              <Body className="text-primary-text font-bold">{formatPrice(item.total)}</Body>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
