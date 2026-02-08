import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface CartActivityEvent {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  productName: string;
  quantity: number;
  timestamp: string;
}

/**
 * Hook to listen for real-time cart activity events via WebSocket
 * Used in live stream pages to show "OOO님이 [상품명]을 장바구니에 담았어요!" notifications
 */
export function useCartActivity(streamKey: string) {
  const [activities, setActivities] = useState<CartActivityEvent[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!streamKey) return;

    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001', {
      transports: ['websocket'],
      auth: {
        token: typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null,
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[CartActivity] WebSocket connected');
      // Join the stream room to receive cart events
      socket.emit('join:stream', { streamId: streamKey });
    });

    // Listen for cart:item-added events
    socket.on('cart:item-added', (payload: { type: string; data: Omit<CartActivityEvent, 'id'> }) => {
      const activity: CartActivityEvent = {
        ...payload.data,
        id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      setActivities(prev => [...prev.slice(-20), activity]); // Keep last 20
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave:stream', { streamId: streamKey });
        socketRef.current.disconnect();
      }
    };
  }, [streamKey]);

  const clearActivities = useCallback(() => {
    setActivities([]);
  }, []);

  return {
    activities,
    clearActivities,
  };
}
