'use client';

import { useRef } from 'react';
import ChatHeader from './ChatHeader';
import ChatMessageList from './ChatMessageList';
import ChatInput, { ChatInputHandle } from './ChatInput';

import { useChatConnection } from '@/hooks/useChatConnection';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useAuthStore } from '@/lib/store/auth';

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
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const inputRef = useRef<ChatInputHandle>(null);

  const { socketRef, isConnected, connectionStatus, userCount, sendMessage, deleteMessage } =
    useChatConnection(streamKey);
  const { messages } = useChatMessages(socketRef);

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
        connectionStatus={connectionStatus}
        compact={compact}
      />
    </div>
  );
}
