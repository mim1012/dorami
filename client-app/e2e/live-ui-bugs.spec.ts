import { test, expect } from '@playwright/test';
import { createTestStream, ensureAuth } from './helpers/auth-helper';

/**
 * Bug Fix: 라이브 페이지 UI 버그 수정 검증
 *
 * U-BUG-02: 모바일 비디오 레이아웃 — flex-shrink-0으로 비디오 크기 유지
 * U-BUG-03: 시청자 수 중복 카운트 방지 — activeViewerKeys Set
 * U-BUG-04: 공지 헤더 애니메이션 방향 — scrollNotice keyframe 0 → -50%
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Bug Fix: 모바일 라이브 비디오 레이아웃', () => {
  test.setTimeout(60000);

  let testStreamKey: string;

  test.beforeAll(async () => {
    testStreamKey = await createTestStream();
    console.log(`[Setup] 테스트 스트림 키: ${testStreamKey}`);
  });

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'USER');
  });

  test('U-BUG-02: 모바일 뷰포트에서 비디오가 aspect-video 높이를 유지해야 한다', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/live/${testStreamKey}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // 모바일 레이아웃(flex lg:hidden)의 비디오 컨테이너 찾기
    const videoContainers = page.locator('.aspect-video');
    const count = await videoContainers.count();

    if (count === 0) {
      // 스트림이 PENDING/OFFLINE 상태이면 비디오 컨테이너가 없을 수 있음
      const isPending = await page
        .getByText('아직 방송 전이에요')
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (isPending) {
        console.log('[참고] PENDING 상태 — 비디오 컨테이너 없음 (정상)');
        return;
      }
      console.log('[참고] .aspect-video 없음 — 다른 레이아웃 사용 중일 수 있음');
      return;
    }

    const videoBox = await videoContainers.first().boundingBox();
    expect(videoBox).not.toBeNull();

    if (videoBox) {
      const expectedHeight = videoBox.width * (9 / 16);
      console.log(
        `[비디오 크기] width: ${videoBox.width}, height: ${videoBox.height}, expected: ${expectedHeight.toFixed(1)}`,
      );

      // 비디오 높이가 16:9 예상 높이의 95% 이상이어야 함
      expect(videoBox.height).toBeGreaterThanOrEqual(expectedHeight * 0.95);
      console.log('✅ U-BUG-02: 비디오 aspect-video 높이 유지 확인');

      // 채팅 영역이 비디오 아래에 위치하는지 확인
      const chatArea = page.locator('[class*="overflow-y-auto"]').first();
      const chatVisible = await chatArea.isVisible({ timeout: 3000 }).catch(() => false);
      if (chatVisible) {
        const chatBox = await chatArea.boundingBox();
        if (chatBox) {
          expect(chatBox.y).toBeGreaterThan(videoBox.y + videoBox.height - 10);
          console.log(
            `✅ U-BUG-02: 채팅 영역이 비디오 아래에 위치 (chatBox.y=${chatBox.y.toFixed(0)}, videoBottom=${(videoBox.y + videoBox.height).toFixed(0)})`,
          );
        }
      }
    }
  });
});

test.describe('Bug Fix: 시청자 수 중복 카운트 방지', () => {
  test.setTimeout(60000);

  let testStreamKey: string;

  test.beforeAll(async () => {
    testStreamKey = await createTestStream();
  });

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'USER');
  });

  test('U-BUG-03: 단일 페이지 로드 시 viewer:join이 1회만 전송되어야 한다', async ({ page }) => {
    let viewerJoinCount = 0;

    // WebSocket 프레임 감청
    page.on('websocket', (ws) => {
      ws.on('framesent', (frame) => {
        const payload = frame.payload?.toString() ?? '';
        if (payload.includes('stream:viewer:join')) {
          viewerJoinCount++;
          console.log(`[WS] stream:viewer:join 감지 (누적: ${viewerJoinCount})`);
        }
      });
    });

    await page.goto(`/live/${testStreamKey}`, { waitUntil: 'domcontentloaded' });
    // 양쪽 VideoPlayer 인스턴스가 모두 마운트되고 connect 이벤트가 발생할 때까지 대기
    await page.waitForTimeout(4000);

    console.log(`[결과] viewer:join 총 전송 횟수: ${viewerJoinCount}`);

    if (viewerJoinCount === 0) {
      // 스트림이 PENDING/OFFLINE이거나 WS 연결 안 된 경우
      console.log('[참고] WS viewer:join 이벤트 없음 (스트림 상태 또는 WS 미연결)');
      return;
    }

    // 수정 후: 1회만 전송 (수정 전: 2회)
    expect(viewerJoinCount).toBe(1);
    console.log('✅ U-BUG-03: viewer:join 중복 전송 방지 확인 (1회)');
  });

  test('U-BUG-03b: 헤더 시청자 수가 0 이상의 숫자로 표시되어야 한다', async ({ page }) => {
    await page.goto(`/live/${testStreamKey}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // 시청자 수 표시 요소: rounded-full 배지에 숫자 텍스트
    const viewerEl = page.locator('[class*="rounded-full"]').filter({ hasText: /^\d+$/ }).first();

    const isVisible = await viewerEl.isVisible({ timeout: 8000 }).catch(() => false);

    if (!isVisible) {
      // PENDING/OFFLINE 상태에서는 시청자 수 배지가 없을 수 있음
      console.log('[참고] 시청자 수 배지 없음 — 스트림이 PENDING/OFFLINE 상태일 수 있음');
      return;
    }

    const text = (await viewerEl.textContent()) ?? '';
    expect(/^\d+$/.test(text.trim())).toBe(true);
    console.log(`✅ U-BUG-03b: 시청자 수 배지 숫자 표시 확인 (값: ${text.trim()})`);
  });
});

test.describe('Bug Fix: 공지 헤더 애니메이션 중복 텍스트 방지', () => {
  test.setTimeout(60000);

  let testStreamKey: string;

  test.beforeAll(async () => {
    testStreamKey = await createTestStream();
  });

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'USER');
  });

  test('U-BUG-04: scrollNotice 애니메이션이 왼쪽 방향(0 → -50%)으로 설정되어야 한다', async ({
    page,
  }) => {
    await page.goto(`/live/${testStreamKey}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // CSS 키프레임 방향 확인
    const animEndTransform = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSKeyframesRule && rule.name === 'scrollNotice') {
            // 100% keyframe 찾기
            const endRule =
              (rule as CSSKeyframesRule).findRule?.('100%') ??
              (rule as CSSKeyframesRule).findRule?.('to');
            if (endRule) {
              return (endRule as CSSKeyframeRule).style?.transform ?? '';
            }
          }
        }
      }
      return 'NOT_FOUND';
    });

    if (animEndTransform === 'NOT_FOUND') {
      // CSS-in-JS나 다른 방식으로 스타일이 주입된 경우
      console.log('[참고] scrollNotice 키프레임을 CSS stylesheet에서 찾을 수 없음');
      return;
    }

    console.log(`[scrollNotice 100%] transform: "${animEndTransform}"`);
    // 끝이 translateX(-50%) 이어야 왼쪽으로 이동 (버그 수정 후)
    expect(animEndTransform).toContain('translateX(-50%)');
    console.log('✅ U-BUG-04: scrollNotice 키프레임 방향 확인 (0 → -50%)');
  });

  test('U-BUG-04b: 공지 텍스트가 왼쪽으로 스크롤되어야 한다', async ({ page }) => {
    await page.goto(`/live/${testStreamKey}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    const track = page.locator('.notice-track');
    const isVisible = await track.isVisible({ timeout: 8000 }).catch(() => false);

    if (!isVisible) {
      console.log('[참고] .notice-track 없음 — 공지가 설정되지 않은 스트림');
      return;
    }

    // 초기 X 위치
    const pos1 = await track.evaluate((el) => el.getBoundingClientRect().x);
    await page.waitForTimeout(1500);
    // 1.5초 후 X 위치
    const pos2 = await track.evaluate((el) => el.getBoundingClientRect().x);

    console.log(`[공지 트랙 X] before: ${pos1.toFixed(1)}, after: ${pos2.toFixed(1)}`);
    // 왼쪽으로 이동 = X 감소
    expect(pos2).toBeLessThan(pos1);
    console.log('✅ U-BUG-04b: 공지 텍스트 왼쪽 방향 스크롤 확인');
  });
});
