'use client';

import { useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { create } from 'zustand';
import { ReconnectionCircuitBreaker } from '@/lib/socket/circuit-breaker';
import { RECONNECT_CONFIG } from '@/lib/socket/reconnect-config';
import { refreshAuthToken, isAuthError, forceLogout } from '@/lib/auth/token-manager';

// ── Stock store ──
interface StockState {
  stocks: Record<string, number>; // productId -> quantity
  soldOut: Set<string>; // productId set
  updateStock: (productId: string, stock: number) => void;
  markSoldOut: (productId: string) => void;
  setInitialStocks: (
    products: Array<{ id: string; stock?: number; quantity?: number; status?: string }>,
  ) => void;
}

export const useStockStore = create<StockState>((set) => ({
  stocks: {},
  soldOut: new Set(),
  updateStock: (productId, stock) =>
    set((state) => {
      const newStocks = { ...state.stocks, [productId]: stock };
      const newSoldOut = new Set(state.soldOut);
      if (stock <= 0) {
        newSoldOut.add(productId);
      } else {
        newSoldOut.delete(productId);
      }
      return { stocks: newStocks, soldOut: newSoldOut };
    }),
  markSoldOut: (productId) =>
    set((state) => {
      const newSoldOut = new Set(state.soldOut);
      newSoldOut.add(productId);
      return {
        stocks: { ...state.stocks, [productId]: 0 },
        soldOut: newSoldOut,
      };
    }),
  setInitialStocks: (products) =>
    set(() => {
      const stocks: Record<string, number> = {};
      const soldOut = new Set<string>();
      for (const p of products) {
        const qty = p.stock ?? p.quantity ?? 0;
        stocks[p.id] = qty;
        if (qty <= 0 || p.status === 'SOLD_OUT') {
          soldOut.add(p.id);
        }
      }
      return { stocks, soldOut };
    }),
}));

// ── WebSocket hook for real-time stock updates ──
const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');

/**
 * useProductStock
 *
 * Connects to the WebSocket server and listens for product stock events.
 * Uses a global Zustand store so stock updates are shared across components.
 *
 * Circuit Breaker가 적용되어 연속 실패 시 무한 재연결을 방지한다.
 * - 10회 실패(Socket.IO reconnectionAttempts) 후에도 연결 불가 시 Circuit Breaker 발동
 * - connect_error 마다 실패 카운터 증가, 성공 시 초기화
 * - reconnect_attempt 에서 Circuit Breaker OPEN 상태면 소켓 강제 해제
 *
 * Events handled:
 * - product:stock:changed  (global broadcast from ProductAlertHandler)
 * - live:product:updated   (stream-scoped broadcast)
 * - live:product:soldout   (stream-scoped broadcast)
 */
export function useProductStock(streamKey?: string) {
  const socketRef = useRef<Socket | null>(null);
  const { updateStock, markSoldOut } = useStockStore();

  // Circuit Breaker 인스턴스: config 값 참조
  // useRef로 보관해 렌더링 사이에도 상태를 유지한다
  const stockConfig = RECONNECT_CONFIG.default;
  const circuitBreakerRef = useRef(
    new ReconnectionCircuitBreaker(
      stockConfig.circuitBreakerThreshold,
      stockConfig.circuitBreakerCooldownMs,
    ),
  );

  // 마지막 connect_error가 인증(토큰 만료) 에러였는지 추적
  const lastAuthErrorRef = useRef(false);

  const connect = useCallback(() => {
    // Don't create duplicate connections
    if (socketRef.current?.connected) return;

    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: stockConfig.maxAttempts,
      reconnectionDelay: stockConfig.delays[0],
      reconnectionDelayMax: stockConfig.delays[stockConfig.delays.length - 1],
      autoConnect: true,
    });

    // ── Global stock changed event ──
    socket.on(
      'product:stock:changed',
      (payload: { productId: string; oldStock: number; newStock: number }) => {
        updateStock(payload.productId, payload.newStock);
      },
    );

    // ── Stream-scoped product updated ──
    socket.on(
      'live:product:updated',
      (payload: {
        type: string;
        data: {
          id: string;
          stock: number;
          status: string;
        };
      }) => {
        const product = payload.data;
        updateStock(product.id, product.stock);
        if (product.status === 'SOLD_OUT') {
          markSoldOut(product.id);
        }
      },
    );

    // ── Stream-scoped sold out event ──
    socket.on('live:product:soldout', (payload: { type: string; data: { productId: string } }) => {
      markSoldOut(payload.data.productId);
    });

    // ── Low stock warning ──
    socket.on(
      'product:low-stock',
      (payload: {
        type: string;
        data: {
          productId: string;
          remainingStock: number;
        };
      }) => {
        updateStock(payload.data.productId, payload.data.remainingStock);
      },
    );

    socket.on('connect', () => {
      console.log('[useProductStock] Connected to WebSocket');

      // 연결 성공 → 실패 카운터 및 인증 에러 플래그 초기화
      circuitBreakerRef.current.recordSuccess();
      lastAuthErrorRef.current = false;

      // Join stream room if streamKey provided
      if (streamKey) {
        socket.emit('join:stream', { streamId: streamKey });
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('[useProductStock] WebSocket connection error:', err.message);

      // 인증 에러(토큰 만료 등) 여부를 기록해 다음 reconnect_attempt에서 갱신 시도
      if (isAuthError(err)) {
        lastAuthErrorRef.current = true;
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[useProductStock] 인증 에러 감지 — 다음 재연결 시 토큰 갱신 예정');
        }
      }

      // 연결 실패를 Circuit Breaker에 기록한다
      circuitBreakerRef.current.recordFailure();
    });

    /**
     * 재연결 시도 직전에 Circuit Breaker를 확인하고 JWT 토큰을 갱신한다.
     *
     * 1. Circuit Breaker OPEN 상태면 소켓을 강제 해제해 무한 루프를 방지한다.
     * 2. 인증 에러가 있었던 경우 토큰 갱신을 시도한다.
     *    - 갱신 성공: 재연결 진행 (새 accessToken 쿠키가 자동 첨부됨)
     *    - 갱신 실패: Circuit Breaker에 실패 기록 후 강제 로그아웃
     */
    socket.io.on('reconnect_attempt', async () => {
      if (!circuitBreakerRef.current.canAttemptReconnect()) {
        const { cooldownRemainingMs } = circuitBreakerRef.current.getState();
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `[useProductStock] Circuit Breaker OPEN — 재연결 차단. ` +
              `${Math.ceil(cooldownRemainingMs / 1000)}초 후 재시도 가능`,
          );
        }
        socket.disconnect();
        return;
      }

      // 마지막 인증 에러 여부 확인 후 토큰 갱신 시도
      if (lastAuthErrorRef.current) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[useProductStock] 인증 에러 감지 — 토큰 갱신 시도');
        }
        const refreshed = await refreshAuthToken();
        if (!refreshed) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[useProductStock] 토큰 갱신 실패 — 강제 로그아웃');
          }
          circuitBreakerRef.current.recordFailure();
          socket.disconnect();
          forceLogout();
          return;
        }
        lastAuthErrorRef.current = false;
        if (process.env.NODE_ENV !== 'production') {
          console.log('[useProductStock] 토큰 갱신 성공 — 재연결 진행');
        }
      }
    });

    socketRef.current = socket;
  }, [streamKey, updateStock, markSoldOut]);

  useEffect(() => {
    connect();

    return () => {
      if (socketRef.current) {
        if (streamKey) {
          socketRef.current.emit('leave:stream', { streamId: streamKey });
        }
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect, streamKey]);

  return useStockStore();
}

/**
 * Helper hook to get stock for a single product
 */
export function useProductStockById(productId: string) {
  const stock = useStockStore((state) => state.stocks[productId]);
  const isSoldOut = useStockStore((state) => state.soldOut.has(productId));

  return {
    stock: stock ?? null,
    isSoldOut,
    isLowStock: stock !== null && stock !== undefined && stock > 0 && stock < 5,
  };
}
