'use client';

import Image from 'next/image';
import { Heading2, Body, Caption } from '@/components/common/Typography';
import CartTimer from '@/components/cart/CartTimer';
import { Trash2, Plus, Minus, Package } from 'lucide-react';
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
    product?: {
      imageUrl?: string;
      status: 'AVAILABLE' | 'SOLD_OUT';
    };
  };
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  onTimerExpired: () => void;
  checked?: boolean;
  onCheckedChange?: (itemId: string, checked: boolean) => void;
}

export function CartItemCard({
  item,
  onUpdateQuantity,
  onRemove,
  onTimerExpired,
  checked = false,
  onCheckedChange,
}: CartItemCardProps) {
  const isExpired = item.status === 'EXPIRED';
  const isSoldOut = item.product?.status === 'SOLD_OUT';
  const isDisabled = isExpired || isSoldOut;

  return (
    <div
      className={`bg-content-bg rounded-xl p-4 border relative ${
        isExpired ? 'border-error' : isSoldOut ? 'border-warning' : 'border-border-color'
      }`}
    >
      {/* Expired / Sold-out overlay */}
      {isDisabled && (
        <div className="absolute inset-0 bg-black/40 rounded-xl pointer-events-none z-10" />
      )}

      <div className="flex gap-3">
        {/* Checkbox */}
        <div className="flex items-start pt-1 z-20">
          <input
            type="checkbox"
            checked={checked}
            disabled={isDisabled}
            onChange={(e) => onCheckedChange?.(item.id, e.target.checked)}
            className="w-5 h-5 rounded border-border-color accent-hot-pink cursor-pointer disabled:cursor-not-allowed"
            aria-label={`${item.productName} 선택`}
          />
        </div>

        {/* Product thumbnail */}
        <div className="flex-shrink-0 z-20">
          {item.product?.imageUrl ? (
            <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-border-color">
              <Image
                src={item.product.imageUrl}
                alt={item.productName}
                fill
                className={`object-cover ${isDisabled ? 'grayscale' : ''}`}
                sizes="56px"
              />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-lg bg-border-color/30 border border-border-color flex items-center justify-center">
              <Package className="w-6 h-6 text-secondary-text" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 z-20">
          <div className="flex items-start justify-between mb-1 gap-2">
            <div className="min-w-0">
              <Heading2
                className={`mb-0.5 truncate ${isDisabled ? 'text-secondary-text' : 'text-primary-text'}`}
              >
                {item.productName}
              </Heading2>
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

          {/* Expired label */}
          {isExpired && (
            <div className="mb-2">
              <span className="inline-block bg-error/20 text-error text-xs font-bold px-2 py-0.5 rounded">
                만료된 상품입니다
              </span>
            </div>
          )}

          {/* Sold-out label */}
          {isSoldOut && !isExpired && (
            <div className="mb-2">
              <span className="inline-block bg-warning/20 text-warning text-xs font-bold px-2 py-0.5 rounded">
                품절된 상품입니다
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Body
              className={`font-bold text-lg ${isDisabled ? 'text-secondary-text' : 'text-hot-pink'}`}
            >
              {formatPrice(item.price)}
            </Body>

            <div className="flex items-center gap-1">
              {item.status === 'ACTIVE' && !isSoldOut ? (
                <>
                  {/* Quantity controls */}
                  <div className="flex items-center border border-border-color rounded-lg overflow-hidden">
                    <button
                      onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-border-color/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="수량 감소"
                    >
                      <Minus className="w-4 h-4 text-primary-text" />
                    </button>
                    <span className="min-w-[36px] text-center text-primary-text font-bold text-sm px-1 border-x border-border-color leading-[44px] h-[44px]">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      disabled={item.quantity >= 10}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-border-color/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="수량 증가"
                    >
                      <Plus className="w-4 h-4 text-primary-text" />
                    </button>
                  </div>
                  {/* Delete button */}
                  <button
                    onClick={() => onRemove(item.id)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-error/20 rounded-lg hover:bg-error/30 transition-colors"
                    aria-label="상품 삭제"
                  >
                    <Trash2 className="w-4 h-4 text-error" />
                  </button>
                </>
              ) : (
                /* Delete button always visible for expired items */
                <button
                  onClick={() => onRemove(item.id)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-error/20 rounded-lg hover:bg-error/30 transition-colors"
                  aria-label="상품 삭제"
                >
                  <Trash2 className="w-4 h-4 text-error" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-border-color">
            <div className="flex justify-between">
              <Caption className="text-secondary-text">소계</Caption>
              <Body
                className={`font-bold ${isDisabled ? 'text-secondary-text' : 'text-primary-text'}`}
              >
                {formatPrice(item.total)}
              </Body>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
