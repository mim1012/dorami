'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CartTimerProps {
  expiresAt: string;
  onExpired?: () => void;
}

export default function CartTimer({ expiresAt, onExpired }: CartTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  useEffect(() => {
    const calculateRemaining = () => {
      const now = new Date().getTime();
      const expires = new Date(expiresAt).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setRemainingSeconds(0);
        onExpired?.();
        return 0;
      }

      return Math.floor(diff / 1000);
    };

    // Initial calculation
    setRemainingSeconds(calculateRemaining());

    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  const isLowTime = remainingSeconds < 60; // Less than 1 minute
  const isExpired = remainingSeconds === 0;

  if (isExpired) {
    return (
      <div className="flex items-center gap-2 text-error">
        <Clock className="w-4 h-4" />
        <span className="font-bold">예약 시간 만료</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 ${
        isLowTime ? 'text-orange-500' : 'text-hot-pink'
      }`}
    >
      <Clock className="w-4 h-4" />
      <span className="font-mono font-bold">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  );
}
