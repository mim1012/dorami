'use client';

import { useAuthStore } from '@/lib/store/auth';
import { useTokenAutoRefresh } from '@/lib/auth/token-auto-refresh';

/**
 * 인증된 사용자에게만 토큰 자동 갱신 타이머를 실행한다.
 *
 * - 모든 인증 필요 페이지(관리자, 카트, 주문 등)에서 공통 적용
 * - suspendForBroadcast: true — 연속 실패 시 강제 로그아웃 대신 10분 slow-retry
 *   (실제 세션 만료는 client.ts의 401 핸들러가 페이지별로 처리)
 * - 로그아웃 시 컴포넌트 언마운트 → 타이머 자동 정리
 */
function TokenRefreshInner() {
  useTokenAutoRefresh('global', { suspendForBroadcast: true });
  return null;
}

export function TokenRefreshProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <>
      {isAuthenticated && <TokenRefreshInner />}
      {children}
    </>
  );
}
