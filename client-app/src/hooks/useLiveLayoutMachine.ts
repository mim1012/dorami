'use client';

import { useReducer, useMemo, useCallback } from 'react';

// ── A. Connection FSM ──────────────────────────────────────────────────────────
export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'retrying'
  | 'offline'
  | 'ended';

// ── B. Stream FSM ──────────────────────────────────────────────────────────────
export type StreamState =
  | 'unknown'
  | 'waiting_manifest'
  | 'playing'
  | 'stalled'
  | 'error'
  | 'no_stream';

// ── C. UI Mode FSM ─────────────────────────────────────────────────────────────
export type UIModeState = 'normal' | 'controls' | 'typing' | 'product_focus';

// ── D. Overlay ─────────────────────────────────────────────────────────────────
export interface OverlayState {
  notice: 'hidden' | 'showing';
  toast: 'none' | 'error' | 'info';
}

// ── Event union ────────────────────────────────────────────────────────────────
export type LiveEvent =
  // Connection
  | { type: 'CONNECT_START' }
  | { type: 'CONNECT_OK' }
  | { type: 'CONNECT_FAIL' }
  | { type: 'RETRY_TICK' }
  | { type: 'STREAM_ENDED' }
  // Stream
  | { type: 'MANIFEST_OK' }
  | { type: 'MANIFEST_TIMEOUT' }
  | { type: 'PLAY_OK' }
  | { type: 'STALL' }
  | { type: 'MEDIA_ERROR' }
  // UI Mode
  | { type: 'TAP_SCREEN' }
  | { type: 'OPEN_KEYBOARD' }
  | { type: 'CLOSE_KEYBOARD' }
  | { type: 'OPEN_PRODUCT_PANEL' }
  | { type: 'CLOSE_PRODUCT_PANEL' }
  // Overlay
  | { type: 'NOTICE_SHOW' }
  | { type: 'NOTICE_HIDE' }
  | { type: 'TOAST_SHOW'; toast: 'error' | 'info' }
  | { type: 'TOAST_CLEAR' };

// ── Snapshot ───────────────────────────────────────────────────────────────────
export type LiveSnapshot = 'LIVE_NORMAL' | 'LIVE_TYPING' | 'RETRYING' | 'NO_STREAM' | 'ENDED';

// ── Layout descriptor ──────────────────────────────────────────────────────────
export interface LiveLayout {
  topBar: { visible: boolean; dim: boolean };
  notice: { visible: boolean };
  chat: { visible: boolean; bottom: string };
  productCard: { visible: boolean };
  bottomInput: { visible: boolean; disabled: boolean };
  centerOverlay: { visible: boolean; message: string };
}

// ── Pure helpers (exported for unit tests) ─────────────────────────────────────

export function deriveSnapshot(
  connection: ConnectionState,
  stream: StreamState,
  uiMode: UIModeState,
): LiveSnapshot {
  if (connection === 'ended') return 'ENDED';
  if (connection === 'offline' || connection === 'retrying') return 'RETRYING';
  if (stream === 'no_stream') return 'NO_STREAM';
  if (uiMode === 'typing') return 'LIVE_TYPING';
  return 'LIVE_NORMAL';
}

export function computeLayout(snapshot: LiveSnapshot, hasFeatured: boolean): LiveLayout {
  const chatBottomFeatured =
    'calc(var(--live-bottom-bar-h) + var(--live-product-bar-h) + var(--live-gap) + env(safe-area-inset-bottom, 0px))';
  const chatBottomNormal =
    'calc(var(--live-bottom-bar-h) + var(--live-gap) + env(safe-area-inset-bottom, 0px))';

  switch (snapshot) {
    case 'LIVE_NORMAL':
      return {
        topBar: { visible: true, dim: false },
        notice: { visible: true },
        chat: { visible: true, bottom: hasFeatured ? chatBottomFeatured : chatBottomNormal },
        productCard: { visible: hasFeatured },
        bottomInput: { visible: true, disabled: false },
        centerOverlay: { visible: false, message: '' },
      };

    case 'LIVE_TYPING':
      return {
        topBar: { visible: true, dim: true },
        notice: { visible: false },
        chat: {
          visible: true,
          bottom: 'calc(var(--live-bottom-bar-h) + env(safe-area-inset-bottom, 0px))',
        },
        productCard: { visible: false },
        bottomInput: { visible: true, disabled: false },
        centerOverlay: { visible: false, message: '' },
      };

    case 'RETRYING':
      return {
        topBar: { visible: true, dim: false },
        notice: { visible: false },
        chat: { visible: false, bottom: '0' },
        productCard: { visible: false },
        bottomInput: { visible: true, disabled: true },
        centerOverlay: { visible: true, message: '네트워크 오류. 재연결 중...' },
      };

    case 'NO_STREAM':
      return {
        topBar: { visible: true, dim: false },
        notice: { visible: true },
        chat: { visible: false, bottom: '0' },
        productCard: { visible: false },
        bottomInput: { visible: true, disabled: true },
        centerOverlay: { visible: true, message: '방송을 기다리는 중입니다' },
      };

    case 'ENDED':
      return {
        topBar: { visible: false, dim: false },
        notice: { visible: false },
        chat: { visible: false, bottom: '0' },
        productCard: { visible: false },
        bottomInput: { visible: false, disabled: true },
        centerOverlay: { visible: true, message: '방송이 종료되었습니다' },
      };
  }
}

