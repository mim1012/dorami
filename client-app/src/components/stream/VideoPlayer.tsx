'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { io, Socket } from 'socket.io-client';
import { useOrientation } from '@/hooks/useOrientation';
import LiveBadge from './LiveBadge';
import ViewerCount from './ViewerCount';
import BufferingSpinner from './BufferingSpinner';
import ErrorOverlay from './ErrorOverlay';
import StreamEndedOverlay from './StreamEndedOverlay';

export type VideoStreamEvent =
  | { type: 'PLAY_OK' }
  | { type: 'STALL' }
  | { type: 'MEDIA_ERROR' }
  | { type: 'STREAM_ENDED' };

interface VideoPlayerProps {
  streamKey: string;
  title: string;
  onViewerCountChange?: (count: number) => void;
  onStreamError?: (hasError: boolean) => void;
  onStreamStateChange?: (event: VideoStreamEvent) => void;
  /** When true, suppresses the built-in ErrorOverlay (parent handles error display via FSM). */
  hideErrorOverlay?: boolean;
}

export default function VideoPlayer({
  streamKey,
  title,
  onViewerCountChange,
  onStreamError,
  onStreamStateChange,
  hideErrorOverlay = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsPlayerRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const latencyIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const flvRetryCountRef = useRef(0);

  const [viewerCount, setViewerCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamEnded, setStreamEnded] = useState(false);
  const [latency, setLatency] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [playerMode, setPlayerMode] = useState<'flv' | 'hls' | null>(null);

  // KPI metrics
  const metricsRef = useRef({
    playStartTime: 0,
    firstFrameTime: 0,
    rebufferCount: 0,
    totalStallDuration: 0,
    stallStartTime: 0,
    reconnectCount: 0,
  });
  const [kpi, setKpi] = useState({
    firstFrameMs: 0,
    rebufferCount: 0,
    stallDurationMs: 0,
    reconnectCount: 0,
  });

  const orientation = useOrientation();

  // Use a ref so closures in useCallback/event handlers always see the latest callback
  const onStreamStateChangeRef = useRef(onStreamStateChange);
  useEffect(() => {
    onStreamStateChangeRef.current = onStreamStateChange;
  }, [onStreamStateChange]);

  useEffect(() => {
    onStreamError?.(!!error);
  }, [error, onStreamError]);

  // Stream URLs
  const flvUrl = `/live/live/${streamKey}.flv`;
  const hlsUrl = process.env.NEXT_PUBLIC_CDN_URL
    ? `${process.env.NEXT_PUBLIC_CDN_URL}/hls/${streamKey}.m3u8`
    : `/hls/${streamKey}.m3u8`;

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile && orientation === 'landscape' && !document.fullscreenElement) {
      videoRef.current?.requestFullscreen();
    } else if (isMobile && orientation === 'portrait' && document.fullscreenElement) {
      document.exitFullscreen();
    }
  }, [orientation, isMobile]);

  // Sync KPI state from metricsRef
  const syncKpi = useCallback(() => {
    const m = metricsRef.current;
    setKpi({
      firstFrameMs: m.firstFrameTime > 0 ? Math.round(m.firstFrameTime - m.playStartTime) : 0,
      rebufferCount: m.rebufferCount,
      stallDurationMs: Math.round(m.totalStallDuration),
      reconnectCount: m.reconnectCount,
    });
  }, []);

  const initializeHlsPlayer = useCallback(() => {
    if (!videoRef.current) return;

    // Clear any existing interval (e.g. orphaned FLV interval during fallback)
    if (latencyIntervalRef.current) {
      clearInterval(latencyIntervalRef.current);
      latencyIntervalRef.current = null;
    }

    metricsRef.current.playStartTime = performance.now();
    setPlayerMode('hls');

    // Check if browser supports native HLS (Safari)
    if (videoRef.current.canPlayType('application/vnd.apple.mpegurl') && !Hls.isSupported()) {
      videoRef.current.src = hlsUrl;
      videoRef.current.addEventListener('loadedmetadata', () => {
        videoRef.current?.play();
        setIsPlaying(true);
      });
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 10,
        maxBufferLength: 20,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        maxLiveSyncPlaybackRate: 1.3,
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
          onStreamStateChangeRef.current?.({ type: 'MEDIA_ERROR' });
        }
      });

      hlsRef.current = hls;

      // Track latency and auto-seek to live edge
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
      setError('Your browser does not support video playback');
    }
  }, [hlsUrl]);

  const initializeFlvPlayer = useCallback(async () => {
    if (!videoRef.current) return;

    metricsRef.current.playStartTime = performance.now();

    try {
      const mpegts = await import('mpegts.js');

      if (!mpegts.default.isSupported()) {
        // Browser doesn't support MSE/FLV — fall back to HLS
        initializeHlsPlayer();
        return;
      }

      setPlayerMode('flv');

      const player = mpegts.default.createPlayer(
        {
          type: 'flv',
          isLive: true,
          url: flvUrl,
        },
        {
          enableWorker: true,
          enableStashBuffer: true,
          stashInitialSize: 1024,
          liveBufferLatencyChasing: true,
          liveBufferLatencyMaxLatency: 4.0,
          liveBufferLatencyMinRemain: 1.5,
          autoCleanupSourceBuffer: true,
          autoCleanupMaxBackwardDuration: 30,
          autoCleanupMinBackwardDuration: 10,
        },
      );

      player.attachMediaElement(videoRef.current);
      player.load();

      videoRef.current.addEventListener('loadedmetadata', () => {
        videoRef.current?.play();
        setIsPlaying(true);
      });

      player.on(mpegts.default.Events.ERROR, (errorType: string, errorDetail: string) => {
        const isRetryable =
          (errorType === 'NetworkError' &&
            (errorDetail === 'NetworkTimeout' || errorDetail === 'NetworkStatusCodeInvalid')) ||
          (errorType === 'MediaError' && errorDetail === 'MediaMSEError');

        if (isRetryable && flvRetryCountRef.current < 3) {
          flvRetryCountRef.current++;
          player.unload();
          setTimeout(() => player.load(), 1000 * flvRetryCountRef.current);
          return;
        }

        // Unrecoverable or retry limit reached — clear interval then fall back to HLS
        if (latencyIntervalRef.current) {
          clearInterval(latencyIntervalRef.current);
          latencyIntervalRef.current = null;
        }
        player.destroy();
        mpegtsPlayerRef.current = null;
        setError(null);
        onStreamStateChangeRef.current?.({ type: 'MEDIA_ERROR' });
        initializeHlsPlayer();
      });

      mpegtsPlayerRef.current = player;

      // Track latency for FLV
      latencyIntervalRef.current = setInterval(() => {
        const video = videoRef.current;
        if (video && video.buffered.length > 0) {
          const liveEdge = video.buffered.end(video.buffered.length - 1);
          const currentLatency = liveEdge - video.currentTime;
          setLatency(Math.round(currentLatency * 10) / 10);
          // Auto-seek if drifted too far
          if (currentLatency > 3) {
            video.currentTime = liveEdge - 0.5;
          }
        }
      }, 1000);
    } catch {
      // mpegts.js import failed — fall back to HLS
      initializeHlsPlayer();
    }
  }, [flvUrl, initializeHlsPlayer]);

  // Visibility change: handle tab switch and background recovery
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab became visible again — seek to live edge
        const video = videoRef.current;
        if (video && video.buffered.length > 0) {
          const liveEdge = video.buffered.end(video.buffered.length - 1);
          video.currentTime = liveEdge - 0.5;
        }
        // If video was paused by browser, resume
        if (video && video.paused && isPlaying && !streamEnded) {
          video.play().catch(() => {});
        }
        // Re-emit viewer join in case socket reconnected while hidden
        if (socketRef.current?.connected) {
          socketRef.current.emit('stream:viewer:join', { streamKey });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [streamKey, isPlaying, streamEnded]);

  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;

    // KPI + buffering state via video element events
    const onWaiting = () => {
      setIsBuffering(true);
      const m = metricsRef.current;
      // Only count as rebuffer after first frame has been rendered
      if (m.firstFrameTime > 0) {
        m.rebufferCount++;
        m.stallStartTime = performance.now();
      }
      onStreamStateChangeRef.current?.({ type: 'STALL' });
    };
    const onPlaying = () => {
      setIsBuffering(false);
      setError(null);
      const m = metricsRef.current;
      // Record first frame time
      if (m.firstFrameTime === 0 && m.playStartTime > 0) {
        m.firstFrameTime = performance.now();
      }
      // End stall duration tracking
      if (m.stallStartTime > 0) {
        m.totalStallDuration += performance.now() - m.stallStartTime;
        m.stallStartTime = 0;
      }
      syncKpi();
      onStreamStateChangeRef.current?.({ type: 'PLAY_OK' });
    };
    const onStalled = () => {
      const m = metricsRef.current;
      if (m.firstFrameTime > 0 && m.stallStartTime === 0) {
        m.stallStartTime = performance.now();
      }
      onStreamStateChangeRef.current?.({ type: 'STALL' });
    };
    const onRateChange = () => {
      // mpegts.js manages playbackRate internally for latency chasing (FLV mode).
      // Only reset in HLS fallback mode to prevent unintended speed changes.
      if (mpegtsPlayerRef.current === null && video.playbackRate !== 1) {
        video.playbackRate = 1;
      }
    };
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('stalled', onStalled);
    video.addEventListener('ratechange', onRateChange);

    // Try HTTP-FLV first (low-latency), fall back to HLS
    initializeFlvPlayer();
    connectWebSocket();

    return () => {
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('stalled', onStalled);
      video.removeEventListener('ratechange', onRateChange);
      cleanupPlayer();
      disconnectWebSocket();
    };
  }, [streamKey]);

  const cleanupPlayer = () => {
    if (latencyIntervalRef.current) {
      clearInterval(latencyIntervalRef.current);
      latencyIntervalRef.current = null;
    }
    if (mpegtsPlayerRef.current) {
      mpegtsPlayerRef.current.destroy();
      mpegtsPlayerRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setPlayerMode(null);
  };

  const connectWebSocket = () => {
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');

    const socket = io(`${wsUrl}/streaming`, {
      transports: ['websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });

    socket.on('connect', () => {
      socket.emit('stream:viewer:join', { streamKey });
    });

    // Re-join room after reconnection (WiFi switch, background recovery)
    socket.io.on('reconnect', () => {
      metricsRef.current.reconnectCount++;
      syncKpi();
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
        onStreamError?.(true);
        onStreamStateChangeRef.current?.({ type: 'STREAM_ENDED' });
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

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
        aria-label="Live stream video player"
      />

      {!error && !streamEnded && <LiveBadge />}
      {!error && !streamEnded && <ViewerCount count={viewerCount} />}

      {isBuffering && <BufferingSpinner />}
      {error && !hideErrorOverlay && <ErrorOverlay message={error} />}
      {streamEnded && <StreamEndedOverlay />}

      {/* KPI debug overlay — dev only */}
      {process.env.NODE_ENV !== 'production' && kpi.firstFrameMs > 0 && (
        <div className="absolute top-12 right-2 bg-black/70 text-white text-[10px] font-mono px-2 py-1 rounded space-y-0.5 pointer-events-none">
          <div>mode: {playerMode || '-'}</div>
          <div>first frame: {kpi.firstFrameMs}ms</div>
          <div>rebuffers: {kpi.rebufferCount}</div>
          <div>stall: {kpi.stallDurationMs}ms</div>
          <div>reconnects: {kpi.reconnectCount}</div>
        </div>
      )}
    </div>
  );
}
