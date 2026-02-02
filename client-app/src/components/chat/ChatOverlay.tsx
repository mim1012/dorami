'use client';

import { useState, useRef } from 'react';
import ChatHeader from './ChatHeader';
import ChatMessageList from './ChatMessageList';
import ChatInput, { ChatInputHandle } from './ChatInput';
import EmojiPicker from './EmojiPicker';
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<ChatInputHandle>(null);

  const { socket, isConnected, userCount, sendMessage } = useChatConnection(streamKey);
  const { messages } = useChatMessages(socket);

  const handleSendMessage = (message: string) => {
    if (message.trim()) {
      sendMessage(message);
      setShowEmojiPicker(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    // Insert emoji into input
    if (inputRef.current) {
      inputRef.current.insertEmoji(emoji);
    }
    setShowEmojiPicker(false);
  };

  const positionClasses =
    position === 'right'
      ? 'absolute top-0 right-0 w-[320px] h-full' // Desktop
      : 'absolute bottom-0 left-0 w-full h-[40vh]'; // Mobile

  const compact = position === 'bottom';

  return (
    <div
      className={`
        ${positionClasses}
        bg-black/50
        backdrop-blur-md
        border-l border-white/10
        flex flex-col
        ${className}
      `}
    >
      <ChatHeader userCount={userCount} isConnected={isConnected} compact={compact} />

      <ChatMessageList
        messages={messages}
        compact={compact}
        maxMessages={compact ? 20 : undefined}
      />

      {showEmojiPicker && (
        <EmojiPicker onEmojiSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
      )}

      <ChatInput
        ref={inputRef}
        onSendMessage={handleSendMessage}
        onToggleEmoji={() => setShowEmojiPicker(!showEmojiPicker)}
        disabled={!isConnected}
        compact={compact}
        emojiPickerOpen={showEmojiPicker}
      />
    </div>
  );
}