// ── Reducers (private) ─────────────────────────────────────────────────────────

function connectionReducer(state: ConnectionState, event: LiveEvent): ConnectionState {
  switch (event.type) {
    case 'CONNECT_START':
      if (state === 'idle' || state === 'connected' || state === 'offline') return 'connecting';
      return state;
    case 'CONNECT_OK':
      return 'connected';
    case 'CONNECT_FAIL':
      if (state === 'connected') return 'offline';
      if (state === 'connecting' || state === 'retrying') return 'retrying';
      return 'offline';
    case 'RETRY_TICK':
      if (state === 'offline') return 'retrying';
      return state;
    case 'STREAM_ENDED':
      return 'ended';
    default:
      return state;
  }
}

function streamReducer(state: StreamState, event: LiveEvent): StreamState {
  switch (event.type) {
    case 'MANIFEST_OK':
      return 'waiting_manifest';
    case 'MANIFEST_TIMEOUT':
      return 'no_stream';
    case 'PLAY_OK':
      return 'playing';
    case 'STALL':
      return 'stalled';
    case 'MEDIA_ERROR':
      return 'error';
    case 'STREAM_ENDED':
      return 'no_stream';
    default:
      return state;
  }
}

function uiModeReducer(state: UIModeState, event: LiveEvent): UIModeState {
  switch (event.type) {
    case 'OPEN_KEYBOARD':
      return 'typing';
    case 'CLOSE_KEYBOARD':
      if (state === 'typing') return 'normal';
      return state;
    case 'TAP_SCREEN':
      if (state === 'normal') return 'controls';
      if (state === 'controls') return 'normal';
      return state;
    case 'OPEN_PRODUCT_PANEL':
      return 'product_focus';
    case 'CLOSE_PRODUCT_PANEL':
      if (state === 'product_focus') return 'normal';
      return state;
    default:
      return state;
  }
}

function overlayReducer(state: OverlayState, event: LiveEvent): OverlayState {
  switch (event.type) {
    case 'NOTICE_SHOW':
      return { ...state, notice: 'showing' };
    case 'NOTICE_HIDE':
      return { ...state, notice: 'hidden' };
    case 'TOAST_SHOW':
      return { ...state, toast: (event as Extract<LiveEvent, { type: 'TOAST_SHOW' }>).toast };
    case 'TOAST_CLEAR':
      return { ...state, toast: 'none' };
    default:
      return state;
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useLiveLayoutMachine() {
  const [connection, dispatchConnection] = useReducer(connectionReducer, 'idle');
  const [stream, dispatchStream] = useReducer(streamReducer, 'unknown');
  const [uiMode, dispatchUI] = useReducer(uiModeReducer, 'normal');
  const [overlay, dispatchOverlay] = useReducer(overlayReducer, {
    notice: 'hidden',
    toast: 'none',
  });

  const dispatch = useCallback(
    (event: LiveEvent) => {
      switch (event.type) {
        // Connection events
        case 'CONNECT_START':
        case 'CONNECT_OK':
        case 'CONNECT_FAIL':
        case 'RETRY_TICK':
          dispatchConnection(event);
          break;

        // STREAM_ENDED affects both connection and stream FSMs
        case 'STREAM_ENDED':
          dispatchConnection(event);
          dispatchStream(event);
          break;

        // Stream events
        case 'MANIFEST_OK':
        case 'MANIFEST_TIMEOUT':
        case 'PLAY_OK':
        case 'STALL':
        case 'MEDIA_ERROR':
          dispatchStream(event);
          break;

        // UI mode events
        case 'TAP_SCREEN':
        case 'OPEN_KEYBOARD':
        case 'CLOSE_KEYBOARD':
        case 'OPEN_PRODUCT_PANEL':
        case 'CLOSE_PRODUCT_PANEL':
          dispatchUI(event);
          break;

        // Overlay events
        case 'NOTICE_SHOW':
        case 'NOTICE_HIDE':
        case 'TOAST_SHOW':
        case 'TOAST_CLEAR':
          dispatchOverlay(event);
          break;
      }
    },
    // dispatch functions from useReducer are stable — no deps needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const snapshot = useMemo(
    () => deriveSnapshot(connection, stream, uiMode),
    [connection, stream, uiMode],
  );

  return { snapshot, connection, stream, uiMode, overlay, dispatch };
}
