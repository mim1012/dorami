import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { isAuthError, recoverSocketAuth } from '@/lib/auth/token-manager';
import { RECONNECT_CONFIG } from '@/lib/socket/reconnect-config';
import { SOCKET_URL } from '@/lib/config/socket-url';
import { shouldUseAuthenticatedChatConnection, type ChatConnectionSuccessPayload } from './chat-connection.utils';

interface QueuedMessage {
  clientMessageId: string;
  liveId: string;
  message: string;
}

export interface UseChatConnectionResult {
  socketRef: React.MutableRefObject<Socket | null>;
  isConnected: boolean;
  connectionStatus: ChatConnectionStatus;
  userCount: number;
  canComposeMessages: boolean;
  sendMessage: (message: string) => void;
  deleteMessage: (messageId: string) => void;
}

export type ChatConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'failed';

interface UseChatConnectionOptions {
  enabled?: boolean;
}

export function useChatConnection(
  streamKey: string,
  { enabled = true }: UseChatConnectionOptions = {},
) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ChatConnectionStatus>('disconnected');
  const [userCount, setUserCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const pendingMessageQueueRef = useRef<QueuedMessage[]>([]);
  const authRefreshAttemptedRef = useRef(false);

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
    if (!streamKey || !enabled) {
      // Clean up any stale socket and queue from previous renders
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      pendingMessageQueueRef.current = [];
      authRefreshAttemptedRef.current = false;
      setIsConnected(false);
      setConnectionStatus('disconnected');
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
    setConnectionStatus('connecting');

    const emitJoin = () => {
      socket.emit('chat:join-room', { liveId: streamKey });
    };

    const handleAuthReconnect = async () => {
      const refreshed = await recoverSocketAuth();
      if (refreshed) {
        socket.connect();
      } else {
        socket.disconnect();
      }
    };

    // Connection events
    socket.on('connect', () => {
      // Don't set connected yet — wait for server auth confirmation
      // Join chat room (server will authenticate in connection handler)
      emitJoin();
    });

    // Server sends this after successful authentication
    socket.on('connection:success', async (payload?: ChatConnectionSuccessPayload) => {
      if (!shouldUseAuthenticatedChatConnection(payload)) {
        setIsConnected(false);
        setConnectionStatus('connecting');

        if (!authRefreshAttemptedRef.current) {
          authRefreshAttemptedRef.current = true;
          await handleAuthReconnect();
        }
        return;
      }

      setIsConnected(true);
      setConnectionStatus('connected');
      authRefreshAttemptedRef.current = false;
      flushPendingMessages();
    });

    // Server sends auth error details before disconnecting
    socket.on('error', (err: { errorCode?: string; message?: string }) => {
      console.error('[Chat WebSocket] server error:', err.errorCode, err.message);
    });

    socket.on('disconnect', async (reason) => {
      setIsConnected(false);
      setConnectionStatus('disconnected');

      // "io server disconnect" means the server forcefully closed the connection
      // (e.g., auth failure). Attempt token refresh and reconnect once.
      if (reason === 'io server disconnect' && !authRefreshAttemptedRef.current) {
        authRefreshAttemptedRef.current = true;
        await handleAuthReconnect();
      }
    });

    socket.on('connect_error', async (error) => {
      setIsConnected(false);

      if (!socket.disconnected) {
        return;
      }

      if (isAuthError(error as Error)) {
        if (authRefreshAttemptedRef.current) {
          // Already tried a refresh — stop reconnecting to prevent infinite loop
          socket.disconnect();
          return;
        }
        authRefreshAttemptedRef.current = true;
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

    socket.io.on('reconnect_attempt', () => {
      setConnectionStatus('reconnecting');
    });

    socket.io.on('reconnect_failed', () => {
      setConnectionStatus('failed');
    });

    socket.io.on('reconnect', () => {
      // Wait for authenticated connection:success before flushing queued messages.
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('chat:leave-room', { liveId: streamKey });
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      pendingMessageQueueRef.current = [];
    };
  }, [enabled, streamKey]);

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
    canComposeMessages: isConnected || connectionStatus === 'reconnecting',
    sendMessage,
    deleteMessage,
  };
}
