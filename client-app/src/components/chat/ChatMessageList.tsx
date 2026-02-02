import { useEffect, useRef, useState } from 'react';
import ChatMessage from './ChatMessage';
import { ChatMessage as ChatMessageType } from './types';
import { ChevronDownIcon } from '@heroicons/react/24/solid';

interface ChatMessageListProps {
  messages: ChatMessageType[];
  compact?: boolean;
  maxMessages?: number;
}

export default function ChatMessageList({
  messages,
  compact = false,
  maxMessages,
}: ChatMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Limit messages if maxMessages is specified
  const displayMessages = maxMessages
    ? messages.slice(-maxMessages)
    : messages;

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom && messages.length > 0);
    }
  };

  useEffect(() => {
    // Auto-scroll when new message arrives if near bottom
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;

      if (isNearBottom) {
        scrollToBottom('smooth');
      }
    }
  }, [messages]);

  // Initial scroll to bottom
  useEffect(() => {
    scrollToBottom('auto');
  }, []);

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Messages Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={`h-full overflow-y-auto scrollbar-thin scrollbar-thumb-hot-pink scrollbar-track-transparent ${
          compact ? 'px-2 py-1' : 'px-4 py-2'
        }`}
      >
        {displayMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-secondary-text text-caption text-center px-4">
              채팅이 비어 있습니다.<br />
              첫 메시지를 남겨보세요!
            </p>
          </div>
        ) : (
          displayMessages.map((message) => (
            <ChatMessage key={message.id} message={message} compact={compact} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to Bottom Button */}
      {showScrollButton && (
        <button
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-4 right-4 p-2 bg-hot-pink rounded-full shadow-lg hover:bg-hot-pink-dark transition-colors z-10"
          aria-label="Scroll to bottom"
        >
          <ChevronDownIcon className="w-5 h-5 text-white" />
        </button>
      )}
    </div>
  );
}
