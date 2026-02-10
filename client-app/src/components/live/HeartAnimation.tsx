'use client';

import { useState, useCallback, useEffect } from 'react';

interface FloatingHeart {
  id: number;
  x: number;
  color: string;
  emoji: string;
  size: number;
  duration: number;
  wobble: number;
}

const HEART_COLORS = [
  '#FF007A',
  '#FF3B80',
  '#FF69B4',
  '#FF1493',
  '#FF6EB4',
  '#FFB6C1',
  '#7928CA',
  '#FF4500',
];
const HEART_EMOJIS = ['❤️', '💖', '💗', '💕', '🩷', '💜', '🧡'];

interface HeartAnimationProps {
  showButton?: boolean;
}

export default function HeartAnimation({ showButton = true }: HeartAnimationProps) {
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const [tapScale, setTapScale] = useState(1);

  const addHeart = useCallback(() => {
    const id = Date.now() + Math.random();
    const newHeart: FloatingHeart = {
      id,
      x: Math.random() * 50 + 5,
      color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
      emoji: HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)],
      size: Math.random() * 14 + 22,
      duration: Math.random() * 1200 + 2000,
      wobble: Math.random() * 30 - 15,
    };

    setHearts((prev) => [...prev.slice(-20), newHeart]);

    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== id));
    }, newHeart.duration);
  }, []);

  const handleTap = useCallback(() => {
    // Burst: add 3 hearts at once
    for (let i = 0; i < 3; i++) {
      setTimeout(() => addHeart(), i * 80);
    }
    setTapScale(0.85);
    setTimeout(() => setTapScale(1), 150);
  }, [addHeart]);

  // Auto hearts
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.4) addHeart();
    }, 2000);
    return () => clearInterval(interval);
  }, [addHeart]);

  return (
    <div
      className="absolute bottom-28 right-3 w-20 h-72 pointer-events-none overflow-hidden z-20"
      aria-hidden="true"
    >
      {hearts.map((heart) => (
        <div
          key={heart.id}
          className="absolute bottom-0 animate-float-up"
          style={{
            right: `${heart.x}%`,
            fontSize: `${heart.size}px`,
            color: heart.color,
            animationDuration: `${heart.duration}ms`,
            filter: `drop-shadow(0 0 6px ${heart.color}60)`,
            transform: `rotate(${heart.wobble}deg)`,
          }}
        >
          {heart.emoji}
        </div>
      ))}
      {/* Heart button */}
      {showButton && (
        <button
          onClick={handleTap}
          className="absolute bottom-0 right-2 w-14 h-14 rounded-full flex items-center justify-center pointer-events-auto active:scale-90 transition-transform z-30"
          style={{
            background: 'linear-gradient(135deg, #FF007A, #FF4500)',
            boxShadow: '0 4px 20px rgba(255, 0, 122, 0.4)',
            transform: `scale(${tapScale})`,
            transition: 'transform 0.15s ease-out',
          }}
        >
          <span className="text-2xl" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
            ❤️
          </span>
        </button>
      )}
    </div>
  );
}
