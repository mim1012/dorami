import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { refreshAuthToken } from '@/lib/auth/token-manager';
import { RECONNECT_CONFIG } from '@/lib/socket/reconnect-config';
import { SOCKET_URL } from '@/lib/config/socket-url';

interface QueuedMessage {
  clientMessageId: string;
  liveId: string;
  message: string;
}

export type ChatConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'failed';

const MAX_AUTH_RETRIES = 3;

export function useChatConnection(streamKey: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ChatConnectionStatus>('disconnected');
  const [userCount, setUserCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const pendingMessageQueueRef = useRef<QueuedMessage[]>([]);
  const authRetryCountRef = useRef(0);
  const mountedRef = useRef(true);

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

  // Create a fresh socket instance (picks up latest cookies)
  const createSocket = useCallback(() => {
    const reconnectConfig = RECONNECT_CONFIG.chat;
    const chatUrl = `${SOCKET_URL}/chat`;

    return io(chatUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: reconnectConfig.maxAttempts,
      reconnectionDelay: reconnectConfig.delays[0],
      reconnectionDelayMax: reconnectConfig.delays[reconnectConfig.delays.length - 1],
      randomizationFactor: reconnectConfig.jitterFactor,
      timeout: 20000,
    });
  }, []);

  // Destroy old socket, refresh token, create new socket with fresh cookies
  const handleAuthFailureAndReconnect = useCallback(async () => {
    if (!mountedRef.current || !streamKey) return;

    authRetryCountRef.current += 1;
    if (authRetryCountRef.current > MAX_AUTH_RETRIES) {
      setConnectionStatus('failed');
      return;
    }

    // Destroy old socket completely
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setConnectionStatus('reconnecting');

    // Refresh token — this sets new httpOnly cookies via /api/auth/refresh
    const refreshed = await refreshAuthToken();
    if (!refreshed || !mountedRef.current) {
      setConnectionStatus('failed');
      return;
    }

    // Small delay for cookie to propagate
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (!mountedRef.current) return;

    // Create brand new socket — picks up fresh cookies
    const newSocket = createSocket();
    socketRef.current = newSocket;
    attachSocketListeners(newSocket);
  }, [streamKey, createSocket, flushPendingMessages]);

  // Attach all event listeners to a socket instance
  const attachSocketListeners = useCallback(
    (socket: Socket) => {
      const emitJoin = () => {
        socket.emit('chat:join-room', { liveId: streamKey });
      };

      socket.on('connect', () => {
        emitJoin();
      });

      socket.on('connection:success', () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        setConnectionStatus('connected');
        authRetryCountRef.current = 0; // Reset on success
        flushPendingMessages();
      });

      socket.on('error', (err: { errorCode?: string; message?: string }) => {
        // AUTH_FAILED → destroy socket, refresh, reconnect with fresh cookies
        if (err.errorCode === 'AUTH_FAILED') {
          void handleAuthFailureAndReconnect();
        }
      });

      socket.on('disconnect', (reason) => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        setConnectionStatus('disconnected');

        if (reason === 'io server disconnect') {
          // Server kicked us — likely auth failure, handled by 'error' event above
          // If error event didn't fire, try reconnect as fallback
          void handleAuthFailureAndReconnect();
        }
      });

      socket.on('connect_error', () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
      });

      socket.on('chat:user-joined', () => {
        setUserCount((prev) => prev + 1);
      });

      socket.on('chat:user-left', () => {
        setUserCount((prev) => Math.max(0, prev - 1));
      });

      socket.io.on('reconnect_attempt', () => {
        if (mountedRef.current) setConnectionStatus('reconnecting');
      });

      socket.io.on('reconnect_failed', () => {
        if (mountedRef.current) setConnectionStatus('failed');
      });

      socket.io.on('reconnect', () => {
        flushPendingMessages();
      });
    },
    [streamKey, flushPendingMessages, handleAuthFailureAndReconnect],
  );

  useEffect(() => {
    mountedRef.current = true;
    authRetryCountRef.current = 0;

    if (!streamKey) {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      pendingMessageQueueRef.current = [];
      setIsConnected(false);
      return;
    }

    setConnectionStatus('connecting');
    const socket = createSocket();
    socketRef.current = socket;
    attachSocketListeners(socket);

    return () => {
      mountedRef.current = false;
      if (socketRef.current) {
        socketRef.current.emit('chat:leave-room', { liveId: streamKey });
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      pendingMessageQueueRef.current = [];
    };
  }, [streamKey, createSocket, attachSocketListeners]);

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
    socketRef,
    isConnected,
    connectionStatus,
    userCount,
    sendMessage,
    deleteMessage,
  };
}
