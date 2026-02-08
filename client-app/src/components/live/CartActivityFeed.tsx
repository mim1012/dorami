'use client';

import { useState, useEffect } from 'react';

export interface CartActivity {
  id: string;
  userName: string;
  userColor: string;
  productName: string;
  timestamp: string;
}

interface CartActivityFeedProps {
  activities: CartActivity[];
}

export default function CartActivityFeed({ activities }: CartActivityFeedProps) {
  const [visibleActivities, setVisibleActivities] = useState<(CartActivity & { fadingOut?: boolean })[]>([]);

  useEffect(() => {
    if (activities.length === 0) return;
    const latest = activities[activities.length - 1];
    
    setVisibleActivities(prev => {
      const updated = [...prev, latest].slice(-5);
      return updated;
    });

    // Start fade out after 4.5s, remove after 5s
    const fadeTimeout = setTimeout(() => {
      setVisibleActivities(prev => prev.map(a => a.id === latest.id ? { ...a, fadingOut: true } : a));
    }, 4500);

    const removeTimeout = setTimeout(() => {
      setVisibleActivities(prev => prev.filter(a => a.id !== latest.id));
    }, 5000);

    return () => {
      clearTimeout(fadeTimeout);
      clearTimeout(removeTimeout);
    };
  }, [activities]);

  if (visibleActivities.length === 0) return null;

  return (
    <div className="absolute top-24 left-3 right-20 z-20 flex flex-col gap-2 pointer-events-none">
      {visibleActivities.map((activity, index) => (
        <div
          key={activity.id}
          className={`flex items-center gap-2 rounded-2xl py-2 px-3 max-w-fit ${
            activity.fadingOut ? 'animate-cart-toast-out' : 'animate-cart-toast-in'
          }`}
          style={{
            background: 'linear-gradient(135deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.35) 100%)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid ${activity.userColor}20`,
          }}
        >
          {/* User avatar */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black text-white flex-shrink-0 shadow-lg"
            style={{ 
              background: `linear-gradient(135deg, ${activity.userColor}, ${activity.userColor}99)`,
              boxShadow: `0 0 12px ${activity.userColor}40`
            }}
          >
            {activity.userName[0]}
          </div>
          <span className="text-white text-xs leading-tight">
            <span className="font-bold" style={{ color: activity.userColor }}>
              {activity.userName}
            </span>
            <span className="text-white/80">님이 </span>
            <span className="font-bold text-white">{activity.productName}</span>
            <span className="text-white/80"> 담았어요!</span>
            <span className="ml-1">🛒</span>
          </span>
        </div>
      ))}
    </div>
  );
}
