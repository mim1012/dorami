import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ReconnectionCircuitBreaker } from '@/lib/socket/circuit-breaker';
import { RECONNECT_CONFIG } from '@/lib/socket/reconnect-config';
import { refreshAuthToken, isAuthError, forceLogout } from '@/lib/auth/token-manager';
import { SOCKET_URL } from '@/lib/config/socket-url';

export function useChatConnection(streamKey: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  // Circuit Breaker 인스턴스: config 값 참조
  // useRef로 보관해 렌더링 사이에도 상태를 유지한다
  const chatConfig = RECONNECT_CONFIG.chat;
  const circuitBreakerRef = useRef(
    new ReconnectionCircuitBreaker(
      chatConfig.circuitBreakerThreshold,
      chatConfig.circuitBreakerCooldownMs,
    ),
  );

  // 마지막 connect_error가 인증(토큰 만료) 에러였는지 추적
  const lastAuthErrorRef = useRef(false);

  useEffect(() => {
    // WebSocket connection - connect to /chat namespace
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const socket = io(`${SOCKET_URL}/chat`, {
      transports: ['websocket'],
      withCredentials: true,
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: chatConfig.maxAttempts,
      reconnectionDelay: chatConfig.delays[0],
      reconnectionDelayMax: chatConfig.delays[chatConfig.delays.length - 1],
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      if (process.env.NODE_ENV !== 'production') console.log('[Chat] WebSocket connected');

      // 연결 성공 → 실패 카운터 및 인증 에러 플래그 초기화
      circuitBreakerRef.current.recordSuccess();
      lastAuthErrorRef.current = false;
      setIsConnected(true);

      // Join chat room (gateway expects liveId)
      socket.emit('chat:join-room', { liveId: streamKey });
    });

    // Re-join room after reconnection (network switch, background recovery)
    socket.io.on('reconnect', () => {
      if (process.env.NODE_ENV !== 'production') console.log('[Chat] Reconnected, re-joining room');
      socket.emit('chat:join-room', { liveId: streamKey });
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
            `[Chat] Circuit Breaker OPEN — 재연결 차단. ` +
              `${Math.ceil(cooldownRemainingMs / 1000)}초 후 재시도 가능`,
          );
        }
        socket.disconnect();
        return;
      }

      // 마지막 인증 에러 여부 확인 후 토큰 갱신 시도
      if (lastAuthErrorRef.current) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[Chat] 인증 에러 감지 — 토큰 갱신 시도');
        }
        const refreshed = await refreshAuthToken();
        if (!refreshed) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[Chat] 토큰 갱신 실패 — 강제 로그아웃');
          }
          circuitBreakerRef.current.recordFailure();
          socket.disconnect();
          forceLogout();
          return;
        }
        lastAuthErrorRef.current = false;
        if (process.env.NODE_ENV !== 'production') {
          console.log('[Chat] 토큰 갱신 성공 — 재연결 진행');
        }
      }
    });

    socket.on('disconnect', () => {
      if (process.env.NODE_ENV !== 'production') console.log('[Chat] WebSocket disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Chat] Connection error:', error);

      // 인증 에러(토큰 만료 등) 여부를 기록해 다음 reconnect_attempt에서 갱신 시도
      if (isAuthError(error)) {
        lastAuthErrorRef.current = true;
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Chat] 인증 에러 감지 — 다음 재연결 시 토큰 갱신 예정');
        }
      }

      // 연결 실패를 Circuit Breaker에 기록한다
      circuitBreakerRef.current.recordFailure();
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
