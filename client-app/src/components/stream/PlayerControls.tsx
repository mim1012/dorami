'use client';

import { useState, useEffect } from 'react';
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowsPointingOutIcon,
} from '@heroicons/react/24/solid';

interface PlayerControlsProps {
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  onPlayPause: () => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onFullscreen: () => void;
}

export default function PlayerControls({
  isPlaying,
  volume,
  isMuted,
  onPlayPause,
  onVolumeChange,
  onMuteToggle,
  onFullscreen,
}: PlayerControlsProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);

  const showControls = () => {
    setIsVisible(true);

    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }

    const timeout = setTimeout(() => {
      setIsVisible(false);
    }, 3000);

    setControlsTimeout(timeout);
  };

  const handleTap = () => {
    if (!isVisible) {
      showControls();
    }
  };

  useEffect(() => {
    return () => {
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }
    };
  }, [controlsTimeout]);

  return (
    <>
      {/* Tap area for mobile */}
      <div className="absolute inset-0 md:hidden" onClick={handleTap} aria-label="Show controls" />

      {/* Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0 md:opacity-100'
        }`}
      >
        <div className="flex items-center gap-4">
          {/* Play/Pause - touch-optimized size */}
          <button
            onClick={onPlayPause}
            className="text-white hover:text-hot-pink transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={isPlaying ? 'Pause video' : 'Play video'}
          >
            {isPlaying ? (
              <PauseIcon className="w-8 h-8 md:w-8 md:h-8" />
            ) : (
              <PlayIcon className="w-8 h-8 md:w-8 md:h-8" />
            )}
          </button>

          {/* Volume - hidden on mobile, shown on tablet+ */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={onMuteToggle}
              className="text-white hover:text-hot-pink transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            >
              {isMuted ? (
                <SpeakerXMarkIcon className="w-6 h-6" />
              ) : (
                <SpeakerWaveIcon className="w-6 h-6" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="w-24 h-1 bg-content-bg rounded-lg appearance-none cursor-pointer slider-hot-pink"
              aria-label="Volume control"
            />
          </div>

          {/* Fullscreen - touch-optimized size */}
          <button
            onClick={onFullscreen}
            className="text-white hover:text-hot-pink transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ml-auto md:ml-0"
            aria-label="Enter fullscreen"
          >
            <ArrowsPointingOutIcon className="w-6 h-6" />
          </button>
        </div>
      </div>
    </>
  );
}
