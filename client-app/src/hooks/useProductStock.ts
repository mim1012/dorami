'use client';

import { useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { create } from 'zustand';

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
 * Events handled:
 * - product:stock:changed  (global broadcast from ProductAlertHandler)
 * - live:product:updated   (stream-scoped broadcast)
 * - live:product:soldout   (stream-scoped broadcast)
 */
export function useProductStock(streamKey?: string) {
  const socketRef = useRef<Socket | null>(null);
  const { updateStock, markSoldOut } = useStockStore();

  const connect = useCallback(() => {
    // Don't create duplicate connections
    if (socketRef.current?.connected) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
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
      // Join stream room if streamKey provided
      if (streamKey) {
        socket.emit('join:stream', { streamId: streamKey });
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('[useProductStock] WebSocket connection error:', err.message);
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
