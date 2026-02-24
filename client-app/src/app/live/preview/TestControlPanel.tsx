'use client';

import { useState } from 'react';
import type { ChatMessage } from '@/components/chat/types';
import type { Product } from '@/lib/types/product';
import { ProductStatus } from '@live-commerce/shared-types';

interface TestControlPanelProps {
  onBulkChat: (count: number) => void;
  onSetChatSpeed: (ms: number) => void;
  onSendLongMessage: () => void;
  onUpdateProduct: (index: number, updates: Partial<Product>) => void;
  onAddProduct: () => void;
  onRemoveProduct: (index: number) => void;
  cartCount: number;
  onResetCart: () => void;
  onShare: () => void;
  chatSpeed: number;
  products: Product[];
}

export default function TestControlPanel({
  onBulkChat,
  onSetChatSpeed,
  onSendLongMessage,
  onUpdateProduct,
  onAddProduct,
  onRemoveProduct,
  cartCount,
  onResetCart,
  onShare,
  chatSpeed,
  products,
}: TestControlPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'product' | 'cart'>('chat');

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-20 right-4 z-50 w-10 h-10 bg-amber-500 text-black rounded-full flex items-center justify-center shadow-lg hover:bg-amber-400 transition-all active:scale-90 text-lg font-bold"
        title="테스트 패널 열기"
      >
        QA
      </button>
    );
  }

  return (
    <div className="fixed top-16 right-4 z-50 w-[280px] bg-[#1a1a1a] border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-amber-500 text-black">
        <span className="font-black text-sm">QA 테스트 패널</span>
        <button
          onClick={() => setIsOpen(false)}
          className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center text-xs font-bold hover:bg-black/30"
        >
          X
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {(['chat', 'product', 'cart'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-bold transition-colors ${
              activeTab === tab
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {tab === 'chat' ? '채팅' : tab === 'product' ? '상품' : '장바구니'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 max-h-[400px] overflow-y-auto">
        {/* ── Chat Tab ── */}
        {activeTab === 'chat' && (
          <div className="space-y-3">
            <div>
              <p className="text-white/60 text-xs mb-2 font-semibold">부하 테스트</p>
              <div className="flex gap-2">
                <button
                  onClick={() => onBulkChat(50)}
                  className="flex-1 py-2 bg-red-500/20 text-red-400 text-xs font-bold rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  50개 폭탄
                </button>
                <button
                  onClick={() => onBulkChat(100)}
                  className="flex-1 py-2 bg-red-500/20 text-red-400 text-xs font-bold rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  100개 폭탄
                </button>
              </div>
            </div>

            <div>
              <p className="text-white/60 text-xs mb-2 font-semibold">
                자동 채팅 속도: <span className="text-amber-400">{chatSpeed}ms</span>
              </p>
              <div className="flex gap-2">
                {[
                  { label: '정지', ms: 0 },
                  { label: '느림', ms: 5000 },
                  { label: '보통', ms: 3500 },
                  { label: '빠름', ms: 500 },
                  { label: '극한', ms: 100 },
                ].map(({ label, ms }) => (
                  <button
                    key={ms}
                    onClick={() => onSetChatSpeed(ms)}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-colors ${
                      chatSpeed === ms
                        ? 'bg-amber-500 text-black'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={onSendLongMessage}
              className="w-full py-2 bg-purple-500/20 text-purple-400 text-xs font-bold rounded-lg hover:bg-purple-500/30 transition-colors"
            >
              200자 긴 메시지 테스트
            </button>

            <button
              onClick={onShare}
              className="w-full py-2 bg-blue-500/20 text-blue-400 text-xs font-bold rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              공유 테스트
            </button>
          </div>
        )}

        {/* ── Product Tab ── */}
        {activeTab === 'product' && (
          <div className="space-y-3">
            {products.map((product, index) => (
              <div
                key={product.id}
                className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <p className="text-white text-xs font-bold truncate flex-1">{product.name}</p>
                  <button
                    onClick={() => onRemoveProduct(index)}
                    className="text-red-400 text-[10px] font-bold ml-2 hover:text-red-300"
                  >
                    삭제
                  </button>
                </div>

                {/* Stock slider */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white/40 text-[10px]">재고</span>
                    <span
                      className={`text-[10px] font-bold ${
                        product.stock === 0 ? 'text-red-400' : 'text-white/60'
                      }`}
                    >
                      {product.stock}개
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={product.stock}
                    onChange={(e) => onUpdateProduct(index, { stock: parseInt(e.target.value) })}
                    className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                {/* Discount slider */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white/40 text-[10px]">할인율</span>
                    <span className="text-[10px] font-bold text-[#FF007A]">
                      {product.discountRate || 0}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="90"
                    value={product.discountRate || 0}
                    onChange={(e) =>
                      onUpdateProduct(index, { discountRate: parseInt(e.target.value) })
                    }
                    className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-[#FF007A]"
                  />
                </div>

                {/* Quick actions */}
                <div className="flex gap-1.5">
                  <button
                    onClick={() =>
                      onUpdateProduct(index, {
                        stock: 0,
                        status: ProductStatus.SOLD_OUT,
                      })
                    }
                    className="flex-1 py-1.5 bg-red-500/20 text-red-400 text-[10px] font-bold rounded-lg"
                  >
                    품절
                  </button>
                  <button
                    onClick={() =>
                      onUpdateProduct(index, {
                        stock: 25,
                        status: ProductStatus.AVAILABLE,
                      })
                    }
                    className="flex-1 py-1.5 bg-green-500/20 text-green-400 text-[10px] font-bold rounded-lg"
                  >
                    재입고
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={onAddProduct}
              className="w-full py-2 bg-green-500/20 text-green-400 text-xs font-bold rounded-lg hover:bg-green-500/30 transition-colors border border-dashed border-green-500/30"
            >
              + 상품 추가
            </button>
          </div>
        )}

        {/* ── Cart Tab ── */}
        {activeTab === 'cart' && (
          <div className="space-y-3">
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
              <p className="text-white/40 text-xs mb-1">담긴 상품</p>
              <p className="text-3xl font-black text-amber-400">{cartCount}</p>
              <p className="text-white/30 text-[10px] mt-1">개</p>
            </div>

            <button
              onClick={onResetCart}
              className="w-full py-2 bg-red-500/20 text-red-400 text-xs font-bold rounded-lg hover:bg-red-500/30 transition-colors"
            >
              장바구니 초기화
            </button>

            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <p className="text-white/40 text-[10px] mb-2 font-semibold">테스트 방법</p>
              <ul className="text-white/50 text-[10px] space-y-1">
                <li>1. 상품 카드의 [구매] 버튼 클릭</li>
                <li>2. 데스크톱: 좌측 상품 목록 클릭 → 모달</li>
                <li>3. 모달에서 컬러/사이즈 선택 → 담기</li>
                <li>4. Toast 알림 + 장바구니 활동 피드 확인</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
