import { useState, useCallback } from 'react';

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
 * TODO: Re-enable WebSocket connection once the backend cart activity events are
 * properly wired end-to-end. The backend websocket.gateway.ts (namespace "/") has
 * a `join:stream` handler and emits `cart:item-added` via @OnEvent('cart:added'),
 * but the full flow (cart service -> event emitter -> websocket broadcast) needs
 * to be verified with the correct namespace and room joining. The previous
 * implementation connected to the root namespace and listened for `cart:item-added`,
 * which should work once the event pipeline is confirmed functional.
 *
 * Previous socket events used:
 *   - emit: 'join:stream' { streamId: streamKey }
 *   - emit: 'leave:stream' { streamId: streamKey }
 *   - on: 'cart:item-added' { type: string, data: CartActivityEvent }
 */
export function useCartActivity(_streamKey: string) {
  const [activities] = useState<CartActivityEvent[]>([]);

  const clearActivities = useCallback(() => {
    // No-op while socket is disabled
  }, []);

  return {
    activities,
    clearActivities,
  };
}
