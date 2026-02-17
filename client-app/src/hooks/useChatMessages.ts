import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { ChatMessage } from '@/components/chat/types';

export function useChatMessages(socket: Socket | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!socket) return;

    // Receive chat history on join/rejoin
    socket.on('chat:history', (data: any) => {
      const historyMessages: ChatMessage[] = (data.data?.messages || []).map((m: any) => ({
        id: m.id || `${Date.now()}-${Math.random()}`,
        userId: m.userId,
        username: m.username || 'Unknown',
        message: m.message,
        timestamp: new Date(m.timestamp),
        isDeleted: false,
      }));
      setMessages(historyMessages);
    });

    // Receive messages
    socket.on('chat:message', (data: any) => {
      const newMessage: ChatMessage = {
        id: data.data?.id || data.id || `${Date.now()}-${Math.random()}`,
        userId: data.data?.userId || data.userId,
        username: data.data?.username || data.username || 'Unknown',
        message: data.data?.message || data.message,
        timestamp: new Date(data.data?.timestamp || data.timestamp),
        isDeleted: false,
      };

      setMessages((prev) => [...prev.slice(-99), newMessage]);
    });

    // Handle message deletion
    socket.on('chat:message-deleted', (data: any) => {
      const deletedId = data.data?.messageId || data.messageId;
      setMessages((prev) =>
        prev.map((msg) => (msg.id === deletedId ? { ...msg, isDeleted: true } : msg)),
      );
    });

    return () => {
      socket.off('chat:history');
      socket.off('chat:message');
      socket.off('chat:message-deleted');
    };
  }, [socket]);

  return { messages };
}
