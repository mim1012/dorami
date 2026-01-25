'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { LiveBadge } from './LiveBadge';
import { ViewerCount } from './ViewerCount';
import { PlayerControls } from './PlayerControls';
import { BufferingSpinner } from './BufferingSpinner';
import { ErrorOverlay } from './ErrorOverlay';

interface VideoPlayerProps {
  streamKey: string;
  hlsUrl: string;
  isLive: boolean;
  viewerCount: number;
  onStreamEnded?: () => void;
}

export function VideoPlayer({
  streamKey,
  hlsUrl,
  isLive,
  viewerCount,
  onStreamEnded,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay
  const [volume, setVolume] = useState(100);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize HLS.js
  useEffect(() => {
    if (!videoRef.current || !isLive) return;

    const video = videoRef.current;

    // Check if HLS is supported
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 10,
        maxBufferLength: 15,
        liveSyncDuration: 3, // stay 3s behind live edge
        liveMaxLatencyDuration: 5,
        liveDurationInfinity: true,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch((err) => {
          console.error('Autoplay failed:', err);
          setIsPlaying(false);
        });
        setIsPlaying(true);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error:', data);

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError('Connection lost. Retrying...');
              setTimeout(() => {
                hls.startLoad();
                setError(null);
              }, 1000);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError('Media error. Attempting recovery...');
              hls.recoverMediaError();
              setTimeout(() => setError(null), 2000);
              break;
            default:
              setError('Fatal error occurred. Please refresh the page.');
              break;
          }
        }
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        setIsBuffering(false);
      });

      hlsRef.current = hls;

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = hlsUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch((err) => {
          console.error('Autoplay failed:', err);
          setIsPlaying(false);
        });
        setIsPlaying(true);
      });
    } else {
      setError('HLS is not supported in this browser');
    }
  }, [hlsUrl, isLive]);

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const handleEnded = () => {
      setIsPlaying(false);
      if (onStreamEnded) onStreamEnded();
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('ended', handleEnded);
    };
  }, [onStreamEnded]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'm':
          e.preventDefault();
          handleMuteToggle();
          break;
        case 'f':
          e.preventDefault();
          handleFullscreen();
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleVolumeChange(Math.min(volume + 10, 100));
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleVolumeChange(Math.max(volume - 10, 0));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [volume]);

  const handlePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (!videoRef.current) return;

    setVolume(newVolume);
    videoRef.current.volume = newVolume / 100;

    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
      videoRef.current.muted = false;
    }
  };

  const handleMuteToggle = () => {
    if (!videoRef.current) return;

    const newMuted = !isMuted;
    setIsMuted(newMuted);
    videoRef.current.muted = newMuted;
  };

  const handleFullscreen = () => {
    if (!videoRef.current) return;

    const container = videoRef.current.parentElement;
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  };

  const handleRetry = () => {
    setError(null);
    if (hlsRef.current) {
      hlsRef.current.startLoad();
    } else if (videoRef.current) {
      videoRef.current.load();
    }
  };

  if (!isLive) {
    return (
      <div className="relative w-full aspect-video bg-primary-black flex items-center justify-center">
        <div className="text-center px-6">
          <h2 className="text-h2 text-hot-pink mb-4">This stream is not currently live</h2>
          <p className="text-secondary-text">Check back soon!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video bg-primary-black" aria-label="Live stream video player">
      <video
        ref={videoRef}
        className="w-full h-full"
        playsInline
        muted={isMuted}
        autoPlay
      />

      {isLive && <LiveBadge />}
      {isLive && <ViewerCount count={viewerCount} />}

      <PlayerControls
        isPlaying={isPlaying}
        isMuted={isMuted}
        volume={volume}
        onPlayPause={handlePlayPause}
        onVolumeChange={handleVolumeChange}
        onMuteToggle={handleMuteToggle}
        onFullscreen={handleFullscreen}
      />

      {isBuffering && <BufferingSpinner />}
      {error && <ErrorOverlay message={error} onRetry={handleRetry} />}
    </div>
  );
}
