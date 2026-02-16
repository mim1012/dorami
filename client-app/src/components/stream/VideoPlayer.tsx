'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { io, Socket } from 'socket.io-client';
import { useOrientation } from '@/hooks/useOrientation';
import LiveBadge from './LiveBadge';
import ViewerCount from './ViewerCount';
import PlayerControls from './PlayerControls';
import BufferingSpinner from './BufferingSpinner';
import ErrorOverlay from './ErrorOverlay';
import StreamEndedOverlay from './StreamEndedOverlay';

interface VideoPlayerProps {
  streamKey: string;
  title: string;
  onViewerCountChange?: (count: number) => void;
}

export default function VideoPlayer({ streamKey, title, onViewerCountChange }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const latencyIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [viewerCount, setViewerCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0); // Start muted for autoplay
  const [isMuted, setIsMuted] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamEnded, setStreamEnded] = useState(false);
  const [latency, setLatency] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const orientation = useOrientation();

  // HLS URL: use CDN if configured, otherwise use relative path through nginx proxy
  const hlsUrl = process.env.NEXT_PUBLIC_CDN_URL
    ? `${process.env.NEXT_PUBLIC_CDN_URL}/hls/${streamKey}.m3u8`
    : `/hls/${streamKey}.m3u8`;

  useEffect(() => {
    // Detect if device is mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Auto-fullscreen on mobile landscape
    if (isMobile && orientation === 'landscape' && !document.fullscreenElement) {
      videoRef.current?.requestFullscreen();
    } else if (isMobile && orientation === 'portrait' && document.fullscreenElement) {
      document.exitFullscreen();
    }
  }, [orientation, isMobile]);

  useEffect(() => {
    initializePlayer();
    connectWebSocket();

    return () => {
      cleanupPlayer();
      disconnectWebSocket();
    };
  }, [streamKey]);

  const initializePlayer = () => {
    if (!videoRef.current) return;

    // Use video element events for accurate buffering state
    videoRef.current.addEventListener('waiting', () => setIsBuffering(true));
    videoRef.current.addEventListener('playing', () => {
      setIsBuffering(false);
      setError(null);
    });

    // Check if browser supports native HLS (Safari)
    if (videoRef.current.canPlayType('application/vnd.apple.mpegurl') && !Hls.isSupported()) {
      // Safari: use native HLS
      videoRef.current.src = hlsUrl;
      videoRef.current.addEventListener('loadedmetadata', () => {
        videoRef.current?.play();
        setIsPlaying(true);
      });
    } else if (Hls.isSupported()) {
      // Other browsers: use HLS.js
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 2,
        maxBufferLength: 4,
        liveSyncDuration: 1,
        liveMaxLatencyDuration: 3,
        liveDurationInfinity: true,
        maxLiveSyncPlaybackRate: 1.5,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoRef.current?.play();
        setIsPlaying(true);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError('Network error. Retrying...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError('Media error. Retrying...');
              hls.recoverMediaError();
              break;
            default:
              setError('Fatal error. Please refresh the page.');
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;

      // Track latency and auto-seek to live edge if drifted too far
      latencyIntervalRef.current = setInterval(() => {
        if (hls.latency !== undefined) {
          setLatency(Math.round(hls.latency));
        }
        const video = videoRef.current;
        if (video && video.buffered.length > 0) {
          const liveEdge = video.buffered.end(video.buffered.length - 1);
          const drift = liveEdge - video.currentTime;
          if (drift > 4) {
            video.currentTime = liveEdge - 1;
          }
        }
      }, 1000);
    } else {
      setError('Your browser does not support HLS playback');
    }
  };

  const cleanupPlayer = () => {
    if (latencyIntervalRef.current) {
      clearInterval(latencyIntervalRef.current);
      latencyIntervalRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  };

  const connectWebSocket = () => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

    const socket = io(`${wsUrl}/streaming`, {
      transports: ['websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
    });

    socket.on('connect', () => {
      socket.emit('stream:viewer:join', { streamKey });
    });

    socket.on(
      'stream:viewer-count',
      (data: { data?: { streamKey: string; viewerCount: number } }) => {
        if (data.data && data.data.streamKey === streamKey) {
          setViewerCount(data.data.viewerCount);
          onViewerCountChange?.(data.data.viewerCount);
        }
      },
    );

    socket.on('stream:ended', (data: { streamKey: string }) => {
      if (data.streamKey === streamKey) {
        setStreamEnded(true);
        if (videoRef.current) {
          videoRef.current.pause();
        }
      }
    });

    socketRef.current = socket;
  };

  const disconnectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.emit('stream:viewer:leave', { streamKey });
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (!videoRef.current) return;

    videoRef.current.volume = newVolume / 100;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleMuteToggle = () => {
    if (!videoRef.current) return;

    if (isMuted) {
      videoRef.current.volume = 0.5;
      setVolume(50);
      setIsMuted(false);
    } else {
      videoRef.current.volume = 0;
      setVolume(0);
      setIsMuted(true);
    }
  };

  const handleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (!document.fullscreenElement) {
      if (video.requestFullscreen) {
        video.requestFullscreen();
      } else if (
        (video as HTMLVideoElement & { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen
      ) {
        (video as HTMLVideoElement & { webkitEnterFullscreen: () => void }).webkitEnterFullscreen();
      }
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted={isMuted}
        aria-label="Live stream video player"
      />

      <LiveBadge />
      <ViewerCount count={viewerCount} />

      <PlayerControls
        isPlaying={isPlaying}
        volume={volume}
        isMuted={isMuted}
        latency={latency}
        onPlayPause={handlePlayPause}
        onVolumeChange={handleVolumeChange}
        onMuteToggle={handleMuteToggle}
        onFullscreen={handleFullscreen}
      />

      {isBuffering && <BufferingSpinner />}
      {error && <ErrorOverlay message={error} />}
      {streamEnded && <StreamEndedOverlay />}
    </div>
  );
}
