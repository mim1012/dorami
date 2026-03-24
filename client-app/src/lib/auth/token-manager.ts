/**
 * token-manager.ts
 *
 * WebSocket 재연결 시 JWT 토큰 갱신을 담당하는 유틸리티 모듈.
 *
 * 아키텍처 참고:
 * - accessToken / refreshToken 모두 httpOnly 쿠키로 관리됨
 * - JS에서 토큰 값을 직접 읽을 수 없으므로 만료 여부는
 *   "인증 에러 발생 여부"로 간접 감지한다.
 * - refreshAuthToken()은 client.ts의 refreshAccessToken()에 위임한다.
 *   이를 통해 HTTP 401 재시도와 WebSocket 재연결이 동시에 refresh를 요청해도
 *   실제 POST /api/auth/refresh는 단 하나만 in-flight 상태가 된다.
 */

import { refreshAccessToken } from '../api/client';

/**
 * accessToken 쿠키를 갱신한다.
 *
 * 성공 시 true, 실패(refresh token 만료 또는 네트워크 오류) 시 false를 반환한다.
 * 중복 제거는 client.ts의 refreshPromise가 담당하므로 여기서 별도 관리하지 않는다.
 */
export async function refreshAuthToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  return refreshAccessToken();
}

/**
 * WebSocket 인증 에러가 토큰 만료로 인한 것인지 판단한다.
 *
 * accessToken은 httpOnly 쿠키라 JS에서 직접 디코드할 수 없으므로,
 * Socket.IO connect_error의 메시지 또는 data 필드를 통해 판단한다.
 *
 * 백엔드 authenticateSocket()이 토큰 만료 시 'TOKEN_EXPIRED' 또는
 * 'jwt expired' 메시지를 에러로 보내는 경우를 처리한다.
 */
export function isAuthError(error: Error): boolean {
  const msg = error.message?.toLowerCase() ?? '';
  const data = (error as any).data;

  const tokenExpiredPatterns = [
    'token_expired',
    'jwt expired',
    'token expired',
    'unauthorized',
    'authentication failed',
    'authentication error',
    'invalid token',
    'no token provided',
    'token has been revoked',
    'account is suspended',
  ];

  if (tokenExpiredPatterns.some((pattern) => msg.includes(pattern))) {
    return true;
  }

  // Socket.IO가 data 필드에 에러 코드를 담는 경우
  if (data && typeof data === 'object') {
    const dataMsg = (data.message ?? data.errorCode ?? '').toLowerCase();
    return tokenExpiredPatterns.some((pattern) => dataMsg.includes(pattern));
  }

  return false;
}

/**
 * 토큰 갱신 실패 시 사용자를 로그인 페이지로 강제 이동시킨다.
 * Zustand auth-storage를 먼저 제거해 로그인 페이지가 stale 상태를 보지 않도록 한다.
 */
export function forceLogout(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem('auth-storage');
  } catch {
    // localStorage가 비활성화된 환경(시크릿 모드 등) 무시
  }

  window.location.href = '/login?reason=session_expired';
}
