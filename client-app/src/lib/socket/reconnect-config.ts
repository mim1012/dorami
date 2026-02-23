/**
 * 중앙 WebSocket 재연결 설정
 *
 * 모든 namespace의 재연결 정책을 한 곳에서 관리한다.
 * - default: 일반 소켓 클라이언트 (socket-client.ts, useProductStock)
 * - streaming: /streaming namespace (VideoPlayer)
 * - chat: /chat namespace (useChatConnection)
 *
 * Circuit Breaker와 연동:
 *   circuitBreakerThreshold → ReconnectionCircuitBreaker(maxFailures)
 *   circuitBreakerCooldownMs → ReconnectionCircuitBreaker(cooldownMs)
 */
export const RECONNECT_CONFIG = {
  default: {
    maxAttempts: 10,
    delays: [500, 1000, 1500, 2000, 3000],
    circuitBreakerThreshold: 5,
    circuitBreakerCooldownMs: 60_000,
    jitterFactor: 0.4, // ±40% 지터
  },
  streaming: {
    maxAttempts: 10,
    delays: [500, 1000, 2000, 3000, 4000],
    circuitBreakerThreshold: 5,
    circuitBreakerCooldownMs: 60_000,
    jitterFactor: 0.4,
  },
  chat: {
    maxAttempts: 10,
    delays: [500, 1000, 1500, 2000, 2500],
    circuitBreakerThreshold: 5,
    circuitBreakerCooldownMs: 30_000, // chat은 더 짧은 쿨다운
    jitterFactor: 0.4,
  },
} as const;

export type ReconnectProfileKey = keyof typeof RECONNECT_CONFIG;
export type ReconnectProfile = (typeof RECONNECT_CONFIG)[ReconnectProfileKey];

/**
 * 지터가 적용된 백오프 딜레이를 반환한다.
 *
 * @param attemptNumber  0-based 재연결 시도 횟수 (Socket.IO reconnect_attempt 이벤트 값 - 1)
 * @param baseDelays     프로파일별 딜레이 배열 (ms). attemptNumber가 배열 범위를 초과하면 마지막 값 사용.
 * @param jitterFactor   지터 비율 (기본 0.4 = ±40%). 0이면 지터 없음.
 * @returns              지터가 적용된 딜레이 (ms, 최솟값 0)
 *
 * 예시: baseDelay=2000, jitterFactor=0.4 → 1600~2400ms 사이 무작위 값
 */
export function getBackoffDelay(
  attemptNumber: number,
  baseDelays: readonly number[],
  jitterFactor: number = 0.4,
): number {
  const baseDelay = baseDelays[Math.min(attemptNumber, baseDelays.length - 1)];
  const jitter = baseDelay * (Math.random() - 0.5) * jitterFactor;
  return Math.max(0, Math.round(baseDelay + jitter));
}
