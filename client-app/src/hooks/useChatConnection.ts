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
  const streamKeyRef = useRef(streamKey);
  streamKeyRef.current = streamKey;

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
      setConnectionStatus('disconnected');
      return;
    }

    const reconnectConfig = RECONNECT_CONFIG.chat;

    const buildSocket = (): Socket => {
      return io(`${SOCKET_URL}/chat`, {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: reconnectConfig.maxAttempts,
        reconnectionDelay: reconnectConfig.delays[0],
        reconnectionDelayMax: reconnectConfig.delays[reconnectConfig.delays.length - 1],
        randomizationFactor: reconnectConfig.jitterFactor,
        timeout: 20000,
      });
    };

    // Destroy current socket, refresh token, create new one with fresh cookies
    const handleAuthFailure = async () => {
      if (!mountedRef.current) return;

      authRetryCountRef.current += 1;
      if (authRetryCountRef.current > MAX_AUTH_RETRIES) {
        setConnectionStatus('failed');
        return;
      }

      // Destroy old socket
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      setConnectionStatus('reconnecting');

      const refreshed = await refreshAuthToken();
      if (!refreshed || !mountedRef.current) {
        setConnectionStatus('failed');
        return;
      }

      // Brief delay for cookie propagation
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (!mountedRef.current) return;

      // New socket picks up fresh cookies
      const fresh = buildSocket();
      socketRef.current = fresh;
      wireUp(fresh);
    };

    const wireUp = (socket: Socket) => {
      socket.on('connect', () => {
        socket.emit('chat:join-room', { liveId: streamKeyRef.current });
      });

      socket.on('connection:success', () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        setConnectionStatus('connected');
        authRetryCountRef.current = 0;
        flushPendingMessages();
      });

      socket.on('error', (err: { errorCode?: string; message?: string }) => {
        if (err.errorCode === 'AUTH_FAILED') {
          void handleAuthFailure();
        }
      });

      socket.on('disconnect', (reason) => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        setConnectionStatus('disconnected');

        if (reason === 'io server disconnect') {
          void handleAuthFailure();
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
    };

    setConnectionStatus('connecting');
    const socket = buildSocket();
    socketRef.current = socket;
    wireUp(socket);

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
  }, [streamKey, flushPendingMessages]);

  const sendMessage = (message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

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
