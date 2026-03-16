'use client';

import { useEffect } from 'react';
import { refreshAuthToken, forceLogout } from './token-manager';

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10분
const DEFAULT_MAX_CONSECUTIVE_REFRESH_FAILURES = 2;

type AutoRefreshOptions = {
  /**
   * true이면 갱신 실패 시에도 강제로 로그아웃하지 않는다.
   * 방송/시청 중 화면처럼 장시간 유지가 중요한 화면에서 사용.
   */
  suspendForBroadcast?: boolean;
  /**
   * 연속 실패 시 로그아웃을 허용하는 임계값.
   * 기본값은 2회.
   */
  maxConsecutiveFailures?: number;
};

/**
 * useTokenAutoRefresh
 *
 * 라이브 스트림 페이지에서 장기 방송(3시간+) 지원을 위해
 * 10분 주기로 JWT accessToken을 자동 갱신한다.
 *
 * - 갱신 실패 시 forceLogout()으로 세션 만료 처리
 * - 연쇄 실패 방지: 갱신 중 에러가 발생해도 interval은 유지되며
 *   단일 실패만 기록 후 다음 주기에 재시도
 * - 단, refreshAuthToken이 false를 반환하면(refresh token 만료) 즉시 로그아웃
 *
 * @param streamKey - 스트림 키 (의존성 배열용, 스트림 변경 시 타이머 재시작)
 */
export function useTokenAutoRefresh(streamKey: string, options: AutoRefreshOptions = {}): void {
  const maxConsecutiveFailures =
    options.maxConsecutiveFailures ?? DEFAULT_MAX_CONSECUTIVE_REFRESH_FAILURES;
  const suspendForBroadcast = options.suspendForBroadcast ?? false;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 컴포넌트 인스턴스별 카운터 — 페이지 이동/언마운트 시 자동 초기화
    let consecutiveRefreshFailures = 0;

    const interval = setInterval(async () => {
      try {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[TokenAutoRefresh] Periodic token refresh...');
        }

        const success = await refreshAuthToken();
        if (!success) {
          consecutiveRefreshFailures += 1;
          // 일시 오류는 15초 뒤 한 번 더 재시도해서 잘못된 네트워크 실패에 즉시 튕김이 생기지 않게 함
          const retried = await new Promise<boolean>((resolve) => {
            setTimeout(async () => {
              try {
                const retryResult = await refreshAuthToken();
                resolve(retryResult);
              } catch {
                resolve(false);
              }
            }, 15_000);
          });

          if (!retried) {
            consecutiveRefreshFailures += 1;
          } else {
            consecutiveRefreshFailures = 0;
          }
        } else {
          consecutiveRefreshFailures = 0;
        }

        if (consecutiveRefreshFailures < maxConsecutiveFailures) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[TokenAutoRefresh] Token refresh recovered');
          }
          return;
        }

        console.error('[TokenAutoRefresh] Token refresh failed - forcing logout');
        if (!suspendForBroadcast) {
          forceLogout();
        } else {
          console.warn('[TokenAutoRefresh] Broadcast mode: skipping logout to avoid interruption.');
        }
      } catch (error) {
        // 네트워크 일시 오류 등은 다음 주기에 재시도 — 즉시 로그아웃 불필요
        console.error('[TokenAutoRefresh] Token refresh error:', error);
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [streamKey, maxConsecutiveFailures, suspendForBroadcast]);
}
