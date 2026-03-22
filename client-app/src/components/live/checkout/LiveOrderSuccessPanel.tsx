'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle } from 'lucide-react';

interface LiveOrderSuccessPanelProps {
  orderId: string;
  totalAmount: string;
  onViewOrder: (orderId: string) => void;
  onClose: () => void;
}

const COUNTDOWN_SECONDS = 5;

export default function LiveOrderSuccessPanel({
  orderId,
  totalAmount,
  onViewOrder,
  onClose,
}: LiveOrderSuccessPanelProps) {
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (countdown <= 0) onCloseRef.current();
  }, [countdown]);

  return (
    <div className="flex flex-col items-center px-5 pt-6 pb-4 text-center">
      {/* Success icon with CSS animation */}
      <div className="mb-4 animate-bounce-once">
        <CheckCircle className="w-16 h-16 text-green-400" strokeWidth={1.5} />
      </div>

      <h2 className="text-white font-bold text-lg mb-1">주문 완료!</h2>
      <p className="text-white/50 text-xs mb-4">결제가 정상적으로 처리되었습니다</p>

      {/* Order info */}
      <div className="w-full bg-white/5 rounded-2xl px-4 py-3 mb-5 text-left space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-white/50">주문번호</span>
          <span className="text-white font-mono text-xs">{orderId}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/50">결제금액</span>
          <span className="text-green-400 font-bold">{totalAmount}</span>
        </div>
      </div>

      {/* Countdown progress bar */}
      <div className="w-full h-0.5 bg-white/10 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-white/30 transition-all duration-1000 ease-linear"
          style={{ width: `${(countdown / COUNTDOWN_SECONDS) * 100}%` }}
        />
      </div>

      {/* Actions */}
      <button
        onClick={() => onViewOrder(orderId)}
        className="w-full py-3.5 bg-green-500 text-white font-bold rounded-2xl active:scale-[0.98] transition-transform mb-2"
      >
        주문 내역 보기
      </button>
      <button
        onClick={onClose}
        className="w-full py-3 text-white/60 text-sm active:text-white transition-colors"
      >
        방송 계속 보기 ({countdown}초 후 자동 닫힘)
      </button>
    </div>
  );
}
