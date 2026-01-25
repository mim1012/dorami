import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

export class SocketClient {
  private socket: Socket | null = null;
  private token: string | null = null;

  connect(token: string, namespace: string = 'chat'): Socket {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return this.socket;
    }

    this.token = token;

    this.socket = io(`${SOCKET_URL}/${namespace}`, {
      auth: {
        token: this.token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,      // 1 second
      reconnectionDelayMax: 5000,   // 5 seconds (exponential backoff)
      timeout: 20000,
    });

    this.setupEventListeners();

    return this.socket;
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('👋 WebSocket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
    });

    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}...`);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed after max attempts');
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event: string, data: any): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected. Cannot emit event:', event);
      return;
    }

    this.socket.emit(event, data);
  }

  on(event: string, callback: (data: any) => void): void {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (data: any) => void): void {
    this.socket?.off(event, callback);
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

// Singleton instance
export const socketClient = new SocketClient();
