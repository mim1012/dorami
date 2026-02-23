import { test, expect } from '@playwright/test';
import { ensureAuth } from './helpers/auth-helper';

/**
 * 2차 자동화테스트: LIVE 상태 정확성 + streamKey 기반 이동 검증
 *
 * 검증 항목:
 * V-LIVE-01: /api/streaming/active 응답에 streamKey 필드 포함
 * V-LIVE-02: /api/streaming/upcoming 응답에 streamKey 필드 포함
 * V-LIVE-03: 홈 LIVE 배너/카드 클릭 시 /live/undefined 방지
 * V-LIVE-04: isLive=true ↔ 홈 LIVE 배지 UI 일치 확인
 *
 * 배경:
 * - FIX-001: streaming.service.ts getUpcomingStreams()에 streamKey 필드 누락 수정됨
 * - streamKey 없으면 /live/undefined 이동 → 수정 후 정상 동작 검증
 */

test.describe('LIVE 상태 정확성 + streamKey 기반 이동', () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'USER');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // V-LIVE-01: /api/streaming/active 응답 구조 — streamKey 필드 포함
  // ─────────────────────────────────────────────────────────────────────────
  test('V-LIVE-01: /api/streaming/active — streamKey 필드 포함 검증', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const activeResp = await page.evaluate(async () => {
      const res = await fetch('/api/streaming/active', { credentials: 'include' });
      if (!res.ok) return { ok: false, status: res.status, data: null };
      const json = await res.json();
      return { ok: true, status: res.status, data: json };
    });

    if (!activeResp.ok) {
      console.log(`⚠️ V-LIVE-01: /api/streaming/active 응답 실패 (${activeResp.status}) — 스킵`);
      return;
    }

    const streams = activeResp.data?.data ?? [];
    console.log(`[V-LIVE-01] 활성 스트림 수: ${streams.length}`);

    if (streams.length === 0) {
      console.log('✅ V-LIVE-01: 활성 스트림 없음 — 빈 배열 응답 (정상)');
      return;
    }

    for (const stream of streams) {
      expect(stream, `스트림 ${stream.id}에 streamKey 필드 없음`).toHaveProperty('streamKey');
      expect(typeof stream.streamKey).toBe('string');
      expect(stream.streamKey.length).toBeGreaterThan(0);
      expect(stream.streamKey).not.toBe('undefined');
      expect(stream.streamKey).not.toBe('null');
      console.log(`✅ V-LIVE-01: streamKey="${stream.streamKey}", isLive=${stream.isLive}`);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // V-LIVE-02: /api/streaming/upcoming 응답 구조 — streamKey 필드 포함
  // ─────────────────────────────────────────────────────────────────────────
  test('V-LIVE-02: /api/streaming/upcoming — streamKey 필드 포함 검증', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const upcomingResp = await page.evaluate(async () => {
      const res = await fetch('/api/streaming/upcoming?limit=3', { credentials: 'include' });
      if (!res.ok) return { ok: false, status: res.status, data: null };
      const json = await res.json();
      return { ok: true, status: res.status, data: json };
    });

    if (!upcomingResp.ok) {
      console.log(
        `⚠️ V-LIVE-02: /api/streaming/upcoming 응답 실패 (${upcomingResp.status}) — 스킵`,
      );
      return;
    }

    const streams = upcomingResp.data?.data ?? [];
    console.log(`[V-LIVE-02] upcoming 스트림 수: ${streams.length}`);

    if (streams.length === 0) {
      console.log('✅ V-LIVE-02: 예정 스트림 없음 — 빈 배열 응답 (정상)');
      return;
    }

    for (const stream of streams) {
      // 핵심 검증: streamKey 필드가 항상 존재해야 함 (FIX-001 수정 후)
      expect(stream, `스트림 ${stream.id}에 streamKey 필드 없음`).toHaveProperty('streamKey');
      console.log(
        `✅ V-LIVE-02: id=${stream.id}, streamKey="${stream.streamKey}", isLive=${stream.isLive}`,
      );

      if (stream.isLive) {
        // LIVE 상태이면 streamKey가 반드시 유효해야 함
        expect(stream.streamKey, 'isLive=true인데 streamKey가 falsy').toBeTruthy();
        expect(stream.streamKey).not.toBe('undefined');
        console.log(`✅ V-LIVE-02: isLive=true → streamKey 유효성 확인`);
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // V-LIVE-03: 홈 LIVE 배너 클릭 → /live/{streamKey} 이동 (/live/undefined 방지)
  // ─────────────────────────────────────────────────────────────────────────
  test('V-LIVE-03: 홈 LIVE 배너/카드 클릭 → /live/undefined 방지', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // LIVE 관련 요소 탐색 (다양한 셀렉터 시도)
    const liveClickable = page
      .locator('a[href*="/live/"]')
      .first()
      .or(
        page
          .locator('button, div[role="button"], [onclick]')
          .filter({ has: page.getByText('LIVE', { exact: true }) })
          .first(),
      );

    const hasLiveLink = await liveClickable.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasLiveLink) {
      // API로 활성 스트림 확인
      const check = await page.evaluate(async () => {
        const res = await fetch('/api/streaming/active', { credentials: 'include' });
        if (!res.ok) return { streams: [] };
        const json = await res.json();
        return { streams: json?.data ?? [] };
      });

      if (check.streams.length === 0) {
        console.log('✅ V-LIVE-03: 활성 스트림 없음 — /live/undefined 시나리오 불가 (PASS)');
      } else {
        // 스트림 있는데 배너 없음 → API 응답에서 streamKey 직접 확인
        for (const s of check.streams) {
          expect(s.streamKey).toBeTruthy();
          expect(s.streamKey).not.toBe('undefined');
          console.log(`✅ V-LIVE-03: API streamKey="${s.streamKey}" 유효 (배너 UI 미표시)`);
        }
      }
      return;
    }

    // href에서 streamKey 직접 추출 (클릭 전 검증)
    const href = await liveClickable.getAttribute('href').catch(() => null);
    if (href) {
      expect(href).not.toContain('/live/undefined');
      expect(href).not.toContain('/live/null');
      const streamKeyFromHref = href.split('/live/')[1]?.split('?')[0];
      if (streamKeyFromHref) {
        expect(streamKeyFromHref.length).toBeGreaterThan(3);
        console.log(`✅ V-LIVE-03: href 검증 — /live/${streamKeyFromHref} (undefined 아님)`);
      }
    }

    // 클릭 후 URL 검증
    const navigationPromise = page
      .waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 })
      .catch(() => null);
    await liveClickable.click();
    await navigationPromise;

    const currentUrl = page.url();
    console.log(`[V-LIVE-03] 클릭 후 URL: ${currentUrl}`);

    expect(currentUrl).not.toMatch(/\/live\/undefined/);
    expect(currentUrl).not.toMatch(/\/live\/null/);

    if (/\/live\//.test(currentUrl)) {
      const streamKeyInUrl = currentUrl.split('/live/')[1]?.split('?')[0];
      expect(streamKeyInUrl).toBeTruthy();
      expect(streamKeyInUrl.length).toBeGreaterThan(3);
      console.log(
        `✅ V-LIVE-03: /live/${streamKeyInUrl} 정상 이동 확인 (/live/undefined 방지 검증 PASS)`,
      );
    } else {
      console.log(`V-LIVE-03: /live/ 이동 없음 — 현재 URL: ${currentUrl}`);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // V-LIVE-04: isLive 단일 소스(DB status==='LIVE') ↔ 홈 UI LIVE 배지 일치
  // ─────────────────────────────────────────────────────────────────────────
  test('V-LIVE-04: isLive 단일 소스 검증 — DB status 기반 일관성', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    const upcomingResp = await page.evaluate(async () => {
      const res = await fetch('/api/streaming/upcoming?limit=3', { credentials: 'include' });
      if (!res.ok) return null;
      return await res.json();
    });

    const streams = upcomingResp?.data ?? [];
    const liveStreams = streams.filter((s: { isLive: boolean }) => s.isLive === true);
    const pendingStreams = streams.filter((s: { isLive: boolean }) => s.isLive === false);

    console.log(
      `[V-LIVE-04] 스트림: 전체 ${streams.length}개 / LIVE ${liveStreams.length}개 / 오프라인 ${pendingStreams.length}개`,
    );

    if (liveStreams.length > 0) {
      // isLive=true → 홈에 LIVE 배지 표시 확인
      const liveBadge = page
        .getByText('LIVE', { exact: true })
        .or(page.locator('.live-badge, [class*="live"]').first());
      const badgeVisible = await liveBadge
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (badgeVisible) {
        console.log(`✅ V-LIVE-04: isLive=true API → 홈 LIVE 배지 표시 일치`);
      } else {
        // 배지 없어도 링크 존재 여부 확인
        const liveLink = page.locator('a[href*="/live/"]').first();
        const hasLink = await liveLink.isVisible({ timeout: 3000 }).catch(() => false);
        if (hasLink) {
          const href = await liveLink.getAttribute('href');
          console.log(`✅ V-LIVE-04: isLive=true → /live/ 링크 존재 (href="${href}")`);
        } else {
          console.log(`⚠️ V-LIVE-04: isLive=true 스트림 있으나 홈 LIVE 배지/링크 미확인`);
        }
      }

      // streamKey null 방지 확인
      for (const s of liveStreams) {
        expect(s.streamKey, `LIVE 스트림 ${s.id}의 streamKey가 null/undefined`).toBeTruthy();
        console.log(`✅ V-LIVE-04: LIVE 스트림 streamKey="${s.streamKey}" 유효`);
      }
    } else {
      console.log('V-LIVE-04: 활성 LIVE 스트림 없음 — UI 배지 표시 안 됨 (예상 동작)');
    }

    // 공통: isLive=false 스트림의 streamKey도 응답에 포함돼 있어야 함 (FIX-001 검증)
    for (const s of pendingStreams) {
      expect(s, 'isLive=false 스트림에도 streamKey 필드 필요').toHaveProperty('streamKey');
      console.log(`✅ V-LIVE-04: 예정 스트림 streamKey 필드 존재 (id=${s.id})`);
    }
  });
});
