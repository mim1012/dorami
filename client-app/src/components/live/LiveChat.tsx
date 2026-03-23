'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@/lib/hooks/use-chat';
import { Body } from '@/components/common/Typography';
import { Send } from 'lucide-react';

interface LiveChatProps {
  liveId: string;
  streamKey: string;
}

export function LiveChat({ liveId, streamKey }: LiveChatProps) {
  const { messages, sendMessage, isConnected, isConnecting, error } = useChat({
    liveId,
    enabled: true,
  });

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() || !isConnected) {
      return;
    }

    sendMessage(inputValue);
    setInputValue('');
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-content-bg/80 via-content-bg/90 to-content-bg/95 backdrop-blur-sm rounded-t-2xl border border-border-color">
      {/* Chat Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border-color">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-error'}`} />
            <Body className="text-primary-text font-semibold text-sm">실시간 채팅</Body>
          </div>
          <Body className="text-secondary-text text-xs">
            {isConnecting
              ? '연결 중...'
              : isConnected
                ? `${messages.length}개 메시지`
                : '연결 끊김'}
          </Body>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {error && (
          <div className="bg-error/20 border border-error rounded-lg p-3 mb-2">
            <Body className="text-error text-xs">{error}</Body>
          </div>
        )}

        {messages.length === 0 && !isConnecting && (
          <div className="flex items-center justify-center h-full">
            <Body className="text-secondary-text text-sm text-center">채팅에 참여해보세요! 💬</Body>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className="bg-border-color backdrop-blur-sm rounded-lg px-3 py-2 hover:bg-content-bg transition-colors"
          >
            <div className="flex items-baseline gap-2 mb-1">
              <Body className="text-hot-pink text-xs font-semibold">
                User {msg.userId.slice(0, 8)}
              </Body>
              <Body className="text-secondary-text text-[10px]">
                {new Date(msg.timestamp).toLocaleTimeString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Body>
            </div>
            <Body className="text-primary-text text-sm leading-relaxed">{msg.message}</Body>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="flex-shrink-0 px-4 py-3 border-t border-border-color bg-content-bg/95 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isConnected ? '메시지를 입력하세요...' : '연결 중...'}
            disabled={!isConnected}
            className="flex-1 bg-content-bg border border-border-color rounded-full px-4 py-2.5 text-sm text-primary-text placeholder:text-secondary-text focus:outline-none focus:border-hot-pink disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            maxLength={200}
          />
          <button
            type="submit"
            disabled={!isConnected || !inputValue.trim()}
            className="flex-shrink-0 w-10 h-10 bg-hot-pink hover:bg-hot-pink/90 disabled:bg-border-color disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-all disabled:shadow-none"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
        <Body className="text-secondary-text text-[10px] mt-2 px-2">{inputValue.length}/200</Body>
      </form>
    </div>
  );
}
