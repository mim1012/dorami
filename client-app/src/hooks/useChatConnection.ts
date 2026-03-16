import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { isAuthError, refreshAuthToken } from '@/lib/auth/token-manager';
import { RECONNECT_CONFIG } from '@/lib/socket/reconnect-config';
import { SOCKET_URL } from '@/lib/config/socket-url';

interface QueuedMessage {
  clientMessageId: string;
  liveId: string;
  message: string;
}

export function useChatConnection(streamKey: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const pendingMessageQueueRef = useRef<QueuedMessage[]>([]);

  const createMessageId = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const flushPendingMessages = useCallback(() => {
    const socket = socketRef.current;
    const queuedMessages = pendingMessageQueueRef.current;

    if (!socket || !socket.connected || queuedMessages.length === 0) {
      return;
    }

    pendingMessageQueueRef.current = [];
    for (const payload of queuedMessages) {
      socket.emit('chat:send-message', payload);
    }
  }, []);

  useEffect(() => {
    // Guard: Don't connect if streamKey is not available
    if (!streamKey || streamKey === 'undefined') {
      setIsConnected(false);
      return;
    }
    const reconnectConfig = RECONNECT_CONFIG.chat;

    // WebSocket connection - connect to /chat namespace
    const chatUrl = `${SOCKET_URL}/chat`;

    const socket = io(chatUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: reconnectConfig.maxAttempts,
      reconnectionDelay: reconnectConfig.delays[0],
      reconnectionDelayMax: reconnectConfig.delays[reconnectConfig.delays.length - 1],
      randomizationFactor: reconnectConfig.jitterFactor,
      timeout: 20000,
    });

    socketRef.current = socket;

    const emitJoin = () => {
      socket.emit('chat:join-room', { liveId: streamKey });
    };

    const handleAuthReconnect = async () => {
      const refreshed = await refreshAuthToken();
      if (refreshed) {
        socket.connect();
      } else {
        socket.disconnect();
      }
    };

    // Connection events
    socket.on('connect', () => {
      setIsConnected(true);

      // Join chat room
      emitJoin();
      flushPendingMessages();
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
    });

    socket.on('connect_error', async (error) => {
      setIsConnected(false);

      if (!socket.disconnected) {
        return;
      }

      if (isAuthError(error as Error)) {
        await handleAuthReconnect();
      }
    });

    // Track user count locally via join/leave events
    // (backend emits 'chat:user-joined' and 'chat:user-left', not 'chat:user-count')
    socket.on('chat:user-joined', () => {
      setUserCount((prev) => prev + 1);
    });

    socket.on('chat:user-left', () => {
      setUserCount((prev) => Math.max(0, prev - 1));
    });

    socket.io.on('reconnect_attempt', (attemptNumber) => {
      // Reconnect attempt (silently handle without logging)
    });

    socket.io.on('reconnect', () => {
      // Note: socket.on('connect') is also fired on reconnect, so emitJoin is called there
      // Avoid double-calling emitJoin here
      flushPendingMessages();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('chat:leave-room', { liveId: streamKey });
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      pendingMessageQueueRef.current = [];
    };
  }, [streamKey]);

  const sendMessage = (message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return;
    }

    const payload: QueuedMessage = {
      clientMessageId: createMessageId(),
      liveId: streamKey,
      message: trimmedMessage,
    };

    const socket = socketRef.current;
    if (socket && isConnected && socket.connected) {
      socket.emit('chat:send-message', payload);
      return;
    }

    pendingMessageQueueRef.current.push(payload);

    if (pendingMessageQueueRef.current.length > 50) {
      pendingMessageQueueRef.current = pendingMessageQueueRef.current.slice(-50);
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
