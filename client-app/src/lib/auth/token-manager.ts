/**
 * token-manager.ts
 *
 * WebSocket 재연결 시 JWT 토큰 갱신을 담당하는 유틸리티 모듈.
 *
 * 아키텍처 참고:
 * - accessToken / refreshToken 모두 httpOnly 쿠키로 관리됨
 * - JS에서 토큰 값을 직접 읽을 수 없으므로 만료 여부는
 *   "인증 에러 발생 여부"로 간접 감지한다.
 * - refreshAuthToken()은 POST /api/auth/refresh를 호출해
 *   백엔드가 새 accessToken 쿠키를 Set-Cookie로 내려주도록 한다.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// 동시 refresh 호출을 단일 요청으로 합산
let refreshInFlight: Promise<boolean> | null = null;

/**
 * accessToken 쿠키를 갱신한다.
 *
 * 성공 시 true, 실패(refresh token 만료 또는 네트워크 오류) 시 false를 반환한다.
 * 여러 WebSocket이 동시에 호출해도 실제 HTTP 요청은 하나만 발생한다.
 */
export async function refreshAuthToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (!refreshInFlight) {
    refreshInFlight = _doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

async function _doRefresh(): Promise<boolean> {
  try {
    // CSRF 토큰 획득 (double-submit cookie 패턴)
    const csrfToken = _getCsrfToken();
    const headers: Record<string, string> = {};
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // 쿠키(refreshToken) 자동 첨부
      headers,
    });

    if (!response.ok) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[TokenManager] Token refresh failed:', response.status);
      }
      return false;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[TokenManager] Token refreshed successfully');
    }
    return true;
  } catch (error) {
    console.error('[TokenManager] Token refresh error:', error);
    return false;
  }
}

function _getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match ? match[1] : null;
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
    'authentication error',
    'invalid token',
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
