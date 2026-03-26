import { io, Socket } from 'socket.io-client';
import { RECONNECT_CONFIG, ReconnectProfile } from './reconnect-config';
import { SOCKET_URL } from '../config/socket-url';
import { isAuthError, refreshAuthToken } from '../auth/token-manager';
import { isInAppBrowser } from '../hooks/use-in-app-browser';

type SocketNamespace = string;
interface QueuedEmit {
  event: string;
  args: unknown[];
}

interface SocketState {
  socket: Socket;
  namespace: string;
  token: string | null;
  refCount: number;
  reconnectAttempts: number;
  authRefreshAttempted: boolean;
  queue: QueuedEmit[];
}

export class SocketClient {
  private readonly sockets = new Map<SocketNamespace, SocketState>();
  private readonly maxQueueSize = 100;

  connect(token: string | null | undefined, namespace: string = 'chat'): Socket {
    const namespaceKey = this.normalizeNamespace(namespace);
    const normalizedToken = token ?? null;
    const existing = this.sockets.get(namespaceKey);

    if (existing) {
      if (existing.token !== normalizedToken) {
        existing.socket.disconnect();
        this.sockets.delete(namespaceKey);
      } else {
        existing.refCount += 1;
        if (!existing.socket.connected) {
          existing.socket.connect();
        }

        return existing.socket;
      }
    }

    const config = this.getReconnectProfile(namespaceKey);
    // In-app browsers (Instagram, Facebook, etc.) may block WebSocket upgrades.
    // Start with polling for reliability; the server can still upgrade if supported.
    const inApp = typeof navigator !== 'undefined' && isInAppBrowser(navigator.userAgent);
    const transports: ['polling', 'websocket'] | ['websocket', 'polling'] = inApp
      ? ['polling', 'websocket']
      : ['websocket', 'polling'];
    const socket = io(this.buildUrl(namespaceKey), {
      ...(normalizedToken ? { auth: { token: normalizedToken } } : {}),
      withCredentials: true,
      transports,
      reconnection: true,
      reconnectionAttempts: config.maxAttempts,
      reconnectionDelay: config.delays[0],
      reconnectionDelayMax: config.delays[config.delays.length - 1],
      randomizationFactor: config.jitterFactor,
      timeout: 20000,
      autoConnect: true,
    });

    const state: SocketState = {
      socket,
      namespace: namespaceKey,
      token: normalizedToken,
      refCount: 1,
      reconnectAttempts: 0,
      authRefreshAttempted: false,
      queue: [],
    };

    this.setupEventListeners(state);
    this.sockets.set(namespaceKey, state);
    return socket;
  }

