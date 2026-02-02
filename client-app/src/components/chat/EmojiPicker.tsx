interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onEmojiSelect, onClose }: EmojiPickerProps) {
  const emojiCategories = {
    smileys: [
      '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆',
      '😉', '😊', '😋', '😎', '😍', '😘', '🥰', '😗',
      '😙', '😚', '☺️', '🙂', '🤗', '🤩', '🤔', '🤨',
    ],
    hearts: [
      '❤️', '💕', '💖', '💗', '💓', '💞', '💝', '💘',
      '💟', '💌', '💋', '❣️',
    ],
    celebration: [
      '🎉', '🎊', '🎈', '🎁', '🎀', '🎂', '🍰', '🧁',
      '🥳', '⭐', '✨', '💫', '🔥', '💯',
    ],
  };

  const allEmojis = [
    ...emojiCategories.smileys,
    ...emojiCategories.hearts,
    ...emojiCategories.celebration,
  ];

  return (
    <div className="border-t border-white/10 bg-black/30 backdrop-blur-sm p-3 max-h-40 overflow-y-auto">
      <div className="grid grid-cols-8 gap-2">
        {allEmojis.map((emoji, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onEmojiSelect(emoji)}
            className="text-2xl hover:bg-white/10 rounded p-1 transition-colors"
            aria-label={`Emoji ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
