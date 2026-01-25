import { useState } from 'react';

interface PlayerControlsProps {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  onPlayPause: () => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onFullscreen: () => void;
}

export function PlayerControls({
  isPlaying,
  isMuted,
  volume,
  onPlayPause,
  onVolumeChange,
  onMuteToggle,
  onFullscreen,
}: PlayerControlsProps) {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary-black/80 to-transparent p-4 z-10">
      <div className="flex items-center justify-between">
        {/* Left controls: Play/Pause and Volume */}
        <div className="flex items-center gap-4">
          {/* Play/Pause Button */}
          <button
            onClick={onPlayPause}
            className="w-10 h-10 flex items-center justify-center text-white hover:text-hot-pink transition-colors"
            aria-label={isPlaying ? 'Pause video' : 'Play video'}
          >
            {isPlaying ? (
              <svg
                className="w-6 h-6"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg
                className="w-6 h-6"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Volume Controls */}
          <div
            className="flex items-center gap-2"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button
              onClick={onMuteToggle}
              className="w-10 h-10 flex items-center justify-center text-white hover:text-hot-pink transition-colors"
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            >
              {isMuted || volume === 0 ? (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                </svg>
              )}
            </button>

            {/* Volume Slider */}
            {showVolumeSlider && (
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={(e) => onVolumeChange(parseInt(e.target.value, 10))}
                className="w-24 h-1 bg-secondary-text rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-hot-pink [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-hot-pink [&::-moz-range-thumb]:border-0"
                aria-label="Volume"
              />
            )}
          </div>
        </div>

        {/* Right controls: Fullscreen */}
        <button
          onClick={onFullscreen}
          className="w-10 h-10 flex items-center justify-center text-white hover:text-hot-pink transition-colors"
          aria-label="Enter fullscreen"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
