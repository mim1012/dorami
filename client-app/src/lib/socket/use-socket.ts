'use client';

import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { socketClient } from './socket-client';

export function useSocket(token: string | null, namespace: string = 'chat') {
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      socketClient.disconnect();
      setIsConnected(false);
      setSocket(null);
      return;
    }

    const socketInstance = socketClient.connect(token, namespace);
    setSocket(socketInstance);

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socketInstance.on('connect', handleConnect);
    socketInstance.on('disconnect', handleDisconnect);

    // Cleanup
    return () => {
      socketInstance.off('connect', handleConnect);
      socketInstance.off('disconnect', handleDisconnect);
    };
  }, [token, namespace]);

  return { socket, isConnected };
}
