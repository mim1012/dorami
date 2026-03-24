import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import ChatMessage from './ChatMessage';
import { ChatMessage as ChatMessageType, SYSTEM_USERNAME } from './types';
import { ChevronDownIcon } from '@heroicons/react/24/solid';
import { ShoppingCart } from 'lucide-react';

interface ChatMessageListProps {
  messages: ChatMessageType[];
  compact?: boolean;
  maxMessages?: number;
  isAdmin?: boolean;
  onDeleteMessage?: (messageId: string) => void;
}

export interface ChatMessageListHandle {
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

const THRESHOLD = 50;

const ChatMessageList = forwardRef<ChatMessageListHandle, ChatMessageListProps>(
  function ChatMessageList(
    { messages, compact = false, maxMessages, isAdmin = false, onDeleteMessage },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isAutoScroll, setIsAutoScroll] = useState(true);

    const displayMessages = maxMessages ? messages.slice(-maxMessages) : messages;

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
      const el = containerRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior });
    };

    useImperativeHandle(ref, () => ({ scrollToBottom }));

    const handleScroll = () => {
      const el = containerRef.current;
      if (!el) return;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < THRESHOLD;
      setIsAutoScroll(isNearBottom);
    };

    const handleGoBottom = () => {
      setIsAutoScroll(true);
      scrollToBottom('smooth');
    };

    // Auto-scroll only when isAutoScroll is true
    useLayoutEffect(() => {
      if (isAutoScroll) {
        scrollToBottom('auto');
      }
    }, [messages]);

    // Initial scroll to bottom
    useLayoutEffect(() => {
      scrollToBottom('auto');
    }, []);

    return (
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className={`overflow-y-auto ${
            compact
              ? 'max-h-[15vh] px-2 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
              : 'h-full px-4 py-2 scrollbar-thin scrollbar-thumb-hot-pink scrollbar-track-transparent'
          }`}
        >
          <div className="min-h-full flex flex-col justify-end">
            {displayMessages.length === 0 ? (
              !compact && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-secondary-text text-caption text-center px-4">
                    채팅이 비어 있습니다.
                    <br />첫 메시지를 남겨보세요!
                  </p>
                </div>
              )
            ) : (
              <>
                {displayMessages.map((message) => {
                  if (message.username === SYSTEM_USERNAME) {
                    return (
                      <div
                        key={message.id}
                        className={`animate-fade-in ${compact ? 'mb-1.5 px-1' : 'mb-2 px-2'}`}
                      >
                        <div className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full">
                          <ShoppingCart className="w-3 h-3 text-orange-400 flex-shrink-0" />
                          <span
                            className={`text-orange-400 font-semibold ${
                              compact ? 'text-[12px]' : 'text-[13px]'
                            }`}
                          >
                            {message.message}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <ChatMessage
                      key={message.id}
                      message={message}
                      compact={compact}
                      isAdmin={isAdmin}
                      onDelete={onDeleteMessage}
                    />
                  );
                })}
              </>
            )}
            <div />
          </div>
        </div>

        {!isAutoScroll && (
          <button
            onClick={handleGoBottom}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full flex items-center gap-1.5 z-10 border border-white/10 hover:bg-black/80 transition-all"
            aria-label="최신 채팅으로 이동"
          >
            <ChevronDownIcon className="w-3.5 h-3.5 text-white" />
            <span className="text-white text-xs font-medium">최신 채팅</span>
          </button>
        )}
      </div>
    );
  },
);

export default ChatMessageList;
