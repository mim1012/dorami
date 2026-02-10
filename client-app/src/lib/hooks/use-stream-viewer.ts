import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useSocket } from '../socket/use-socket';

interface UseStreamViewerReturn {
  viewerCount: number;
  isConnected: boolean;
}

export function useStreamViewer(streamKey: string, enabled: boolean = true): UseStreamViewerReturn {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const { socket, isConnected } = useSocket(token, '/streaming');
  const [viewerCount, setViewerCount] = useState(0);

  useEffect(() => {
    if (!socket || !enabled || !streamKey) return;

    // Join the stream as a viewer
    socket.emit('stream:viewer:join', { streamKey });

    // Listen for viewer count updates
    const handleViewerCount = (data: { streamKey: string; viewerCount: number }) => {
      if (data.streamKey === streamKey) {
        setViewerCount(data.viewerCount);
      }
    };

    socket.on('stream:viewer-count', handleViewerCount);

    // Leave the stream when unmounting
    return () => {
      socket.emit('stream:viewer:leave', { streamKey });
      socket.off('stream:viewer-count', handleViewerCount);
    };
  }, [socket, streamKey, enabled]);

  return {
    viewerCount,
    isConnected,
  };
}
