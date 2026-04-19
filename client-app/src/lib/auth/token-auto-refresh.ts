'use client';

import { useEffect } from 'react';
import { refreshAuthToken, forceLogout } from './token-manager';

const FALLBACK_REFRESH_INTERVAL_MS = 8 * 60 * 1000; // 8분 (15분 access 만료 전에 선제 갱신)
const JITTER_MAX_MS = 2 * 60 * 1000; // 0~2분 랜덤
const RETRY_DELAYS = [5_000, 15_000, 30_000]; // 3회 retry (jitter 추가됨)
const DEFAULT_MAX_CONSECUTIVE_REFRESH_FAILURES = 4;

type AutoRefreshOptions = {
  /**
   * true이면 갱신 실패 시에도 강제로 로그아웃하지 않는다.
   * 방송/시청 중 화면처럼 장시간 유지가 중요한 화면에서 사용.
   */
  suspendForBroadcast?: boolean;
  /**
   * 연속 실패 시 로그아웃을 허용하는 임계값.
   * 기본값은 4회.
   */
  maxConsecutiveFailures?: number;
  /**
   * 인증된 세션일 때만 자동 갱신 루프를 실행한다.
   */
  enabled?: boolean;
};

/**
 * 서버 exp claim을 직접 읽을 수 없으므로 access 만료(15분)보다 충분히 이른 시점에
 * fallback refresh를 실행한다. 각 탭이 동시에 refresh하지 않도록 작은 jitter를 더한다.
 */
function getNextRefreshDelay(): number {
  const jitter = Math.random() * JITTER_MAX_MS;
  return FALLBACK_REFRESH_INTERVAL_MS + jitter;
}

/**
 * retry 시 jitter 포함 delay 계산
 */
function getRetryDelay(attempt: number): number {
  const baseDelay = RETRY_DELAYS[attempt] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1];
  const jitter = Math.random() * 3000; // 0~3초
  return baseDelay + jitter;
}

function shouldPreserveSessionUi(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const pathname = window.location.pathname || '/';
  return pathname === '/' || pathname.startsWith('/live');
}

/**
 * useTokenAutoRefresh
 *
 * 인증된 세션에 대해 setTimeout 기반으로 access token을 선제 갱신한다.
 *
 * - setTimeout 기반 (setInterval 대신) — 매 refresh 후 다음 시점 재계산
 * - 실패 시 3회 retry with exponential backoff + jitter
 * - 연속 실패 임계값(4회) 초과 시 forceLogout (broadcast mode 제외)
 */
export function useTokenAutoRefresh(streamKey: string, options: AutoRefreshOptions = {}): void {
  const maxConsecutiveFailures =
    options.maxConsecutiveFailures ?? DEFAULT_MAX_CONSECUTIVE_REFRESH_FAILURES;
  const suspendForBroadcast = options.suspendForBroadcast ?? false;
  const enabled = options.enabled ?? true;

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return;

    let consecutiveRefreshFailures = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    async function attemptRefreshWithRetry(): Promise<boolean> {
      const success = await refreshAuthToken();
      if (success) return true;

      // Retry with backoff + jitter
      for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
        if (cancelled) return false;
        const delay = getRetryDelay(attempt);
        await new Promise((r) => setTimeout(r, delay));
        if (cancelled) return false;

        const retrySuccess = await refreshAuthToken();
        if (retrySuccess) return true;
      }

      return false;
    }

    async function refreshCycle(): Promise<void> {
      if (cancelled) return;

      try {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[TokenAutoRefresh] Periodic token refresh...');
        }

        const success = await attemptRefreshWithRetry();

        if (success) {
          consecutiveRefreshFailures = 0;
          if (process.env.NODE_ENV !== 'production') {
            console.log('[TokenAutoRefresh] Token refresh succeeded');
          }
        } else {
          consecutiveRefreshFailures += 1;

          if (consecutiveRefreshFailures >= maxConsecutiveFailures) {
            const preserveSessionUi = suspendForBroadcast || shouldPreserveSessionUi();
            console.error('[TokenAutoRefresh] Token refresh failed repeatedly');
            if (preserveSessionUi) {
              console.warn(
                '[TokenAutoRefresh] Preserving current UI instead of forcing logout on live/home.',
              );
            } else {
              forceLogout();
              return;
            }
          }
        }
      } catch (error) {
        console.error('[TokenAutoRefresh] Token refresh error:', error);
      }

      // Schedule next refresh
      if (!cancelled) {
        const nextDelay = getNextRefreshDelay();
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[TokenAutoRefresh] Next refresh in ${Math.round(nextDelay / 60000)}min`);
        }
        timeoutId = setTimeout(refreshCycle, nextDelay);
      }
    }

    // Initial schedule with jitter to prevent sync across tabs
    const initialDelay = getNextRefreshDelay();
    timeoutId = setTimeout(refreshCycle, initialDelay);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [enabled, streamKey, maxConsecutiveFailures, suspendForBroadcast]);
}
