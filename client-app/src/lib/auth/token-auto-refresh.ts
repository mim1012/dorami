'use client';

import { useEffect } from 'react';
import { refreshAuthToken, forceLogout } from './token-manager';

const FALLBACK_REFRESH_INTERVAL_MS = 45 * 60 * 1000; // 45분 (마지막 갱신 이후 목표 주기)
const JITTER_MAX_MS = 3 * 60 * 1000; // 0~3분 랜덤
const MIN_REFRESH_DELAY_MS = 30_000; // 최소 30초 (너무 빨리 재시도 방지)
const RETRY_DELAYS = [5_000, 15_000, 30_000]; // 3회 retry (jitter 추가됨)
const DEFAULT_MAX_CONSECUTIVE_REFRESH_FAILURES = 4;
const BROADCAST_SLOW_RETRY_MS = 10 * 60 * 1000; // 방송 모드 suspend 후 10분마다 재시도
const LAST_REFRESH_LS_KEY = 'dorami-last-token-refresh';

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
 * 다음 refresh 시점을 계산한다.
 *
 * localStorage에 저장된 마지막 갱신 시각을 읽어 남은 시간을 계산한다.
 * 예) 마지막 갱신 40분 전 → 5분 후 refresh
 *     마지막 갱신 50분 전 → 30초 후 refresh (stale token 즉시 처리)
 *     기록 없음 → 45분 후 (기존 동작)
 *
 * httpOnly 쿠키라 exp claim을 직접 읽을 수 없으므로 갱신 시각을 추적한다.
 * client.ts refreshAccessToken()이 성공 시 LAST_REFRESH_LS_KEY를 기록한다.
 */
function getNextRefreshDelay(): number {
  try {
    const lastRefreshRaw = localStorage.getItem(LAST_REFRESH_LS_KEY);
    if (lastRefreshRaw) {
      const elapsed = Date.now() - parseInt(lastRefreshRaw, 10);
      const remaining = FALLBACK_REFRESH_INTERVAL_MS - elapsed;
      const delay = remaining + Math.random() * JITTER_MAX_MS;
      return Math.max(MIN_REFRESH_DELAY_MS, delay);
    }
  } catch {
    // localStorage 비활성화(시크릿 모드 등) — fallback
  }
  return FALLBACK_REFRESH_INTERVAL_MS + Math.random() * JITTER_MAX_MS;
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
            if (!suspendForBroadcast) {
              console.error('[TokenAutoRefresh] Token refresh failed - forcing logout');
              forceLogout();
              return;
            } else {
              // 방송 모드: 강제 로그아웃 대신 10분마다 조용히 재시도한다.
              // 일시적 네트워크 장애 후 복구되면 정상 주기로 복귀한다.
              console.warn('[TokenAutoRefresh] Broadcast mode: slow retry in 10min');
              consecutiveRefreshFailures = 0;
              if (!cancelled) {
                timeoutId = setTimeout(
                  refreshCycle,
                  BROADCAST_SLOW_RETRY_MS + Math.random() * JITTER_MAX_MS,
                );
              }
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
  }, [streamKey, maxConsecutiveFailures, suspendForBroadcast]);
}
