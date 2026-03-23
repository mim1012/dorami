'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ShoppingCart, Trash2, Plus, Minus } from 'lucide-react';
import {
  useCart,
  useUpdateCartItem,
  useRemoveCartItem,
  type CartItem,
} from '@/lib/hooks/queries/use-cart';
import { formatPrice } from '@/lib/utils/price';

interface LiveCartPanelProps {
  onProceedToCheckout: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function CartItemRow({
  item,
  checked,
  onCheckedChange,
  onUpdateQuantity,
  onRemove,
}: {
  item: CartItem;
  checked: boolean;
  onCheckedChange: (id: string, checked: boolean) => void;
  onUpdateQuantity: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}) {
  const optionParts = [item.color, item.size].filter(Boolean);
  const optionLabel = optionParts.length > 0 ? optionParts.join(' · ') : '';

  return (
    <div className="flex items-center gap-2 py-3 border-b border-white/5 last:border-0">
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(item.id, e.target.checked)}
        className="w-4 h-4 rounded border-white/30 accent-[#FF1493] cursor-pointer flex-shrink-0"
      />

      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 relative">
        {item.product?.imageUrl ? (
          <Image
            src={item.product.imageUrl}
            alt={item.productName}
            fill
            className="object-cover"
            sizes="48px"
            unoptimized={item.product.imageUrl.startsWith('/uploads/')}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingCart className="w-4 h-4 text-white/20" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-semibold truncate">{item.productName}</p>
        {optionLabel && <p className="text-white/40 text-[10px]">{optionLabel}</p>}
        <p className="text-white font-bold text-xs mt-0.5">{formatPrice(item.subtotal)}</p>
      </div>

      {/* Quantity controls */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
          disabled={item.quantity <= 1}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 active:scale-90 transition-all disabled:opacity-30"
          aria-label="수량 감소"
        >
          <Minus className="w-3 h-3 text-white/70" />
        </button>
        <span className="w-6 text-center text-white text-xs font-bold">{item.quantity}</span>
        <button
          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
          disabled={item.quantity >= 10}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 active:scale-90 transition-all disabled:opacity-30"
          aria-label="수량 증가"
        >
          <Plus className="w-3 h-3 text-white/70" />
        </button>
      </div>

      {/* Delete */}
      <button
        onClick={() => onRemove(item.id)}
        className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/10 active:scale-90 transition-all flex-shrink-0"
        aria-label="삭제"
      >
        <Trash2 className="w-3.5 h-3.5 text-red-400" />
      </button>
    </div>
  );
}

export default function LiveCartPanel({ onProceedToCheckout }: LiveCartPanelProps) {
  const { data: cartData } = useCart();
  const updateCartItem = useUpdateCartItem();
  const removeCartItem = useRemoveCartItem();

  const items = cartData?.items?.filter((item) => item.status === 'ACTIVE') ?? [];

  // Selection state — default all selected
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(items.map((i) => i.id)),
  );

  // Stable item IDs string to avoid infinite loop (items array is new ref each render)
  const itemIdsKey = items.map((i) => i.id).join(',');

  // Sync selection when items change
  useEffect(() => {
    const currentIds = new Set(itemIdsKey.split(',').filter(Boolean));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => currentIds.has(id)));
      // Auto-select newly added items
      for (const id of currentIds) {
        if (!prev.has(id)) next.add(id);
      }
      if (next.size === prev.size && [...next].every((id) => prev.has(id))) return prev;
      return next;
    });
  }, [itemIdsKey]);

  const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id));
  const selectedItems = items.filter((i) => selectedIds.has(i.id));
  const selectedTotal = selectedItems.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
  const selectedShipping = selectedItems.reduce((sum, i) => sum + Number(i.shippingFee), 0);
  const grandTotal = selectedTotal + selectedShipping;

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? new Set(items.map((i) => i.id)) : new Set());
    },
    [items],
  );

  const handleItemChecked = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleUpdateQuantity = useCallback(
    (id: string, qty: number) => {
      if (qty < 1 || qty > 10) return;
      updateCartItem.mutate({ itemId: id, quantity: qty });
    },
    [updateCartItem],
  );

  const handleRemoveItem = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      removeCartItem.mutate(id);
    },
    [removeCartItem],
  );

  // Timer
  const timerItems = items.filter((item) => item.timerEnabled && item.expiresAt);
  const earliestExpiresAt =
    timerItems.length > 0 ? timerItems.map((item) => item.expiresAt!).sort()[0] : null;

  const timerDurationSeconds = (() => {
    if (timerItems.length === 0) return 600;
    const maxRemaining = Math.max(...timerItems.map((i) => i.remainingSeconds ?? 0));
    return maxRemaining > 0 ? maxRemaining : 600;
  })();

  const [localRemaining, setLocalRemaining] = useState(0);
  useEffect(() => {
    if (!earliestExpiresAt) {
      setLocalRemaining(0);
      return;
    }
    const tick = () => {
      const diff = new Date(earliestExpiresAt).getTime() - Date.now();
      setLocalRemaining(Math.max(0, Math.floor(diff / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [earliestExpiresAt]);

  const progressPercent =
    localRemaining > 0 ? Math.min(100, (localRemaining / timerDurationSeconds) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-white font-bold text-base flex items-center gap-2 mb-3">
          <ShoppingCart className="w-4 h-4" />내 장바구니
        </h2>

        {timerItems.length > 0 && (
          <>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-hot-pink transition-all duration-1000"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-white/40 mt-1">
              {formatTime(localRemaining)} 내 결제 필요
            </p>
          </>
        )}
      </div>

      {/* Select all */}
      {items.length > 0 && (
        <div className="px-5 pb-2 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="w-4 h-4 rounded border-white/30 accent-[#FF1493] cursor-pointer"
            />
            <span className="text-white/60 text-xs">전체 선택 ({items.length})</span>
          </label>
          <span className="text-white/40 text-xs">{selectedItems.length}개 선택됨</span>
        </div>
      )}

      {/* Item list */}
      <div className="flex-1 overflow-y-auto px-5">
        {items.length > 0 ? (
          items.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              checked={selectedIds.has(item.id)}
              onCheckedChange={handleItemChecked}
              onUpdateQuantity={handleUpdateQuantity}
              onRemove={handleRemoveItem}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-white/40">
            <ShoppingCart className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">아직 담은 상품이 없어요</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/10">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-white/60">선택 상품 ({selectedItems.length}개)</span>
          <span className="text-white font-semibold">{formatPrice(selectedTotal)}</span>
        </div>
        <div className="flex justify-between text-xs text-white/40 mb-4">
          <span>배송비</span>
          <span>{selectedShipping === 0 ? '무료' : formatPrice(selectedShipping)}</span>
        </div>
        <button
          onClick={onProceedToCheckout}
          disabled={selectedItems.length === 0}
          className="w-full py-3.5 bg-hot-pink text-white font-bold rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {selectedItems.length > 0
            ? `${formatPrice(grandTotal)} 결제하기 →`
            : '상품을 선택해주세요'}
        </button>
      </div>
    </div>
  );
}
