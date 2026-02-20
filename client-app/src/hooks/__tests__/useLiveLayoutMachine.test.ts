/**
 * Unit tests for useLiveLayoutMachine pure functions
 * Tests: deriveSnapshot + computeLayout
 */

import { deriveSnapshot, computeLayout } from '../useLiveLayoutMachine';
import type {
  ConnectionState,
  StreamState,
  UIModeState,
  LiveSnapshot,
} from '../useLiveLayoutMachine';

// ── deriveSnapshot ─────────────────────────────────────────────────────────────

describe('deriveSnapshot', () => {
  // Priority 1: connection === 'ended' → ENDED
  test('ended connection always returns ENDED regardless of stream/ui', () => {
    const states: [StreamState, UIModeState][] = [
      ['playing', 'normal'],
      ['no_stream', 'typing'],
      ['error', 'product_focus'],
      ['unknown', 'controls'],
    ];
    for (const [stream, uiMode] of states) {
      expect(deriveSnapshot('ended', stream, uiMode)).toBe('ENDED');
    }
  });

  // Priority 2: offline/retrying → RETRYING
  test('offline connection returns RETRYING', () => {
    expect(deriveSnapshot('offline', 'playing', 'normal')).toBe('RETRYING');
    expect(deriveSnapshot('offline', 'stalled', 'typing')).toBe('RETRYING');
  });

  test('retrying connection returns RETRYING only when stream was actively playing', () => {
    // Stream was playing/stalled/error → RETRYING (chat socket dropped mid-broadcast)
    expect(deriveSnapshot('retrying', 'playing', 'controls')).toBe('RETRYING');
    expect(deriveSnapshot('retrying', 'stalled', 'normal')).toBe('RETRYING');
    // Stream never started → do NOT mask "waiting for stream" with RETRYING
    expect(deriveSnapshot('retrying', 'unknown', 'normal')).toBe('LIVE_NORMAL');
    expect(deriveSnapshot('retrying', 'waiting_manifest', 'normal')).toBe('LIVE_NORMAL');
  });

  // Priority 3: stream === 'no_stream' → NO_STREAM
  test('no_stream returns NO_STREAM when connection is ok', () => {
    expect(deriveSnapshot('connected', 'no_stream', 'normal')).toBe('NO_STREAM');
    expect(deriveSnapshot('idle', 'no_stream', 'typing')).toBe('NO_STREAM');
    expect(deriveSnapshot('connecting', 'no_stream', 'controls')).toBe('NO_STREAM');
  });

  // Priority 4: typing → LIVE_TYPING
  test('typing uiMode returns LIVE_TYPING when stream is active', () => {
    expect(deriveSnapshot('connected', 'playing', 'typing')).toBe('LIVE_TYPING');
    expect(deriveSnapshot('idle', 'unknown', 'typing')).toBe('LIVE_TYPING');
    expect(deriveSnapshot('connected', 'stalled', 'typing')).toBe('LIVE_TYPING');
  });

  // Default → LIVE_NORMAL
  test('connected + playing + normal → LIVE_NORMAL', () => {
    expect(deriveSnapshot('connected', 'playing', 'normal')).toBe('LIVE_NORMAL');
  });

  test('idle + unknown + normal → LIVE_NORMAL (initial state)', () => {
    expect(deriveSnapshot('idle', 'unknown', 'normal')).toBe('LIVE_NORMAL');
  });

  test('connected + stalled + controls → LIVE_NORMAL', () => {
    expect(deriveSnapshot('connected', 'stalled', 'controls')).toBe('LIVE_NORMAL');
  });

  test('connected + error + product_focus → LIVE_NORMAL (error handled downstream)', () => {
    expect(deriveSnapshot('connected', 'error', 'product_focus')).toBe('LIVE_NORMAL');
  });

  // ENDED takes priority over everything
  test('ended beats no_stream priority', () => {
    expect(deriveSnapshot('ended', 'no_stream', 'normal')).toBe('ENDED');
  });

  test('offline + no_stream → NO_STREAM (stream never started, do not show RETRYING)', () => {
    // The FSM intentionally does not return RETRYING when stream is no_stream,
    // because a chat socket retry should not mask the "waiting for broadcast" state.
    expect(deriveSnapshot('offline', 'no_stream', 'normal')).toBe('NO_STREAM');
  });
});

// ── computeLayout ──────────────────────────────────────────────────────────────

