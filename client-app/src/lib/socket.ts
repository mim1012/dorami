import { io } from 'socket.io-client';

const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? '';

export const socketInstance = wsUrl
  ? io(wsUrl, {
      withCredentials: true,
      reconnectionAttempts: 3,
      reconnection: true,
      reconnectionDelay: 1000,
    })
  : null;
