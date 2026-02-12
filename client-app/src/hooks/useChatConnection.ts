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
        socketRef.current.emit('chat:leave-room', { streamKey });
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
