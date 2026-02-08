'use client';

import { useEffect, useState } from 'react';

interface SocialProofProps {
  followerCount: number;
  message?: string;
}

export function SocialProof({ followerCount, message = '믿고 머물 수 있는, 기준 있는 쇼핑공간' }: SocialProofProps) {
  const [displayCount, setDisplayCount] = useState(0);

  // Animated counter
  useEffect(() => {
    const duration = 1200;
    const steps = 30;
    const increment = followerCount / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= followerCount) {
        setDisplayCount(followerCount);
        clearInterval(timer);
      } else {
        setDisplayCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [followerCount]);

  return (
    <div className="mx-4 mb-6 p-5 rounded-2xl bg-gray-100/50 backdrop-blur-sm border border-gray-200 relative overflow-hidden">
      {/* Decorative gradient */}
      <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-hot-pink/5 blur-2xl" />
      <div className="absolute -bottom-10 -left-10 w-24 h-24 rounded-full bg-[#7928CA]/5 blur-2xl" />
      
      <div className="relative flex items-center justify-between">
        <div className="flex-1">
          <p className="text-xs text-gray-500 mb-1 font-medium">{message}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black bg-gradient-to-r from-hot-pink to-[#FF4500] bg-clip-text text-transparent">
              {displayCount.toLocaleString()}
            </span>
            <span className="text-sm font-bold text-hot-pink">명 단골!</span>
          </div>
        </div>
        <div className="flex -space-x-2">
          {['😊', '🥰', '😎', '🤗'].map((emoji, i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-sm"
              style={{ zIndex: 4 - i }}
            >
              {emoji}
            </div>
          ))}
          <div className="w-8 h-8 rounded-full bg-hot-pink/10 border-2 border-white flex items-center justify-center text-[10px] font-bold text-hot-pink">
            +6K
          </div>
        </div>
      </div>
    </div>
  );
}
