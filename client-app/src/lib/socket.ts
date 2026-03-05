import { io } from 'socket.io-client';
import { RECONNECT_CONFIG } from './socket/reconnect-config';

const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? '';
const config = RECONNECT_CONFIG.default;

export const socketInstance = wsUrl
  ? io(wsUrl, {
      withCredentials: true,
      reconnectionAttempts: config.maxAttempts,
      reconnectionDelay: config.delays[0],
      reconnectionDelayMax: config.delays[config.delays.length - 1],
      randomizationFactor: config.jitterFactor,
      transports: ['websocket', 'polling'],
      reconnection: true,
    })
  : null;