  private setupEventListeners(state: SocketState) {
    const { socket, namespace } = state;
    const config = this.getReconnectProfile(namespace);

    const clearQueue = () => {
      if (!socket.connected || state.queue.length === 0) return;

      while (state.queue.length > 0) {
        const item = state.queue.shift();
        if (!item) continue;
        socket.emit(item.event, ...item.args);
      }
    };

    socket.on('connect', () => {
      state.reconnectAttempts = 0;
      state.authRefreshAttempted = false;
      if (process.env.NODE_ENV !== 'production') {
        console.log(`✅ WebSocket connected: ${namespace} (${socket.id})`);
      }
      clearQueue();
    });

    socket.on('disconnect', (reason) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`👋 WebSocket disconnected (${namespace}): ${reason}`);
      }
    });

    socket.on('connect_error', async (error) => {
      console.error(`❌ WebSocket connect_error (${namespace}):`, error);

      // Handle auth errors: refresh token, then create NEW socket (old one has stale cookies)
      if (isAuthError(error)) {
        if (state.authRefreshAttempted) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(
              `🚫 Auth error on ${namespace} after token refresh — stopping reconnection`,
            );
          }
          socket.disconnect();
          return;
        }

        state.authRefreshAttempted = true;
        if (process.env.NODE_ENV !== 'production') {
          console.log(`🔄 Auth error detected for ${namespace}, attempting token refresh...`);
        }
        const success = await refreshAuthToken();
        if (success) {
          if (process.env.NODE_ENV !== 'production') {
            console.log(
              `✅ Token refreshed for ${namespace}, recreating socket with fresh cookies...`,
            );
          }
          // Destroy old socket and create new one to pick up fresh cookies
          this.recreateSocket(namespace, state);
          return;
        }

        if (process.env.NODE_ENV !== 'production') {
          console.warn(`🚫 Token refresh failed for ${namespace} — stopping reconnection`);
        }
        socket.disconnect();
        return;
      }

      state.reconnectAttempts += 1;

      if (state.reconnectAttempts >= config.maxAttempts) {
        console.error(`❌ Max reconnection attempts reached for ${namespace}`);
      }
    });

    socket.on('error', (error) => {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`❌ Socket error (${namespace}):`, error);
      }
    });

    socket.on('reconnect', (attemptNumber) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🔄 Reconnected (${namespace}) after ${attemptNumber} attempts`);
      }
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🔄 Reconnect attempt ${attemptNumber}/${config.maxAttempts} (${namespace})`);
      }
    });

    socket.on('reconnect_failed', () => {
      console.error(`❌ Reconnection failed for ${namespace}`);
    });
  }

  /**
   * Destroy old socket and create a new one with fresh cookies.
   * Called after token refresh so the new handshake picks up the updated accessToken cookie.
   */
  private recreateSocket(namespace: string, oldState: SocketState) {
    const namespaceKey = this.normalizeNamespace(namespace);
    const { refCount, token, queue } = oldState;

    // Destroy old socket
    oldState.socket.removeAllListeners();
    oldState.socket.disconnect();
    this.sockets.delete(namespaceKey);

    // Create new socket (picks up fresh cookies)
    const config = this.getReconnectProfile(namespaceKey);
    const inApp = typeof navigator !== 'undefined' && isInAppBrowser(navigator.userAgent);
    const transports: ['polling', 'websocket'] | ['websocket', 'polling'] = inApp
      ? ['polling', 'websocket']
      : ['websocket', 'polling'];
    const newSocket = io(this.buildUrl(namespaceKey), {
      ...(token ? { auth: { token } } : {}),
      withCredentials: true,
      transports,
      reconnection: true,
      reconnectionAttempts: config.maxAttempts,
      reconnectionDelay: config.delays[0],
      reconnectionDelayMax: config.delays[config.delays.length - 1],
      randomizationFactor: config.jitterFactor,
      timeout: 20000,
      autoConnect: true,
    });

    const newState: SocketState = {
      socket: newSocket,
      namespace: namespaceKey,
      token,
      refCount,
      reconnectAttempts: 0,
      authRefreshAttempted: false,
      queue,
    };

    this.setupEventListeners(newState);
    this.sockets.set(namespaceKey, newState);
  }

  disconnect(namespace: string = 'chat') {
    const namespaceKey = this.normalizeNamespace(namespace);
    const state = this.sockets.get(namespaceKey);
    if (!state) return;

    state.refCount -= 1;
    if (state.refCount > 0) {
      return;
    }

    state.socket.disconnect();
    this.sockets.delete(namespaceKey);
  }

  emit(namespace: string, event: string, ...args: unknown[]) {
    const namespaceKey = this.normalizeNamespace(namespace);
    const state = this.sockets.get(namespaceKey);
    if (!state) return;

    if (state.socket.connected) {
      state.socket.emit(event, ...args);
      return;
    }

    state.queue.push({ event, args });
    if (state.queue.length > this.maxQueueSize) {
      state.queue.shift();
    }
  }

  on(namespace: string, event: string, callback: (...args: unknown[]) => void) {
    const state = this.sockets.get(this.normalizeNamespace(namespace));
    if (!state) return;
    state.socket.on(event, callback);
  }

  off(namespace: string, event: string, callback?: (...args: unknown[]) => void) {
    const state = this.sockets.get(this.normalizeNamespace(namespace));
    if (!state) return;
    state.socket.off(event, callback);
  }

  getSocket(namespace: string = 'chat'): Socket | null {
    return this.sockets.get(this.normalizeNamespace(namespace))?.socket ?? null;
  }

  private normalizeNamespace(namespace: string): string {
    if (!namespace || namespace === '/') return '';
    return namespace.startsWith('/') ? namespace.slice(1) : namespace;
  }

  private buildUrl(namespace: string): string {
    if (!namespace) {
      return SOCKET_URL;
    }
    return `${SOCKET_URL}/${namespace}`;
  }

  private getReconnectProfile(namespace: string): ReconnectProfile {
    if (namespace === 'streaming') {
      return RECONNECT_CONFIG.streaming;
    }
    if (namespace === 'chat') {
      return RECONNECT_CONFIG.chat;
    }
    return RECONNECT_CONFIG.default;
  }
}

// Singleton instance
export const socketClient = new SocketClient();
