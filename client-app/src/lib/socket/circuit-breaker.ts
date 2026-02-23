/**
 * ReconnectionCircuitBreaker
 *
 * WebSocket 무한 재연결로 인한 배터리/리소스 낭비를 방지하는 서킷 브레이커.
 *
 * 동작 원리:
 * - 연속 실패가 maxFailures(기본 5회)를 넘으면 "열림(OPEN)" 상태로 전환
 * - OPEN 상태에서는 cooldownMs(기본 60초) 동안 재연결 시도를 차단
 * - cooldown 경과 후 다시 "닫힘(CLOSED)"으로 복귀해 재시도 허용
 * - 연결 성공 시 즉시 실패 카운터 초기화
 *
 * 사용 예:
 *   const cb = new ReconnectionCircuitBreaker();
 *   socket.io.on('reconnect_attempt', () => {
 *     if (!cb.canAttemptReconnect()) {
 *       socket.disconnect(); // 차단
 *       return;
 *     }
 *   });
 *   socket.on('connect_error', () => cb.recordFailure());
 *   socket.on('connect', () => cb.recordSuccess());
 */
export class ReconnectionCircuitBreaker {
  private failures = 0;
  private readonly maxFailures: number;
  private readonly cooldownMs: number;
  private lastFailureTime = 0;

  constructor(maxFailures = 5, cooldownMs = 60_000) {
    this.maxFailures = maxFailures;
    this.cooldownMs = cooldownMs;
  }

  /**
   * 재연결 시도 가능 여부를 반환한다.
   *
   * - 실패 횟수가 maxFailures 미만이면 true
   * - maxFailures 이상이어도 cooldown이 지났으면 카운터를 초기화하고 true
   * - cooldown 중이면 false
   */
  canAttemptReconnect(): boolean {
    if (this.failures < this.maxFailures) {
      return true;
    }

    const elapsed = Date.now() - this.lastFailureTime;
    if (elapsed > this.cooldownMs) {
      // cooldown 만료 → 서킷 닫힘(CLOSED) 복귀
      this.failures = 0;
      return true;
    }

    // 서킷 열림(OPEN) — 아직 cooldown 중
    return false;
  }

  /**
   * 연결 실패를 기록한다.
   * connect_error, reconnect_failed 이벤트에서 호출한다.
   */
  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[CircuitBreaker] 실패 기록: ${this.failures}/${this.maxFailures}`,
        this.failures >= this.maxFailures
          ? `— OPEN 상태 진입, ${this.cooldownMs / 1000}초 후 재시도`
          : '',
      );
    }
  }

  /**
   * 연결 성공을 기록하고 실패 카운터를 초기화한다.
   * connect 이벤트에서 호출한다.
   */
  recordSuccess(): void {
    if (this.failures > 0 && process.env.NODE_ENV !== 'production') {
      console.log(`[CircuitBreaker] 연결 성공 — 실패 카운터 초기화 (이전 실패: ${this.failures})`);
    }
    this.failures = 0;
  }

  /**
   * 현재 서킷 상태를 반환한다 (디버깅/테스트용).
   */
  getState(): { failures: number; isOpen: boolean; cooldownRemainingMs: number } {
    const isOpen = this.failures >= this.maxFailures;
    const elapsed = Date.now() - this.lastFailureTime;
    const cooldownRemainingMs = isOpen ? Math.max(0, this.cooldownMs - elapsed) : 0;
    return { failures: this.failures, isOpen, cooldownRemainingMs };
  }
}
