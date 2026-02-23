import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { generateId } from '@/lib/utils/uuid';

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
 *
 * Backend event flow:
 *   CartService → eventEmitter.emit('cart:added')
 *     → CartEventsListener → socket.to('stream:{streamKey}').emit('cart:item-added', {...})
 *
 * Socket events:
 *   - emit: 'join:stream' { streamId: streamKey }
 *   - emit: 'leave:stream' { streamId: streamKey }
 *   - on: 'cart:item-added' { type: string, data: CartActivityEvent }
 */
const MAX_ACTIVITIES = 50;

export function useCartActivity(streamKey: string) {
  const [activities, setActivities] = useState<CartActivityEvent[]>([]);

  useEffect(() => {
    const baseUrl =
      process.env.NEXT_PUBLIC_WS_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '');
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

    const socket = io(baseUrl + '/', {
      transports: ['websocket'],
      withCredentials: true,
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });

    socket.on('connect', () => {
      socket.emit('join:stream', { streamId: streamKey });
    });

    socket.on('connect_error', (error) => {
      console.error('[CartActivity] Connection error:', error);
    });

    socket.on('cart:item-added', (payload) => {
      const data = payload.data ?? payload;
      setActivities((prev) => {
        const next = [
          ...prev,
          {
            id: generateId(),
            userId: data.userId,
            userName: data.userName,
            userColor: data.userColor,
            productName: data.productName,
            quantity: data.quantity,
            timestamp: data.timestamp,
          },
        ];
        return next.length > MAX_ACTIVITIES ? next.slice(-MAX_ACTIVITIES) : next;
      });
    });

    return () => {
      socket.emit('leave:stream', { streamId: streamKey });
      socket.disconnect();
    };
  }, [streamKey]);

  const clearActivities = useCallback(() => setActivities([]), []);

  return {
    activities,
    clearActivities,
  };
}
