import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useSocket } from '../socket/use-socket';

interface UseStreamViewerReturn {
  viewerCount: number;
  isConnected: boolean;
}

export function useStreamViewer(streamKey: string, enabled: boolean = true): UseStreamViewerReturn {
  const { socket, isConnected } = useSocket(undefined, '/streaming');
  const [viewerCount, setViewerCount] = useState(0);

  useEffect(() => {
    if (!socket || !enabled || !streamKey) return;

    // Helper function to join the stream
    const joinStream = () => {
      socket.emit('stream:viewer:join', { streamKey });
    };

    // Initial join
    joinStream();

    // Rejoin after reconnection
    socket.on('connect', joinStream);

    // Listen for viewer count updates
    const handleViewerCount = (data: { streamKey: string; viewerCount: number }) => {
      if (data.streamKey === streamKey) {
        setViewerCount(data.viewerCount);
      }
    };

    socket.on('stream:viewer:update', handleViewerCount);

    // Leave the stream when unmounting
    return () => {
      socket.emit('stream:viewer:leave', { streamKey });
      socket.off('connect', joinStream);
      socket.off('stream:viewer:update', handleViewerCount);
    };
  }, [socket, streamKey, enabled]);

  return {
    viewerCount,
    isConnected,
  };
}
