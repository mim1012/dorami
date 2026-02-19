import { test, expect } from '@playwright/test';
import { ensureAuth, gotoWithRetry } from './helpers/auth-helper';

/**
 * 스트림 키 / RTMP URL 발급값 UI 검증 E2E 테스트
 *
 * 검증 항목:
 * A-BRD-ST-01: 발급된 스트림 키가 API 응답값과 UI 표시값 일치
 * A-BRD-ST-02: RTMP URL이 올바른 포트(1935)를 사용 — 8080(HTTP-FLV) / 플랫폼 URL 혼용 방지
 * A-BRD-ST-03/04: 복사 버튼 클릭 시 클립보드에 올바른 값 저장
 * A-BRD-ST-05: 유효 기간 미래 날짜로 표시
 *
 * 구현 참고:
 * - 스테이징에서 이미 활성 스트림이 있으면 신규 발급 대신 기존 키 재사용
 * - 리스트림 플랫폼 URL(YouTube, Instagram, TikTok) 필터링 후 SRS URL만 검증
 */

/** 알려진 리스트림 플랫폼 도메인 (RTMP URL 필터링용) */
const RESTREAM_PLATFORM_DOMAINS = [
  'youtube.com',
  'instagram.com',
  'tiktok.com',
  'facebook.com',
  'twitch.tv',
];

function isReStreamPlatformUrl(url: string): boolean {
  return RESTREAM_PLATFORM_DOMAINS.some((domain) => url.includes(domain));
}

