import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { isAuthError, recoverSocketAuth } from '@/lib/auth/token-manager';
import { RECONNECT_CONFIG } from '@/lib/socket/reconnect-config';
import { SOCKET_URL } from '@/lib/config/socket-url';

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
  const [isSocketAuthenticated, setIsSocketAuthenticated] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const pendingMessageQueueRef = useRef<QueuedMessage[]>([]);
  const authRecoveryAttemptedRef = useRef(false);
  const hasJoinedRoomRef = useRef(false);
  const joinRetryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      setIsConnected(false);
      setIsSocketAuthenticated(false);
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

    const stopJoinRetry = () => {
      if (joinRetryTimerRef.current) {
        clearInterval(joinRetryTimerRef.current);
        joinRetryTimerRef.current = null;
      }
    };

    const startJoinRetry = () => {
      hasJoinedRoomRef.current = false;
      stopJoinRetry();
      emitJoin();
      joinRetryTimerRef.current = setInterval(() => {
        if (!socket.connected || hasJoinedRoomRef.current) {
          stopJoinRetry();
          return;
        }
        emitJoin();
      }, 1000);
    };

    const tryRecoverAuthenticatedSocket = async () => {
      if (authRecoveryAttemptedRef.current) {
        return;
      }

      authRecoveryAttemptedRef.current = true;
      const recovered = await recoverSocketAuth();
      if (!recovered) {
        return;
      }

      if (socket.connected) {
        socket.disconnect();
      }
      socket.connect();
    };

    // Connection events
    socket.on('connect', () => {
      setConnectionStatus('connecting');
    });

    // Server sends this after successful authentication
    socket.on('connection:success', async (payload?: { data?: { authenticated?: boolean } }) => {
      const authenticated = !!payload?.data?.authenticated;
      setIsConnected(true);
      setIsSocketAuthenticated(authenticated);
      setConnectionStatus('connected');

      if (authenticated) {
        authRecoveryAttemptedRef.current = false;
        startJoinRetry();
        flushPendingMessages();
        return;
      }

      await tryRecoverAuthenticatedSocket();
    });

    // Server sends auth error details before disconnecting
    socket.on('error', async (err: { errorCode?: string; message?: string }) => {
      console.error('[Chat WebSocket] server error:', err.errorCode, err.message);
      if (isAuthError((err as unknown as Error) ?? new Error(err.message ?? ''))) {
        await tryRecoverAuthenticatedSocket();
      }
    });

    socket.on('disconnect', async () => {
      setIsConnected(false);
      setIsSocketAuthenticated(false);
      setConnectionStatus('disconnected');
      hasJoinedRoomRef.current = false;
      stopJoinRetry();
    });

    socket.on('connect_error', async (error) => {
      setIsConnected(false);
      setIsSocketAuthenticated(false);

      if (isAuthError(error as Error)) {
        await tryRecoverAuthenticatedSocket();
      }
    });

    socket.on('chat:join-room:success', () => {
      hasJoinedRoomRef.current = true;
      stopJoinRetry();
      flushPendingMessages();
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
      stopJoinRetry();
      hasJoinedRoomRef.current = false;
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
    if (socket && isConnected && isSocketAuthenticated && hasJoinedRoomRef.current && socket.connected) {
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
    canComposeMessages:
      isSocketAuthenticated && (isConnected || connectionStatus === 'reconnecting'),
    sendMessage,
    deleteMessage,
  };
}
