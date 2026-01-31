import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './use-auth';

export interface ChatMessage {
  id: string;
  userId: string;
  message: string;
  liveId: string;
  timestamp: string;
}

interface UseChatOptions {
  liveId: string;
  enabled?: boolean;
}

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (message: string) => void;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

export function useChat({ liveId, enabled = true }: UseChatOptions): UseChatReturn {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled || !user || !liveId) {
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      setError('No authentication token found');
      return;
    }

    setIsConnecting(true);
    setError(null);

    // Connect to chat namespace
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const wsUrl = apiUrl.replace('/api', '').replace('http', 'ws');

    const socket = io(`${wsUrl}/chat`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('✅ Connected to chat server');
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);

      // Join the live room
      socket.emit('chat:join-room', { liveId });
    });

    socket.on('connection:success', (data: any) => {
      console.log('✅ Connection success:', data);
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from chat server');
      setIsConnected(false);
    });

    socket.on('connect_error', (err: Error) => {
      console.error('❌ Connection error:', err);
      setError('Failed to connect to chat server');
      setIsConnecting(false);
    });

    socket.on('error', (data: any) => {
      console.error('❌ Socket error:', data);
      setError(data.message || 'An error occurred');
      setIsConnecting(false);
    });

    // Chat event handlers
    socket.on('chat:message', (data: any) => {
      console.log('💬 New message:', data);
      if (data.type === 'chat:message' && data.data) {
        const newMessage: ChatMessage = data.data;
        setMessages((prev) => [...prev, newMessage]);
      }
    });

    socket.on('chat:user-joined', (data: any) => {
      console.log('👋 User joined:', data);
    });

    socket.on('chat:user-left', (data: any) => {
      console.log('👋 User left:', data);
    });

    // Cleanup on unmount
    return () => {
      if (socket.connected) {
        socket.emit('chat:leave-room', { liveId });
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [liveId, user, enabled]);

  const sendMessage = useCallback((message: string) => {
    if (!socketRef.current || !socketRef.current.connected) {
      console.error('❌ Cannot send message: not connected');
      setError('Not connected to chat server');
      return;
    }

    if (!message.trim()) {
      return;
    }

    socketRef.current.emit('chat:send-message', {
      liveId,
      message: message.trim(),
    });
  }, [liveId]);

  return {
    messages,
    sendMessage,
    isConnected,
    isConnecting,
    error,
  };
}
