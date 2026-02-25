import React from 'react';
import { ChatMessage as ChatMessageType } from './types';
import { Trash2 } from 'lucide-react';

interface ChatMessageProps {
  message: ChatMessageType;
  compact?: boolean;
  isAdmin?: boolean;
  onDelete?: (messageId: string) => void;
}

function ChatMessage({ message, compact = false, isAdmin = false, onDelete }: ChatMessageProps) {
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleDelete = () => {
    if (onDelete && message.id) {
      onDelete(message.id);
    }
  };

  // Check if message is deleted
  const isDeleted = message.isDeleted || false;

  return (
    <div
      className={`animate-fade-in ${compact ? 'mb-1.5 px-2.5 py-1.5 bg-black/50 backdrop-blur-sm rounded-xl mx-1' : 'mb-3'} ${isDeleted ? 'opacity-50' : ''}`}
    >
      {/* Username + Timestamp */}
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className={`text-hot-pink font-semibold ${compact ? 'text-[13px]' : 'text-caption'}`}>
          @{message.username}
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-white/50 ${compact ? 'text-[11px]' : 'text-small'}`}>
            {formatTime(message.timestamp)}
          </span>
          {isAdmin && !isDeleted && onDelete && (
            <button
              onClick={handleDelete}
              className="text-error hover:text-error/80 transition-colors p-1"
              title="메시지 삭제"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Message Text */}
      <p
        className={`text-white whitespace-pre-wrap break-words ${
          compact ? 'text-[14px] leading-tight' : 'text-body'
        } ${isDeleted ? 'italic' : ''}`}
      >
        {isDeleted ? '관리자에 의해 삭제된 메시지입니다.' : message.message}
      </p>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export default React.memo(ChatMessage, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.message === next.message.message &&
    prev.message.isDeleted === next.message.isDeleted &&
    prev.compact === next.compact &&
    prev.isAdmin === next.isAdmin
  );
});
