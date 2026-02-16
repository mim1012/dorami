import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

export interface ChatInputHandle {
  insertText: (text: string) => void;
}

const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>((props, ref) => {
  const { onSendMessage, disabled = false, compact = false } = props;

  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const maxLength = 200;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (message.trim() && message.length <= maxLength) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const insertText = (text: string) => {
    setMessage((prev) => prev + text);
    inputRef.current?.focus();
  };

  // Expose insertText to parent via ref
  useImperativeHandle(ref, () => ({
    insertText,
  }));

  return (
    <form
      onSubmit={handleSubmit}
      className={`border-t border-border-color bg-black/30 backdrop-blur-sm ${
        compact ? 'p-2' : 'p-3'
      }`}
    >
      <div className={`flex items-center ${compact ? 'gap-1' : 'gap-2'}`}>
        {/* Text Input */}
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지 입력..."
            maxLength={maxLength}
            disabled={disabled}
            className={`w-full bg-border-color text-primary-text border border-border-color focus:border-hot-pink focus:outline-none transition-colors ${
              compact ? 'px-3 py-1.5 text-sm rounded-full' : 'px-4 py-2 rounded-input text-body'
            }`}
          />
          {/* Character Counter - only show when typing */}
          {message.length > 0 && (
            <span
              className={`absolute right-2 text-secondary-text ${
                compact ? 'bottom-1 text-[10px]' : 'bottom-2 text-small'
              }`}
            >
              {message.length}/{maxLength}
            </span>
          )}
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={disabled || !message.trim() || message.length > maxLength}
          className={`flex-shrink-0 bg-hot-pink text-white rounded-full hover:bg-hot-pink-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
            compact ? 'p-1.5' : 'p-2'
          }`}
          aria-label="Send message"
        >
          <PaperAirplaneIcon className={compact ? 'w-5 h-5' : 'w-6 h-6'} />
        </button>
      </div>
    </form>
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;
