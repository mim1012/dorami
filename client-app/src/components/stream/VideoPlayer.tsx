'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { io, Socket } from 'socket.io-client';
import { sendStreamMetrics, buildStreamMetrics } from '@/lib/analytics/stream-metrics';
import { RECONNECT_CONFIG } from '@/lib/socket/reconnect-config';
import { useOrientation } from '@/hooks/useOrientation';
import { useIsMobile } from '@/hooks/useIsMobile';
import LiveBadge from './LiveBadge';
import BufferingSpinner from './BufferingSpinner';
import ErrorOverlay from './ErrorOverlay';
import StreamEndedOverlay from './StreamEndedOverlay';

// Module-level Set to ensure only one viewer:join per streamKey across
// mobile + desktop VideoPlayer instances rendered simultaneously
const activeViewerKeys = new Set<string>();

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
  const flvRetryInProgressRef = useRef(false);
  const flvRetryResetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stallWatchdogRef = useRef<NodeJS.Timeout | null>(null);
  const lastCurrentTimeRef = useRef<number>(-1);
  const stallTicksRef = useRef<number>(0);
  const watchdogStartedRef = useRef<boolean>(false);
  const streamEndedRef = useRef(false);
  const playerModeRef = useRef<'flv' | 'hls' | null>(null);
  const reconnectResetTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [viewerCount, setViewerCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamEnded, setStreamEnded] = useState(false);
  // 브라우저 자동재생 정책 우회: 처음엔 음소거로 시작 후 언뮤트 버튼 제공
  const [isMuted, setIsMuted] = useState(true);
  const isMobile = useIsMobile();
  const [playerMode, setPlayerMode] = useState<'flv' | 'hls' | null>(null);
  const setPlayerModeWithRef = useCallback((mode: 'flv' | 'hls' | null) => {
    playerModeRef.current = mode;
    setPlayerMode(mode);
  }, []);
  // Debounce ref: spinner only appears if buffering lasts > 800ms
  const bufferingTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  useEffect(() => {
    streamEndedRef.current = streamEnded;
  }, [streamEnded]);

  // Stream URLs
  // FLV must be an absolute URL: mpegts.js runs fetch() inside a Web Worker when
  // enableWorker=true, and workers cannot resolve relative paths (no document base URL).
  const flvUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/live/live/${streamKey}.flv`
      : `/live/live/${streamKey}.flv`;
  const hlsUrl = process.env.NEXT_PUBLIC_CDN_URL
    ? `${process.env.NEXT_PUBLIC_CDN_URL}/hls/${streamKey}.m3u8`
    : `/hls/${streamKey}.m3u8`;

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
    setPlayerModeWithRef('hls');

    // Check if browser supports native HLS (Safari)
    if (videoRef.current.canPlayType('application/vnd.apple.mpegurl') && !Hls.isSupported()) {
      videoRef.current.src = hlsUrl;
      videoRef.current.addEventListener(
        'loadedmetadata',
        () => {
          videoRef.current?.play();
          setIsPlaying(true);
        },
        { once: true },
      );
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 10,
        maxBufferLength: 20,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        maxLiveSyncPlaybackRate: 1.1,
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
        const video = videoRef.current;
        if (video && video.buffered.length > 0) {
          const liveEdge = video.buffered.end(video.buffered.length - 1);
          const drift = liveEdge - video.currentTime;
          if (drift > 5) {
            video.currentTime = liveEdge - 1.5; // 1.5s 여유로 HLS seek 후 즉시 stall 방지
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

      setPlayerModeWithRef('flv');

      const player = mpegts.default.createPlayer(
        {
          type: 'flv',
          isLive: true,
          url: flvUrl,
        },
        {
          enableWorker: true,
          enableStashBuffer: true,
          stashInitialSize: 512,
          liveBufferLatencyChasing: true,
          liveBufferLatencyMaxLatency: 5.0,
          liveBufferLatencyMinRemain: 2.0,
          autoCleanupSourceBuffer: true,
          autoCleanupMaxBackwardDuration: 20,
          autoCleanupMinBackwardDuration: 7,
        },
      );

      player.attachMediaElement(videoRef.current);
      player.load();

      videoRef.current.addEventListener(
        'loadedmetadata',
        () => {
          videoRef.current?.play();
          setIsPlaying(true);
        },
        { once: true },
      );

      player.on(mpegts.default.Events.ERROR, (errorType: string, errorDetail: string) => {
        const isRetryable =
          (errorType === 'NetworkError' &&
            (errorDetail === 'NetworkTimeout' || errorDetail === 'NetworkStatusCodeInvalid')) ||
          (errorType === 'MediaError' && errorDetail === 'MediaMSEError');

        if (isRetryable && flvRetryCountRef.current < 3) {
          flvRetryCountRef.current++;
          flvRetryInProgressRef.current = true;
          player.unload();
          // Exponential backoff: 1s → 2s → 4s
          setTimeout(
            () => {
              flvRetryInProgressRef.current = false;
              player.load();
            },
            1000 * Math.pow(2, flvRetryCountRef.current - 1),
          );
          return;
        }

        // Unrecoverable or retry limit reached — clear interval then fall back to HLS
        if (latencyIntervalRef.current) {
          clearInterval(latencyIntervalRef.current);
          latencyIntervalRef.current = null;
        }
        // Reset watchdog so it restarts cleanly for the HLS session
        if (stallWatchdogRef.current) {
          clearInterval(stallWatchdogRef.current);
          stallWatchdogRef.current = null;
        }
        watchdogStartedRef.current = false;
        stallTicksRef.current = 0;
        if (flvRetryResetTimerRef.current) {
          clearTimeout(flvRetryResetTimerRef.current);
          flvRetryResetTimerRef.current = null;
        }
        player.destroy();
        mpegtsPlayerRef.current = null;
        setError(null);
        initializeHlsPlayer();
      });

      mpegtsPlayerRef.current = player;
    } catch {
      // mpegts.js import failed — fall back to HLS
      initializeHlsPlayer();
    }
  }, [flvUrl, initializeHlsPlayer]);

  // Visibility change: handle tab switch and background recovery
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const video = videoRef.current;
        if (video && video.buffered.length === 0) {
          // 버퍼 완전 소진 → 플레이어 재로드
          if (mpegtsPlayerRef.current) {
            mpegtsPlayerRef.current.unload();
            mpegtsPlayerRef.current.load();
          } else if (hlsRef.current) {
            hlsRef.current.stopLoad();
            hlsRef.current.startLoad();
          }
        } else if (video && video.buffered.length > 0) {
          // 버퍼 있음 → 라이브 엣지로 seek (1.5s 여유로 즉시 스피너 방지)
          const liveEdge = video.buffered.end(video.buffered.length - 1);
          video.currentTime = liveEdge - 1.5;
        }
        // If video was paused by browser, resume
        if (video && video.paused && isPlaying && !streamEnded) {
          video.play().catch(() => {});
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
      // Delay spinner by 2000ms — transient micro-stalls won't flash the spinner
      if (bufferingTimerRef.current) clearTimeout(bufferingTimerRef.current);
      bufferingTimerRef.current = setTimeout(() => {
        setIsBuffering(true);
        bufferingTimerRef.current = null;
      }, 2000);
      const m = metricsRef.current;
      // Only count as rebuffer after first frame has been rendered
      if (m.firstFrameTime > 0) {
        m.rebufferCount++;
        m.stallStartTime = performance.now();
      }
      onStreamStateChangeRef.current?.({ type: 'STALL' });
    };
    const onPlaying = () => {
      // Cancel pending spinner before it appears
      if (bufferingTimerRef.current) {
        clearTimeout(bufferingTimerRef.current);
        bufferingTimerRef.current = null;
      }
      setIsBuffering(false);
      setError(null);
      // HLS 모드에서는 내장 catchup(1.0~1.1)을 허용; FLV/기타는 1.0 고정
      if (playerModeRef.current !== 'hls') {
        video.playbackRate = 1.0;
      }
      const m = metricsRef.current;
      // Record first frame time
      if (m.firstFrameTime === 0 && m.playStartTime > 0) {
        m.firstFrameTime = performance.now();
      }
      // End stall duration tracking
      if (m.stallStartTime > 0) {
        m.totalStallDuration += performance.now() - m.stallStartTime;
        m.stallStartTime = 0;
        // ERROR threshold: cumulative stall > 30s
        if (m.totalStallDuration > 30_000) {
          sendStreamMetrics(buildStreamMetrics(streamKey, m, 'RECONNECTING')).catch(() => {});
        }
      }
      // WARNING threshold: first frame took > 5s
      if (m.firstFrameTime > 0 && m.firstFrameTime - m.playStartTime > 5_000) {
        sendStreamMetrics(buildStreamMetrics(streamKey, m, 'CONNECTED')).catch(() => {});
      }
      // 10초 안정 재생 후 FLV retry 카운터 리셋 (일시적 오류 후 카운터 소진 방지)
      if (flvRetryCountRef.current > 0) {
        if (flvRetryResetTimerRef.current) clearTimeout(flvRetryResetTimerRef.current);
        flvRetryResetTimerRef.current = setTimeout(() => {
          flvRetryCountRef.current = 0;
          flvRetryResetTimerRef.current = null;
        }, 10000);
      }
      // reconnectCount 안정화 후 리셋 (장기 방송 지원 — 30초 안정 재생 시 초기화)
      if (metricsRef.current.reconnectCount > 0) {
        if (reconnectResetTimerRef.current) clearTimeout(reconnectResetTimerRef.current);
        reconnectResetTimerRef.current = setTimeout(() => {
          metricsRef.current.reconnectCount = 0;
          reconnectResetTimerRef.current = null;
        }, 30000);
      }
      syncKpi();
      onStreamStateChangeRef.current?.({ type: 'PLAY_OK' });
      // Start stall watchdog on first successful frame
      if (!watchdogStartedRef.current) {
        watchdogStartedRef.current = true;
        lastCurrentTimeRef.current = videoRef.current?.currentTime ?? 0;
        stallTicksRef.current = 0;
        stallWatchdogRef.current = setInterval(() => {
          const v = videoRef.current;
          if (!v || v.paused || streamEndedRef.current) {
            stallTicksRef.current = 0;
            lastCurrentTimeRef.current = v?.currentTime ?? -1;
            return;
          }
          // 부동소수점 비교: 10ms 미만 진행은 stall로 간주
          if (Math.abs(v.currentTime - lastCurrentTimeRef.current) < 0.01) {
            stallTicksRef.current++;
            if (stallTicksRef.current >= 5) {
              // 5초간 currentTime 무변화 → 강제 재연결
              stallTicksRef.current = 0;
              metricsRef.current.reconnectCount++;
              syncKpi();
              // 재연결 5회 초과 시 에러 표시 (무한 루프 방지)
              if (metricsRef.current.reconnectCount > 5) {
                setError('Connection lost. Please refresh.');
                // Final FAILED metrics report
                sendStreamMetrics(
                  buildStreamMetrics(streamKey, metricsRef.current, 'FAILED'),
                ).catch(() => {});
                return;
              }
              // WARNING: frequent reconnect
              if (metricsRef.current.reconnectCount > 3) {
                sendStreamMetrics(
                  buildStreamMetrics(streamKey, metricsRef.current, 'RECONNECTING'),
                ).catch(() => {});
              }
              if (mpegtsPlayerRef.current && !flvRetryInProgressRef.current) {
                mpegtsPlayerRef.current.unload();
                mpegtsPlayerRef.current.load();
              } else if (hlsRef.current) {
                hlsRef.current.startLoad();
              }
              lastCurrentTimeRef.current = -1; // 재연결 후 비교 기준점 초기화
            }
          } else {
            stallTicksRef.current = 0;
            lastCurrentTimeRef.current = v.currentTime;
          }
        }, 1000);
      }
    };
    const onStalled = () => {
      const m = metricsRef.current;
      if (m.firstFrameTime > 0 && m.stallStartTime === 0) {
        m.stallStartTime = performance.now();
      }
      onStreamStateChangeRef.current?.({ type: 'STALL' });
    };
    // playbackRate 변경 감지 — HLS 내장 catchup(1.0~1.1) 허용; 그 외 1.0 고정
    const onRateChange = () => {
      if (playerModeRef.current === 'hls') {
        // HLS catchup: 1.0~1.1 범위는 허용, 벗어나면 리셋
        if (video.playbackRate < 1.0 || video.playbackRate > 1.1) {
          video.playbackRate = 1.0;
        }
      } else {
        if (video.playbackRate !== 1.0) {
          video.playbackRate = 1.0;
        }
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
      if (bufferingTimerRef.current) {
        clearTimeout(bufferingTimerRef.current);
        bufferingTimerRef.current = null;
      }
      cleanupPlayer();
      disconnectWebSocket();
    };
  }, [streamKey]);

  const cleanupPlayer = () => {
    if (latencyIntervalRef.current) {
      clearInterval(latencyIntervalRef.current);
      latencyIntervalRef.current = null;
    }
    if (flvRetryResetTimerRef.current) {
      clearTimeout(flvRetryResetTimerRef.current);
      flvRetryResetTimerRef.current = null;
    }
    if (reconnectResetTimerRef.current) {
      clearTimeout(reconnectResetTimerRef.current);
      reconnectResetTimerRef.current = null;
    }
    if (stallWatchdogRef.current) {
      clearInterval(stallWatchdogRef.current);
      stallWatchdogRef.current = null;
    }
    watchdogStartedRef.current = false;
    stallTicksRef.current = 0;
    flvRetryCountRef.current = 0;
    flvRetryInProgressRef.current = false;
    if (mpegtsPlayerRef.current) {
      mpegtsPlayerRef.current.destroy();
      mpegtsPlayerRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setPlayerModeWithRef(null);
  };

  const connectWebSocket = () => {
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');

    const streamingConfig = RECONNECT_CONFIG.streaming;
    const socket = io(`${wsUrl}/streaming`, {
      transports: ['websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: streamingConfig.maxAttempts,
      reconnectionDelay: streamingConfig.delays[0],
      reconnectionDelayMax: streamingConfig.delays[streamingConfig.delays.length - 1],
    });

    socket.on('connect', () => {
      if (!activeViewerKeys.has(streamKey)) {
        activeViewerKeys.add(streamKey);
        socket.emit('stream:viewer:join', { streamKey });
      }
    });

    // Re-join room after reconnection (WiFi switch, background recovery)
    socket.io.on('reconnect', () => {
      metricsRef.current.reconnectCount++;
      syncKpi();
      if (!activeViewerKeys.has(streamKey)) {
        activeViewerKeys.add(streamKey);
      }
      socket.emit('stream:viewer:join', { streamKey });
      // Report reconnect metrics
      sendStreamMetrics(buildStreamMetrics(streamKey, metricsRef.current, 'RECONNECTING')).catch(
        () => {},
      );
    });

    socket.on(
      'stream:viewer:update',
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
        // Final metrics: session summary on stream end
        sendStreamMetrics(buildStreamMetrics(streamKey, metricsRef.current, 'CONNECTED')).catch(
          () => {},
        );
      }
    });

    socketRef.current = socket;
  };

  const disconnectWebSocket = () => {
    if (socketRef.current) {
      if (activeViewerKeys.has(streamKey)) {
        activeViewerKeys.delete(streamKey);
        socketRef.current.emit('stream:viewer:leave', { streamKey });
      }
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const handleUnmute = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-black">
      <video
        ref={videoRef}
        className="block w-full h-full object-cover"
        playsInline
        muted={isMuted}
        aria-label="Live stream video player"
      />

      {!error && !streamEnded && <LiveBadge />}

      {/* 언뮤트 버튼 — 자동재생 정책으로 음소거 상태일 때 표시 */}
      {isMuted && isPlaying && !streamEnded && !error && (
        <button
          onClick={handleUnmute}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-sm border border-white/20 rounded-full text-white text-sm font-medium hover:bg-black/80 transition-all active:scale-95 z-20"
          aria-label="소리 켜기"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          소리 켜기
        </button>
      )}

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
