import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { ChatMessage } from '@/components/chat/types';

export function useChatMessages(socket: Socket | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!socket) return;

    // Receive messages
    socket.on('chat:message', (data: any) => {
      const newMessage: ChatMessage = {
        id: data.id || `${Date.now()}-${Math.random()}`,
        userId: data.userId,
        username: data.username,
        message: data.message,
        timestamp: new Date(data.timestamp),
        isDeleted: false,
      };

      setMessages((prev) => [...prev, newMessage]);
    });

    return () => {
      socket.off('chat:message');
    };
  }, [socket]);

  return { messages };
}
