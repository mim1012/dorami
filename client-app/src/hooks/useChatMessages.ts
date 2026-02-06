import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { ChatMessage } from '@/components/chat/types';

const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: 'mock-1',
    userId: 'user-1',
    username: '민지',
    message: '와우 드디어 시작했네요! 🎉',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    isDeleted: false,
  },
  {
    id: 'mock-2',
    userId: 'user-2',
    username: '지훈',
    message: '저 가방 너무 예뻐요!',
    timestamp: new Date(Date.now() - 4 * 60 * 1000),
    isDeleted: false,
  },
  {
    id: 'mock-3',
    userId: 'user-3',
    username: '수진',
    message: '가격이 얼마에요?',
    timestamp: new Date(Date.now() - 3 * 60 * 1000),
    isDeleted: false,
  },
  {
    id: 'mock-4',
    userId: 'user-4',
    username: '현우',
    message: '할인 언제까지에요?',
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
    isDeleted: false,
  },
  {
    id: 'mock-5',
    userId: 'user-5',
    username: '예진',
    message: '색상 다른 것도 있나요?',
    timestamp: new Date(Date.now() - 1 * 60 * 1000),
    isDeleted: false,
  },
  {
    id: 'mock-6',
    userId: 'user-6',
    username: '동현',
    message: '장바구니에 담았어요! 🛒',
    timestamp: new Date(Date.now() - 30 * 1000),
    isDeleted: false,
  },
];

export function useChatMessages(socket: Socket | null) {
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES);

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
