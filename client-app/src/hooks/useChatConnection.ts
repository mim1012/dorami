import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useChatConnection(streamKey: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // WebSocket connection
    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001', {
      transports: ['websocket'],
      auth: {
        token: typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null,
      },
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('[Chat] WebSocket connected');
      setIsConnected(true);

      // Join chat room
      socket.emit('chat:join-room', { streamKey });
    });

    socket.on('disconnect', () => {
      console.log('[Chat] WebSocket disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Chat] Connection error:', error);
      setIsConnected(false);
    });

    // User count updates
    socket.on('chat:user-count', (count: number) => {
      setUserCount(count);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('chat:leave-room', { streamKey });
        socketRef.current.disconnect();
      }
    };
  }, [streamKey]);

  const sendMessage = (message: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('chat:send-message', {
        streamKey,
        message,
      });
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    userCount,
    sendMessage,
  };
}