describe('computeLayout', () => {
  describe('LIVE_NORMAL', () => {
    test('topBar visible, chat visible, input enabled', () => {
      const layout = computeLayout('LIVE_NORMAL', false);
      expect(layout.topBar.visible).toBe(true);
      expect(layout.topBar.dim).toBe(false);
      expect(layout.chat.visible).toBe(true);
      expect(layout.chat.bottom).toBe('var(--live-gap)');
      expect(layout.bottomInput.visible).toBe(true);
      expect(layout.bottomInput.disabled).toBe(false);
      expect(layout.centerOverlay.visible).toBe(false);
      expect(layout.centerOverlay.message).toBe('');
    });

    test('hasFeatured flag does not change chat.bottom (product card is in static flow)', () => {
      const layoutWithout = computeLayout('LIVE_NORMAL', false);
      const layoutWith = computeLayout('LIVE_NORMAL', true);
      expect(layoutWith.chat.bottom).toBe(layoutWithout.chat.bottom);
    });
  });

  describe('LIVE_TYPING', () => {
    test('dims topBar, chat visible, input enabled', () => {
      const layout = computeLayout('LIVE_TYPING', true);
      expect(layout.topBar.visible).toBe(true);
      expect(layout.topBar.dim).toBe(true);
      expect(layout.chat.visible).toBe(true);
      expect(layout.bottomInput.visible).toBe(true);
      expect(layout.bottomInput.disabled).toBe(false);
      expect(layout.centerOverlay.visible).toBe(false);
    });

    test('hasFeatured=false: same layout as hasFeatured=true', () => {
      const layoutWith = computeLayout('LIVE_TYPING', true);
      const layoutWithout = computeLayout('LIVE_TYPING', false);
      expect(layoutWith.topBar.dim).toBe(layoutWithout.topBar.dim);
      expect(layoutWith.chat.bottom).toBe(layoutWithout.chat.bottom);
    });
  });

  describe('RETRYING', () => {
    test('shows center overlay with reconnect message, disables input', () => {
      const layout = computeLayout('RETRYING', false);
      expect(layout.topBar.visible).toBe(true);
      expect(layout.topBar.dim).toBe(false);
      expect(layout.chat.visible).toBe(false);
      expect(layout.bottomInput.visible).toBe(true);
      expect(layout.bottomInput.disabled).toBe(true);
      expect(layout.centerOverlay.visible).toBe(true);
      expect(layout.centerOverlay.message).toContain('재연결');
    });

    test('hasFeatured does not affect RETRYING layout', () => {
      const l1 = computeLayout('RETRYING', false);
      const l2 = computeLayout('RETRYING', true);
      expect(l1.chat.visible).toBe(l2.chat.visible);
      expect(l1.centerOverlay.message).toBe(l2.centerOverlay.message);
    });
  });

  describe('NO_STREAM', () => {
    test('shows center overlay with waiting message, disables input', () => {
      const layout = computeLayout('NO_STREAM', false);
      expect(layout.topBar.visible).toBe(true);
      expect(layout.chat.visible).toBe(false);
      expect(layout.bottomInput.visible).toBe(true);
      expect(layout.bottomInput.disabled).toBe(true);
      expect(layout.centerOverlay.visible).toBe(true);
      expect(layout.centerOverlay.message).toContain('방송');
    });
  });

  describe('ENDED', () => {
    test('hides everything except center overlay CTA', () => {
      const layout = computeLayout('ENDED', true);
      expect(layout.topBar.visible).toBe(false);
      expect(layout.chat.visible).toBe(false);
      expect(layout.bottomInput.visible).toBe(false);
      expect(layout.bottomInput.disabled).toBe(true);
      expect(layout.centerOverlay.visible).toBe(true);
      expect(layout.centerOverlay.message).toContain('종료');
    });
  });

  // ── Data integrity: CSS values ────────────────────────────────────────────────

  describe('CSS token integrity', () => {
    const snapshots: LiveSnapshot[] = [
      'LIVE_NORMAL',
      'LIVE_TYPING',
      'RETRYING',
      'NO_STREAM',
      'ENDED',
    ];

    test.each(snapshots)('%s: chat.bottom is a valid CSS value string', (snapshot) => {
      const layout = computeLayout(snapshot, true);
      expect(typeof layout.chat.bottom).toBe('string');
      expect(layout.chat.bottom.length).toBeGreaterThan(0);
    });

    test('LIVE_NORMAL chat.bottom is var(--live-gap)', () => {
      const layout = computeLayout('LIVE_NORMAL', true);
      expect(layout.chat.bottom).toBe('var(--live-gap)');
    });
  });

  // ── Exhaustive: all snapshots × hasFeatured combinations return LiveLayout ───

  describe('completeness: all snapshots return a valid LiveLayout shape', () => {
    const snapshots: LiveSnapshot[] = [
      'LIVE_NORMAL',
      'LIVE_TYPING',
      'RETRYING',
      'NO_STREAM',
      'ENDED',
    ];

    test.each(snapshots)('%s returns all required LiveLayout fields', (snapshot) => {
      for (const hasFeatured of [true, false]) {
        const layout = computeLayout(snapshot, hasFeatured);
        expect(typeof layout.topBar.visible).toBe('boolean');
        expect(typeof layout.topBar.dim).toBe('boolean');
        expect(typeof layout.chat.visible).toBe('boolean');
        expect(typeof layout.chat.bottom).toBe('string');
        expect(typeof layout.bottomInput.visible).toBe('boolean');
        expect(typeof layout.bottomInput.disabled).toBe('boolean');
        expect(typeof layout.centerOverlay.visible).toBe('boolean');
        expect(typeof layout.centerOverlay.message).toBe('string');
      }
    });
  });
});
