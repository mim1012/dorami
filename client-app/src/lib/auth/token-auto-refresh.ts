'use client';

import { useEffect } from 'react';
import { refreshAuthToken, forceLogout } from './token-manager';

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10분

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
export function useTokenAutoRefresh(streamKey: string): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const interval = setInterval(async () => {
      try {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[TokenAutoRefresh] Periodic token refresh...');
        }

        const success = await refreshAuthToken();

        if (!success) {
          console.error('[TokenAutoRefresh] Token refresh failed - forcing logout');
          forceLogout();
        } else if (process.env.NODE_ENV !== 'production') {
          console.log('[TokenAutoRefresh] Token refreshed successfully');
        }
      } catch (error) {
        // 네트워크 일시 오류 등은 다음 주기에 재시도 — 즉시 로그아웃 불필요
        console.error('[TokenAutoRefresh] Token refresh error:', error);
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [streamKey]);
}
