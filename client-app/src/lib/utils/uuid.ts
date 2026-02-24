/**
 * uuid.ts
 *
 * 브라우저 호환 ID 생성 유틸리티.
 * crypto.randomUUID()는 Safari 구형 버전 및 비-HTTPS 환경에서 미지원되므로
 * 폴리필 방식으로 구현한다.
 */

/**
 * 고유 ID를 생성한다.
 * crypto.randomUUID가 사용 가능하면 이를 우선 사용하고,
 * 그렇지 않으면 timestamp + random 조합으로 대체한다.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // 폴리필: timestamp(밀리초) + random 36진수 문자열 조합
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
