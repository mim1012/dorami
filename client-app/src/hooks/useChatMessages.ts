import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { ChatMessage } from '@/components/chat/types';

export function useChatMessages(socket: Socket | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const historySizeLimit = 100;
  const seenMessageKeysRef = useRef<Set<string>>(new Set());

  const buildMessageKey = (msg: ChatMessage) => {
    if (msg.clientMessageId) {
      return `client:${msg.clientMessageId}`;
    }
    return `id:${msg.id}`;
  };

  const toSafeDate = (value: unknown): Date => {
    if (value === undefined || value === null) return new Date();
    const date = new Date(value as string | number);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  };

  const normalizeMessage = (rawMessage: any): ChatMessage | null => {
    const message = rawMessage?.data?.message ?? rawMessage?.message;
    const id = rawMessage?.data?.id ?? rawMessage?.id;
    const userId = rawMessage?.data?.userId ?? rawMessage?.userId;

    if (!id || !message || !userId) {
      return null;
    }

    return {
      id: String(id),
      clientMessageId: rawMessage?.data?.clientMessageId ?? rawMessage?.clientMessageId,
      userId: String(userId),
      username: rawMessage?.data?.username ?? rawMessage?.username ?? 'Unknown',
      message: String(message),
      timestamp: toSafeDate(rawMessage?.data?.timestamp ?? rawMessage?.timestamp),
      isDeleted: false,
    };
  };

  const dedupeMessage = (normalized: ChatMessage, prev: ChatMessage[]) => {
    const key = buildMessageKey(normalized);
    if (seenMessageKeysRef.current.has(key) || prev.some((m) => buildMessageKey(m) === key)) {
      return prev;
    }

    seenMessageKeysRef.current.add(key);
    const next = [...prev, normalized];
    const sliced = next.length > historySizeLimit ? next.slice(-historySizeLimit) : next;
    seenMessageKeysRef.current = new Set(sliced.map(buildMessageKey));
    return sliced;
  };

  useEffect(() => {
    if (!socket) return;

    // Receive chat history on join/rejoin
    socket.on('chat:history', (data: any) => {
      const rawMessages: unknown[] = data.data?.messages || [];
      const historyMessages = rawMessages.reduce<ChatMessage[]>(
        (acc: ChatMessage[], raw: unknown) => {
          const normalized = normalizeMessage(raw);
          if (!normalized) return acc;

          const key = buildMessageKey(normalized);
          if (seenMessageKeysRef.current.has(key)) {
            return acc;
          }
          seenMessageKeysRef.current.add(key);
          acc.push(normalized);
          return acc;
        },
        [],
      );

      const normalizedHistory = historyMessages.sort(
        (a: ChatMessage, b: ChatMessage) => a.timestamp.getTime() - b.timestamp.getTime(),
      );
      const slicedHistory = normalizedHistory.slice(-historySizeLimit);
      setMessages(slicedHistory);
      seenMessageKeysRef.current = new Set(
        slicedHistory.map((message: ChatMessage) => buildMessageKey(message)),
      );
    });

    // Receive messages
    socket.on('chat:message', (data: any) => {
      const normalized = normalizeMessage(data);
      if (!normalized) return;

      setMessages((prev) => dedupeMessage(normalized, prev));
    });

    // Handle message deletion
    socket.on('chat:message-deleted', (data: any) => {
      const deletedId = data.data?.messageId || data.messageId;
      setMessages((prev) =>
        prev.map((msg) => (msg.id === deletedId ? { ...msg, isDeleted: true } : msg)),
      );
    });

    socket.io?.on('reconnect', () => {
      seenMessageKeysRef.current.clear();
    });

    return () => {
      socket.off('chat:history');
      socket.off('chat:message');
      socket.off('chat:message-deleted');
      socket.io?.off('reconnect');
    };
  }, [socket]);

  return { messages };
}
