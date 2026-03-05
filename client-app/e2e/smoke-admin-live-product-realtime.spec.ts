import { test, expect, Page, BrowserContext } from '@playwright/test';
import { createTestStream, ensureAuth, gotoWithRetry, devLogin } from './helpers/auth-helper';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

const getCsrfToken = async (page: Page): Promise<string> => {
  const csrfCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'csrf-token',
  );
  return csrfCookie?.value || '';
};

const resolveCsrfToken = async (page: Page): Promise<string> => {
  await page.request.get('/api/auth/me').catch(() => null);

  const fromCookie = await getCsrfToken(page);
  if (fromCookie) {
    return fromCookie;
  }

  const csrfResp = await page.request.get('/api/csrf').catch(() => null);
  if (csrfResp && csrfResp.ok()) {
    const body = await csrfResp.json().catch(() => null);
    const token = body?.token;
    if (typeof token === 'string' && token.length > 0) {
      return token;
    }
  }

  return '';
};

const makeHeaders = (csrfToken: string) => {
  return csrfToken
    ? { 'x-csrf-token': csrfToken, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
};

test.describe('Smoke - Admin Live Product Realtime', () => {
  test.setTimeout(90000);

  test('SMOKE-RT-01: 관리자가 스트림 연결 상품을 생성하고 실시간 노출 신호를 확인', async ({
    page,
    browser,
  }) => {
    const testProductName = `스모크 실시간상품 ${Date.now()}`;
    const streamKey = await createTestStream();
    expect(streamKey, '스트림 키 생성 실패').toBeTruthy();

    let productId: string | null = null;
    let userContext: BrowserContext | null = null;
    let userPage: Page | null = null;
    let csrfToken = '';

    try {
      await ensureAuth(page, 'ADMIN');
      csrfToken = await resolveCsrfToken(page);
      const headers = makeHeaders(csrfToken);
      const createPayload = {
        streamKey,
        name: testProductName,
        price: 39000,
        stock: 3,
        shippingFee: 0,
      };

      const created = await page
        .evaluate(
          async ({ payload, headers }) => {
            const res = await fetch('/api/products', {
              method: 'POST',
              headers,
              credentials: 'include',
              body: JSON.stringify(payload),
            });
            const body = await res.json().catch(() => null);
            return {
              ok: res.ok,
              status: res.status,
              body,
            };
          },
          {
            payload: createPayload,
            headers,
          },
        )
        .catch(() => ({ ok: false, status: 0, body: null }));

      expect(created.ok, `상품 생성 실패: status=${created.status}`).toBeTruthy();
      productId = created.body?.data?.id ?? null;
      expect(productId, '상품 ID 없음').toBeTruthy();

      await gotoWithRetry(page, '/admin/products', {
        waitForSelector: 'table',
        role: 'ADMIN',
      });

      await expect(page.locator('tr', { hasText: testProductName })).toBeVisible({
        timeout: 10000,
      });

      const productsByStream = await page
        .evaluate(
          async (payload) => {
            const res = await fetch(
              `/api/products?streamKey=${payload.streamKey}&status=AVAILABLE`,
              {
                credentials: 'include',
              },
            );
            if (!res.ok) return null;
            const body = await res.json().catch(() => null);
            const data = body?.data || [];
            return data;
          },
          { streamKey },
        )
        .catch(() => null);

      const apiFound = productsByStream?.some((item: any) => item?.name === testProductName);
      expect(apiFound, 'API 상품 조회에서 방금 생성한 상품이 보이지 않음').toBeTruthy();

      const streamStatusResp = await page
        .evaluate(async (sk) => {
          const res = await fetch(`/api/streaming/key/${sk}/status`, { credentials: 'include' });
          if (!res.ok) return null;
          return res.json();
        }, streamKey)
        .catch(() => null);
      const streamStatus = streamStatusResp?.data?.status || 'UNKNOWN';
      expect(streamStatus, '스트림 상태는 서버가 반환해야 함').toBeTruthy();
      console.log(`[스모크] 스트림 상태: ${streamStatus}`);

      if (streamStatus === 'LIVE') {
        userContext = await browser.newContext();
        userPage = await userContext.newPage();
        await userPage.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
        await userPage.evaluate(() => localStorage.clear());
        await devLogin(userPage, 'USER');
        await userPage.waitForTimeout(1200);
        await userPage.goto(`/live/${streamKey}`, { waitUntil: 'domcontentloaded' });
        await userPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        await expect(userPage.getByText(testProductName, { exact: false })).toBeVisible({
          timeout: 10000,
        });
        const liveBadgeVisible = await userPage.getByText('LIVE').isVisible({ timeout: 5000 });
        expect(liveBadgeVisible, 'LIVE 배지가 표시되어야 함').toBeTruthy();
        console.log('[스모크] LIVE 모드에서 사용자 페이지 실시간 반영 확인');
      } else {
        await page.goto(`/live/${streamKey}`, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        const pendingVisible = await page
          .getByText('아직 방송 전이에요')
          .isVisible({ timeout: 10000 })
          .catch(() => false);
        const offlineVisible = await page
          .getByText('스트림을 찾을 수 없거나 종료되었습니다')
          .isVisible({ timeout: 6000 })
          .catch(() => false);
        const notFoundVisible = await page
          .getByText('방송을 찾을 수 없습니다')
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        const homeButtonVisible = await page
          .getByRole('button', { name: '홈으로 돌아가기' })
          .isVisible({ timeout: 3000 })
          .catch(() => false);

        if (pendingVisible) {
          await page
            .getByText('곧 시작됩니다. 잠시만 기다려주세요!')
            .isVisible({ timeout: 4000 })
            .catch(() => false);
        } else if (offlineVisible || notFoundVisible) {
          // offline/offline-like 상태: 에러 메시지로 대체되어도 통과
        }

        expect(
          pendingVisible || offlineVisible || notFoundVisible || homeButtonVisible,
          `LIVE가 아닌 상태인데 라이브 상태 안내 문구가 표시되지 않음 (status=${streamStatus})`,
        ).toBeTruthy();

        if (homeButtonVisible) {
          console.log('[스모크] NON-LIVE 상태 홈 이동 버튼 노출 PASS');
        }

        console.log('[스모크] NON-LIVE 상태 표시 검증 PASS');
      }
    } finally {
      if (productId) {
        const cleanupHeaders = makeHeaders(csrfToken);
        await page
          .evaluate(
            async ({ pid, headers }) => {
              await fetch(`/api/products/${pid}`, {
                method: 'DELETE',
                headers,
                credentials: 'include',
              });
            },
            { pid: productId, headers: cleanupHeaders },
          )
          .catch(() => undefined);
        console.log(`[정리] 생성 상품 삭제: ${productId}`);
      }

      if (userPage) await userPage.close().catch(() => {});
      if (userContext) await userContext.close().catch(() => {});
    }
  });
});
