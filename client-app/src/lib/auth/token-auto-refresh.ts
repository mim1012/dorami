'use client';

import { useEffect } from 'react';
import { refreshAuthToken, forceLogout } from './token-manager';

const FALLBACK_REFRESH_INTERVAL_MS = 45 * 60 * 1000; // 45분 (token decode 실패 시)
const BUFFER_BEFORE_EXPIRY_MS = 5 * 60 * 1000; // 만료 5분 전
const JITTER_MAX_MS = 3 * 60 * 1000; // 0~3분 랜덤
const MIN_REFRESH_DELAY_MS = 30_000; // 최소 30초
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
};

/**
 * Access token의 exp claim에서 다음 refresh 시점을 계산한다.
 * token.exp - 5분 + random(0~3분) jitter로 동시 refresh를 분산.
 */
function getNextRefreshDelay(): number {
  try {
    // httpOnly 쿠키라 직접 읽을 수 없음 — fallback 사용
    // 서버에서 token 발급 시 exp를 알 수 없으므로 고정 간격 + jitter
    const jitter = Math.random() * JITTER_MAX_MS;
    return FALLBACK_REFRESH_INTERVAL_MS + jitter;
  } catch {
    return FALLBACK_REFRESH_INTERVAL_MS;
  }
}

/**
 * retry 시 jitter 포함 delay 계산
 */
function getRetryDelay(attempt: number): number {
  const baseDelay = RETRY_DELAYS[attempt] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1];
  const jitter = Math.random() * 3000; // 0~3초
  return baseDelay + jitter;
}

/**
 * useTokenAutoRefresh
 *
 * 라이브 스트림 페이지에서 장기 방송(3시간+) 지원을 위해
 * token.exp 기준 + jitter로 JWT accessToken을 자동 갱신한다.
 *
 * - setTimeout 기반 (setInterval 대신) — 매 refresh 후 다음 시점 재계산
 * - 실패 시 3회 retry with exponential backoff + jitter
 * - 연속 실패 임계값(4회) 초과 시 forceLogout (broadcast mode 제외)
 *
 * @param streamKey - 스트림 키 (의존성 배열용, 스트림 변경 시 타이머 재시작)
 */
export function useTokenAutoRefresh(streamKey: string, options: AutoRefreshOptions = {}): void {
  const maxConsecutiveFailures =
    options.maxConsecutiveFailures ?? DEFAULT_MAX_CONSECUTIVE_REFRESH_FAILURES;
  const suspendForBroadcast = options.suspendForBroadcast ?? false;

  useEffect(() => {
    if (typeof window === 'undefined') return;

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
            console.error('[TokenAutoRefresh] Token refresh failed - forcing logout');
            if (!suspendForBroadcast) {
              forceLogout();
              return;
            } else {
              console.warn(
                '[TokenAutoRefresh] Broadcast mode: skipping logout to avoid interruption.',
              );
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
  }, [streamKey, maxConsecutiveFailures, suspendForBroadcast]);
}
