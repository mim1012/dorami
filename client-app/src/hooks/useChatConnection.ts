import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useChatConnection(streamKey: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // WebSocket connection - connect to /chat namespace
    const baseUrl =
      process.env.NEXT_PUBLIC_WS_URL ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const socket = io(`${baseUrl}/chat`, {
      transports: ['websocket'],
      withCredentials: true,
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      if (process.env.NODE_ENV !== 'production') console.log('[Chat] WebSocket connected');
      setIsConnected(true);

      // Join chat room (gateway expects liveId)
      socket.emit('chat:join-room', { liveId: streamKey });
    });

    // Re-join room after reconnection (network switch, background recovery)
    socket.io.on('reconnect', () => {
      if (process.env.NODE_ENV !== 'production') console.log('[Chat] Reconnected, re-joining room');
      socket.emit('chat:join-room', { liveId: streamKey });
    });

    socket.on('disconnect', () => {
      if (process.env.NODE_ENV !== 'production') console.log('[Chat] WebSocket disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Chat] Connection error:', error);
      setIsConnected(false);
    });

    // Track user count locally via join/leave events
    // (backend emits 'chat:user-joined' and 'chat:user-left', not 'chat:user-count')
    socket.on('chat:user-joined', () => {
      setUserCount((prev) => prev + 1);
    });

    socket.on('chat:user-left', () => {
      setUserCount((prev) => Math.max(0, prev - 1));
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('chat:leave-room', { liveId: streamKey });
        socketRef.current.disconnect();
      }
    };
  }, [streamKey]);

  const sendMessage = (message: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('chat:send-message', {
        liveId: streamKey,
        message,
      });
    }
  };

  const deleteMessage = (messageId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('chat:delete-message', {
        liveId: streamKey,
        messageId,
      });
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    userCount,
    sendMessage,
    deleteMessage,
  };
}
