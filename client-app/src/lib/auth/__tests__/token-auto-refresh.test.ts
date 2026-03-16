/**
 * Unit tests for useTokenAutoRefresh
 *
 * 수정 사항 검증:
 * 1. consecutiveRefreshFailures가 모듈 레벨이 아닌 인스턴스별 독립 카운터임
 * 2. 연속 2회 실패 시 forceLogout 호출
 * 3. suspendForBroadcast 옵션이 true면 forceLogout 호출 안 함
 * 4. 성공 시 카운터 리셋
 * 5. 네트워크 예외 발생 시 로그아웃 안 함
 */

// ── 모듈 mock ─────────────────────────────────────────────────────────────────

jest.mock('../token-manager', () => ({
  refreshAuthToken: jest.fn(),
  forceLogout: jest.fn(),
}));

// useEffect를 동기 실행으로 대체
jest.mock('react', () => ({
  useEffect: (fn: () => (() => void) | void) => {
    fn();
  },
}));

import { refreshAuthToken, forceLogout } from '../token-manager';
import { useTokenAutoRefresh } from '../token-auto-refresh';

const mockRefreshAuthToken = refreshAuthToken as jest.MockedFunction<typeof refreshAuthToken>;
const mockForceLogout = forceLogout as jest.MockedFunction<typeof forceLogout>;

// ── helper ────────────────────────────────────────────────────────────────────

function getIntervalCallback(
  streamKey = 'test-stream',
  options: Parameters<typeof useTokenAutoRefresh>[1] = {},
): () => Promise<void> {
  let captured: (() => Promise<void>) | null = null;

  jest.spyOn(global, 'setInterval').mockImplementationOnce((fn: any) => {
    captured = fn;
    return 0 as any;
  });

  (global as any).window = {};
  useTokenAutoRefresh(streamKey, options);
  delete (global as any).window;

  if (!captured) throw new Error('setInterval callback not captured');
  return captured;
}

// 15초 retry setTimeout을 포함한 전체 tick 완료
async function runTick(tick: () => Promise<void>): Promise<void> {
  const p = tick();
  await jest.advanceTimersByTimeAsync(15_001); // 15초 retry delay 통과
  await p;
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe('useTokenAutoRefresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('성공 시 forceLogout을 호출하지 않는다', async () => {
    mockRefreshAuthToken.mockResolvedValue(true);

    const tick = getIntervalCallback();
    await tick(); // 성공은 retry setTimeout 없음

    expect(mockForceLogout).not.toHaveBeenCalled();
  });

  test('2회 연속 실패(1차+retry) 시 forceLogout을 호출한다', async () => {
    mockRefreshAuthToken.mockResolvedValue(false);

    const tick = getIntervalCallback();
    await runTick(tick);

    expect(mockForceLogout).toHaveBeenCalledTimes(1);
  });

  test('1차 실패 후 retry 성공 시 forceLogout 호출 안 함', async () => {
    mockRefreshAuthToken
      .mockResolvedValueOnce(false) // 1차 실패
      .mockResolvedValueOnce(true); // retry 성공

    const tick = getIntervalCallback();
    await runTick(tick);

    expect(mockForceLogout).not.toHaveBeenCalled();
  });

  test('성공 후 카운터가 리셋되어 다음 실패 사이클이 독립적으로 동작한다', async () => {
    mockRefreshAuthToken
      .mockResolvedValueOnce(true) // tick1: 성공 → 카운터 0
      .mockResolvedValueOnce(false) // tick2: 1차 실패
      .mockResolvedValueOnce(false); // tick2: retry 실패 → 카운터 2 → 로그아웃

    const tick = getIntervalCallback();

    await tick(); // tick1: 성공
    expect(mockForceLogout).not.toHaveBeenCalled();

    await runTick(tick); // tick2: 실패 사이클

    expect(mockForceLogout).toHaveBeenCalledTimes(1);
  });

  test('suspendForBroadcast=true면 임계값 초과 시에도 forceLogout 호출 안 함', async () => {
    mockRefreshAuthToken.mockResolvedValue(false);

    const tick = getIntervalCallback('stream', { suspendForBroadcast: true });
    await runTick(tick);

    expect(mockForceLogout).not.toHaveBeenCalled();
  });

  test('네트워크 예외 발생 시 forceLogout을 호출하지 않는다', async () => {
    mockRefreshAuthToken.mockRejectedValue(new Error('Network error'));

    const tick = getIntervalCallback();
    await tick();

    expect(mockForceLogout).not.toHaveBeenCalled();
  });

  // ── 핵심 수정 검증: 인스턴스별 독립 카운터 ──────────────────────────────────
  //
  // 버그: 모듈 레벨 변수 → 인스턴스 A의 실패가 B 카운터에 누적
  // 수정: useEffect 클로저 내부 선언 → 각 인스턴스 독립

  test('두 인스턴스의 실패 카운터는 서로 독립적이다', async () => {
    // 인스턴스 A: 1차 실패 + retry 성공 → 카운터 0으로 리셋
    mockRefreshAuthToken
      .mockResolvedValueOnce(false) // A: 1차 실패
      .mockResolvedValueOnce(true); // A: retry 성공

    const tickA = getIntervalCallback('stream-a');
    await runTick(tickA);
    expect(mockForceLogout).not.toHaveBeenCalled();

    // 인스턴스 B: 1차 실패 + retry 실패 → B 카운터 독립적으로 0→2
    // 모듈 레벨 버그였다면 A의 1회 실패가 남아있어 B 첫 1차 실패만으로 바로 로그아웃
    mockRefreshAuthToken
      .mockResolvedValueOnce(false) // B: 1차 실패 (카운터: 0→1)
      .mockResolvedValueOnce(false); // B: retry 실패 (카운터: 1→2 → 로그아웃)

    const tickB = getIntervalCallback('stream-b');
    await runTick(tickB);

    // B가 자체 2회 실패로 로그아웃
    expect(mockForceLogout).toHaveBeenCalledTimes(1);
  });

  test('maxConsecutiveFailures=1이면 1회 실패 사이클 후 즉시 로그아웃한다', async () => {
    mockRefreshAuthToken
      .mockResolvedValueOnce(false) // 1차 실패 (카운터: 0→1)
      .mockResolvedValueOnce(false); // retry 실패 (카운터: 1→2, threshold=1 초과)

    const tick = getIntervalCallback('stream', { maxConsecutiveFailures: 1 });
    await runTick(tick);

    expect(mockForceLogout).toHaveBeenCalledTimes(1);
  });
});
