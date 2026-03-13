'use client';

import { useState, useRef, useEffect } from 'react';
import ChatHeader from './ChatHeader';
import ChatMessageList from './ChatMessageList';
import ChatInput, { ChatInputHandle } from './ChatInput';

import { useChatConnection } from '@/hooks/useChatConnection';
import { useChatMessages } from '@/hooks/useChatMessages';

interface ChatOverlayProps {
  streamKey: string;
  position?: 'right' | 'bottom';
  className?: string;
}

export default function ChatOverlay({
  streamKey,
  position = 'right',
  className = '',
}: ChatOverlayProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const inputRef = useRef<ChatInputHandle>(null);

  const { socket, isConnected, userCount, sendMessage, deleteMessage } =
    useChatConnection(streamKey);
  const { messages } = useChatMessages(socket);

  // Check if user is admin
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        try {
          const parsed = JSON.parse(authStorage);
          const role = parsed?.state?.user?.role;
          setIsAdmin(role === 'ADMIN');
        } catch (e) {
          console.error('Failed to parse auth storage:', e);
        }
      }
    }
  }, []);

  const handleSendMessage = (message: string) => {
    if (message.trim()) {
      sendMessage(message);
    }
  };

  const positionClasses =
    position === 'right'
      ? 'absolute top-0 right-0 w-[320px] h-full' // Desktop
      : 'absolute bottom-0 left-0 w-full h-[40vh] pointer-events-none [&_form]:pointer-events-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto'; // Mobile

  const compact = position === 'bottom';

  return (
    <div
      className={`
        ${positionClasses}
        flex flex-col
        ${className}
      `}
    >
      <ChatHeader userCount={userCount} isConnected={isConnected} compact={compact} />

      <ChatMessageList
        messages={messages}
        compact={compact}
        maxMessages={compact ? 20 : undefined}
        isAdmin={isAdmin}
        onDeleteMessage={deleteMessage}
      />

      <ChatInput
        ref={inputRef}
        onSendMessage={handleSendMessage}
        disabled={!isConnected}
        compact={compact}
      />
    </div>
  );
}
