import React from 'react';
import { ChatMessage as ChatMessageType } from './types';

interface ChatMessageProps {
  message: ChatMessageType;
  compact?: boolean;
}

function ChatMessage({ message, compact = false }: ChatMessageProps) {
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className={`animate-fade-in ${compact ? 'mb-2 px-3 py-2' : 'mb-3'}`}>
      {/* Username + Timestamp */}
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className={`text-hot-pink font-semibold ${
          compact ? 'text-[13px]' : 'text-caption'
        }`}>
          @{message.username}
        </span>
        <span className={`text-secondary-text ${
          compact ? 'text-[11px]' : 'text-small'
        }`}>
          {formatTime(message.timestamp)}
        </span>
      </div>

      {/* Message Text */}
      <p className={`text-primary-text whitespace-pre-wrap break-words ${
        compact ? 'text-[14px] leading-tight' : 'text-body'
      }`}>
        {message.message}
      </p>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export default React.memo(ChatMessage, (prev, next) => {
  return prev.message.id === next.message.id &&
         prev.message.message === next.message.message;
});