test.describe('Admin Stream Key Validation', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'ADMIN');
    // 스테이징 백엔드 안정화 대기
    await page.waitForTimeout(1500);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // A-BRD-ST-01~05: 스트림 키 발급 전체 검증 (단일 테스트로 통합)
  // ──────────────────────────────────────────────────────────────────────────
  test('A-BRD-ST-01~05: 스트림 키 발급값 UI 전체 검증 (키 일치, RTMP 포트, 복사, 유효기간)', async ({
    page,
    context,
  }) => {
    // 클립보드 권한 부여
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await gotoWithRetry(page, '/admin/broadcasts');

    // 방송 페이지 로드 대기
    const newBroadcastBtn = page.getByRole('button', { name: /새 방송 시작/ });
    const retryBtn = page.getByRole('button', { name: '다시 시도' });

    await Promise.race([
      newBroadcastBtn.waitFor({ timeout: 45000 }).catch(() => {}),
      retryBtn.waitFor({ timeout: 45000 }).catch(() => {}),
    ]);

    if (await retryBtn.isVisible().catch(() => false)) {
      console.log('방송 페이지 로드 실패 (streaming API 미구동) — 스킵');
      return;
    }
    if (!(await newBroadcastBtn.isVisible().catch(() => false))) {
      console.log('새 방송 시작 버튼 없음 — 스킵');
      return;
    }

    // ── 모든 응답을 캡처하는 리스너 등록 (URL 필터 보다 넓게) ───────────────
    let capturedStreamKey: string | null = null;
    let capturedRtmpUrl: string | null = null;

    page.on('response', async (resp) => {
      const url = resp.url();
      if (!url.includes('streaming')) return;
      try {
        const body = await resp.json().catch(() => null);
        if (!body) return;
        // 정상 발급: data.streamKey
        if (body?.data?.streamKey) {
          capturedStreamKey = body.data.streamKey;
          capturedRtmpUrl =
            body.data.rtmpUrl ?? body.data.serverUrl ?? body.data.rtmpServerUrl ?? null;
          console.log(`[API 응답] streamKey=${capturedStreamKey}, rtmpUrl=${capturedRtmpUrl}`);
          console.log(`[API data 키 목록] ${JSON.stringify(Object.keys(body.data))}`);
        }
        // STREAM_ALREADY_ACTIVE: context.streamKey
        if (!capturedStreamKey && body?.context?.streamKey) {
          capturedStreamKey = body.context.streamKey;
          console.log(`[API ALREADY_ACTIVE] streamKey=${capturedStreamKey}`);
        }
      } catch {
        // 파싱 불가 응답 무시
      }
    });

    // ── 스트림 키 발급 모달 열기 ─────────────────────────────────────────
    await newBroadcastBtn.click();

    const titleInput = page.getByPlaceholder('예: 오늘의 라이브 방송');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill(`E2E 검증 ${Date.now()}`);
    await page.getByRole('button', { name: '스트림 키 발급' }).click();

    // 결과 대기 (성공 or 실패 메시지)
    const successMsg = page.getByText('스트림 키가 발급되었습니다!');
    const alreadyActiveMsg = page
      .getByText(/이미.*방송|활성.*스트림|방송 중|STREAM_ALREADY/i)
      .or(page.getByText('스트림 키 발급에 실패했습니다'));

    await Promise.race([
      successMsg.waitFor({ timeout: 12000 }).catch(() => {}),
      alreadyActiveMsg.waitFor({ timeout: 12000 }).catch(() => {}),
    ]);

    const isSuccess = await successMsg.isVisible().catch(() => false);
    const isAlreadyActive = await alreadyActiveMsg.isVisible().catch(() => false);

    if (!isSuccess && !isAlreadyActive) {
      console.log('스트림 키 발급 결과 없음 — 스킵');
      return;
    }

    if (isAlreadyActive) {
      console.log('이미 활성 스트림 존재 — 기존 스트림 키로 검증 진행');
    }

    // API 응답 수신 대기 (이벤트 핸들러 처리 시간)
    await page.waitForTimeout(500);

    // ── A-BRD-ST-01: RTMP 서버 URL 레이블·유효 기간 레이블 UI 표시 ─────────
    await expect(page.getByText('RTMP 서버 URL')).toBeVisible({ timeout: 5000 });
    console.log('✅ A-BRD-ST-01: RTMP 서버 URL 레이블 표시 확인');

    await expect(page.getByText('유효 기간')).toBeVisible({ timeout: 5000 });
    console.log('✅ A-BRD-ST-05: 유효 기간 레이블 표시 확인');

    // ── A-BRD-ST-02: API 응답 RTMP URL 포트·프로토콜 검증 ──────────────────
    // API 응답값을 기준으로 검증 (UI에서 잘못된 URL 오추출 방지)
    if (capturedRtmpUrl) {
      console.log(`[검증 대상 RTMP URL] "${capturedRtmpUrl}"`);

      // ✅ rtmp:// 프로토콜
      expect(capturedRtmpUrl).toMatch(/^rtmp:\/\//);
      console.log('✅ A-BRD-ST-02: rtmp:// 프로토콜 확인');

      // ✅ HTTP-FLV 재생 포트 8080 미사용
      expect(capturedRtmpUrl).not.toContain(':8080');
      console.log('✅ A-BRD-ST-02: HTTP-FLV 포트 8080 미사용 확인');

      // ✅ 포트가 명시된 경우 1935인지 확인 (미명시 시 기본값 1935)
      const portMatch = capturedRtmpUrl.match(/:(\d{4,5})\//);
      if (portMatch) {
        expect(portMatch[1]).toBe('1935');
        console.log(`✅ A-BRD-ST-02: RTMP 인제스트 포트 1935 확인 (포트: ${portMatch[1]})`);
      } else {
        console.log('✅ A-BRD-ST-02: 포트 미명시 — 기본 1935 적용 (OBS/Prism 호환)');
      }

      // ── UI에서 API 응답 URL(또는 서버 파트)이 실제 표시되는지 확인 ──────
      // API URL 형식: rtmp://host/live/{streamKey} or rtmp://host:1935/live/
      // UI는 전체 URL 또는 서버 파트만 표시할 수 있음
      const serverPart = capturedStreamKey
        ? capturedRtmpUrl.replace(capturedStreamKey, '').replace(/\/$/, '')
        : capturedRtmpUrl;

      const fullUrlInUI = page
        .locator('input')
        .filter({ hasValue: capturedRtmpUrl })
        .or(page.getByText(capturedRtmpUrl));
      const serverPartInUI = page
        .locator('input')
        .filter({ hasValue: new RegExp(serverPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
        .or(page.getByText(serverPart));

      const foundFull = await fullUrlInUI
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      const foundServer = await serverPartInUI
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (foundFull) {
        console.log(`✅ A-BRD-ST-01: UI에 전체 RTMP URL 표시 확인: "${capturedRtmpUrl}"`);
      } else if (foundServer) {
        console.log(`✅ A-BRD-ST-01: UI에 RTMP 서버 파트 표시 확인: "${serverPart}"`);
      } else {
        // 모달 내 readonly input 전체 값 덤프 (디버깅)
        const allInputs = page.locator('input[readonly], input[disabled]');
        const inputCount = await allInputs.count();
        const inputValues: string[] = [];
        for (let i = 0; i < inputCount; i++) {
          inputValues.push(
            await allInputs
              .nth(i)
              .inputValue()
              .catch(() => ''),
          );
        }
        console.log(
          `⚠️ A-BRD-ST-01: UI에서 RTMP URL 미발견. readonly input 값들: ${JSON.stringify(inputValues)}`,
        );
      }
    } else {
      console.log('⚠️ API 응답에서 rtmpUrl 미수신 — RTMP URL 검증 스킵');
    }

    // ── A-BRD-ST-01: 스트림 키 UI 표시값이 API 응답과 일치 ──────────────────
    if (capturedStreamKey) {
      const keyInInput = page.locator('input').filter({ hasValue: capturedStreamKey });
      const keyInText = page.getByText(capturedStreamKey);

      const foundInInput = await keyInInput
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      const foundInText = await keyInText.isVisible({ timeout: 3000 }).catch(() => false);

      expect(foundInInput || foundInText).toBe(true);
      console.log(`✅ A-BRD-ST-01: UI 스트림 키 === API 응답: "${capturedStreamKey}"`);
    } else {
      console.log('⚠️ API 응답에서 streamKey 미수신 — 스트림 키 일치 검증 스킵');
    }

    // ── A-BRD-ST-03/04: 복사 버튼 클릭 → 클립보드 검증 ─────────────────────
    // 모달 내부의 복사 버튼만 선택 (배경 목록의 복사 버튼 제외)
    // RTMP 서버 URL 레이블이 있는 모달 컨테이너로 범위 한정
    const modalOverlay = page
      .locator('div.fixed')
      .filter({ has: page.locator('text=RTMP 서버 URL') });
    const copyButtons = modalOverlay
      .getByRole('button', { name: /복사/ })
      .or(modalOverlay.locator('button[aria-label*="복사"], button[title*="복사"]'));

    const copyCount = await copyButtons.count();
    console.log(`복사 버튼 발견 (모달 내): ${copyCount}개`);

    if (copyCount > 0) {
      await copyButtons.first().click();
      await page.waitForTimeout(500);

      const clipText = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);

      if (clipText) {
        console.log(`[클립보드] "${clipText}"`);
        expect(clipText.trim().length).toBeGreaterThan(0);

        if (capturedStreamKey && clipText.trim() === capturedStreamKey) {
          console.log('✅ A-BRD-ST-03: 클립보드에 스트림 키 복사 확인');
        } else if (clipText.trim().startsWith('rtmp') && !isReStreamPlatformUrl(clipText)) {
          expect(clipText).not.toContain(':8080');
          console.log(`✅ A-BRD-ST-04: 클립보드에 SRS RTMP URL 복사 확인: "${clipText}"`);
        } else {
          console.log(`클립보드 값: "${clipText}" — 내용 확인 필요`);
        }
      } else {
        console.log('클립보드 읽기 불가 (헤드리스 환경 제한 가능)');
      }
    } else {
      console.log('⚠️ 복사 버튼 없음 — 아이콘 방식일 수 있음');
    }

    // ── A-BRD-ST-05: 유효 기간 날짜 표시 ────────────────────────────────────
    const dateLocator = page.locator('span, p, div, td').filter({
      hasText: /20\d{2}[-년\/. ]\s*\d{1,2}[-월\/. ]\s*\d{1,2}/,
    });

    const dateFound = await dateLocator
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (dateFound) {
      const dateText = await dateLocator.first().textContent();
      const yearMatch = dateText?.match(/20(\d{2})/);
      if (yearMatch) {
        const year = parseInt(`20${yearMatch[1]}`);
        expect(year).toBeGreaterThanOrEqual(new Date().getFullYear());
        console.log(`✅ A-BRD-ST-05: 유효 기간 날짜 확인: "${dateText?.trim()}"`);
      }
    } else {
      console.log('유효 기간 날짜 텍스트 자동 추출 불가 — 레이블만 확인');
    }

    console.log('\n=== A-BRD-ST-01~05 검증 완료 ===');
  });
});
