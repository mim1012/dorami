import { io, Socket } from 'socket.io-client';
import { RECONNECT_CONFIG, ReconnectProfile } from './reconnect-config';
import { SOCKET_URL } from '../config/socket-url';

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
    const socket = io(this.buildUrl(namespaceKey), {
      ...(normalizedToken ? { auth: { token: normalizedToken } } : {}),
      withCredentials: true,
      transports: ['websocket', 'polling'],
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
      console.log(`✅ WebSocket connected: ${namespace} (${socket.id})`);
      clearQueue();
    });

    socket.on('disconnect', (reason) => {
      console.warn(`👋 WebSocket disconnected (${namespace}): ${reason}`);
    });

    socket.on('connect_error', (error) => {
      console.error(`❌ WebSocket connect_error (${namespace}):`, error);
      state.reconnectAttempts += 1;

      if (state.reconnectAttempts >= config.maxAttempts) {
        console.error(`❌ Max reconnection attempts reached for ${namespace}`);
      }
    });

    socket.on('error', (error) => {
      console.error(`❌ Socket error (${namespace}):`, error);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Reconnected (${namespace}) after ${attemptNumber} attempts`);
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnect attempt ${attemptNumber}/${config.maxAttempts} (${namespace})`);
    });

    socket.on('reconnect_failed', () => {
      console.error(`❌ Reconnection failed for ${namespace}`);
    });
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
