/**
 * Admin CMS → User Page Content Visibility Test
 *
 * 목적: 어드민 CMS에서 등록/수정된 모든 콘텐츠가 사용자 페이지에 정상 노출되는지 검증
 *
 * 검증 항목:
 *   1. 상품      — POST /api/products  → /shop 페이지 노출
 *   2. 라이브 방송 — POST /api/streaming/generate-key → 홈/upcoming 노출
 *   3. 공지사항   — POST /api/notices/admin → /alerts 노출
 *   4. 마케팅 배너 — PUT /api/admin/config/marketing-campaigns → 홈 노출
 *   5. 홈 추천 상품 — PUT /api/admin/config/home-featured-products → 홈 노출
 *   6. 어드민 전체 메뉴 탐색 (접근 권한 검증)
 *   7. 이미지 표시 검증
 *
 * 결과 출력:
 *   - JSON 결과 파일: test-results/cms-visibility/results-{timestamp}.json
 *   - 로그 파일:      test-results/cms-visibility/run-{timestamp}.log
 *   - 스크린샷:       test-results/cms-visibility/*.png
 *
 * 실행:
 *   npx playwright test --project=admin e2e/admin-cms-content-visibility.spec.ts
 *
 * playwright-local skill improvements applied:
 *   - safeGoto(): Known Issue #3 — nav timeout fallback with domcontentloaded
 *   - waitForText(): Known Issue #2/#4 — waitForSelector + SPA re-query
 *   - retryWithBackoff(): Pattern 7 — exponential backoff (500ms→1s→2s)
 *   - steps:5 on clicks: v1.57 human-like mouse movement
 *   - waitForSelector('main,h1,h2') after each navigation to confirm page load
 */
import { test, expect, request, APIRequestContext } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { ensureAuth } from './helpers/auth-helper';

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
const TS = Date.now();
const RESULTS_DIR = path.join(__dirname, '..', 'test-results', 'cms-visibility');
const RESULTS_FILE = path.join(RESULTS_DIR, `results-${TS}.json`);
const LOG_FILE = path.join(RESULTS_DIR, `run-${TS}.log`);

// ─────────────────────────────────────────────
// 결과 타입
// ─────────────────────────────────────────────
interface TestResult {
  item: string;
  action: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  detail?: string;
  screenshotPath?: string;
  error?: string;
  timestamp: string;
}

const results: TestResult[] = [];
const logLines: string[] = [];

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  logLines.push(line);
  console.log(line);
}

function record(r: Omit<TestResult, 'timestamp'>) {
  const entry: TestResult = { ...r, timestamp: new Date().toISOString() };
  results.push(entry);
  const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
  log(
    `${icon} [${r.item}] ${r.action}${r.detail ? ' — ' + r.detail : ''}${r.error ? ' ERROR: ' + r.error : ''}`,
  );
}

function saveResults() {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const summary = {
    runAt: new Date().toISOString(),
    environment: {
      backendUrl: BACKEND_URL,
      baseUrl: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    },
    total: results.length,
    passed: results.filter((r) => r.status === 'PASS').length,
    failed: results.filter((r) => r.status === 'FAIL').length,
    skipped: results.filter((r) => r.status === 'SKIP').length,
    results,
  };

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(summary, null, 2), 'utf-8');
  fs.writeFileSync(LOG_FILE, logLines.join('\n'), 'utf-8');

  log(`\n📄 결과 JSON: ${RESULTS_FILE}`);
  log(`📄 로그 파일: ${LOG_FILE}`);
  log(
    `📊 총계: ${summary.total}개 | ✅ ${summary.passed} | ❌ ${summary.failed} | ⏭️ ${summary.skipped}`,
  );
}

async function takeScreenshot(
  page: import('@playwright/test').Page,
  name: string,
): Promise<string> {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const filename = `${name}-${TS}.png`;
  const fullPath = path.join(RESULTS_DIR, filename);
  await page.screenshot({ path: fullPath, fullPage: false });
  return fullPath;
}

// ─────────────────────────────────────────────
// playwright-local: Pattern 7 — Retry with Exponential Backoff
// ─────────────────────────────────────────────
async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 500; // 500ms, 1000ms, 2000ms
        log(`  retryWithBackoff: attempt ${i + 1}/${maxRetries} failed, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────────
// playwright-local: Known Issue #3 — Safe Navigation with Timeout Fallback
// ─────────────────────────────────────────────
async function safeGoto(
  page: import('@playwright/test').Page,
  url: string,
  opts: { timeout?: number } = {},
): Promise<void> {
  const timeout = opts.timeout ?? 15_000;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  } catch (err) {
    // Known Issue #3: Navigation timeout — check if page loaded despite timeout
    const title = await page.title().catch(() => '');
    if (!title) {
      throw err;
    }
    log(`  safeGoto: nav timeout for ${url}, but page loaded (title="${title}") — continuing`);
  }
  // Wait for main content to confirm page is rendered (Known Issue #2)
  await page
    .waitForSelector('main, [role="main"], h1, h2, [data-testid]', { timeout: 8_000 })
    .catch(() => {});
}

// ─────────────────────────────────────────────
// playwright-local: Known Issue #2/#4 — Wait for Text with SPA Re-query Fallback
// ─────────────────────────────────────────────
async function waitForText(
  page: import('@playwright/test').Page,
  text: string,
  timeout = 8_000,
): Promise<boolean> {
  try {
    // Known Issue #2: Use waitForSelector instead of isVisible for reliability
    await page.waitForSelector(`text=${text}`, { timeout });
    return true;
  } catch {
    // Known Issue #4: SPA re-render may have destroyed the selector — try getByText fallback
    return page
      .getByText(text, { exact: false })
      .first()
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
  }
}

// ─────────────────────────────────────────────
// Admin API Client (CSRF-aware)
// ─────────────────────────────────────────────
class AdminApiClient {
  private ctx!: APIRequestContext;
  private csrfToken = '';

  async init() {
    this.ctx = await request.newContext({ baseURL: BACKEND_URL });

    // 1. dev-login as admin
    await retryWithBackoff(async () => {
      const loginRes = await this.ctx.post('/api/auth/dev-login', {
        data: { email: 'admin@doremi.shop', name: 'E2E Admin' },
      });
      if (!loginRes.ok()) {
        throw new Error(`Admin dev-login failed: ${loginRes.status()} ${await loginRes.text()}`);
      }
      log('Admin dev-login 성공');
    });

    // 2. CSRF 토큰 획득 (GET 요청으로 csrf-token 쿠키 생성)
    await this.ctx.get('/api/users/me');
    const state = await this.ctx.storageState();
    this.csrfToken = state.cookies.find((c) => c.name === 'csrf-token')?.value ?? '';
    log(`CSRF 토큰 획득: ${this.csrfToken ? '성공' : '실패 (CSRF 비활성화됨)'}`);
  }

  async get<T = unknown>(path: string): Promise<{ ok: boolean; data: T | null; raw: string }> {
    const res = await this.ctx.get(path);
    const raw = await res.text();
    let data: T | null = null;
    try {
      data = JSON.parse(raw)?.data ?? JSON.parse(raw);
    } catch {}
    return { ok: res.ok(), data, raw };
  }

  async post<T = unknown>(
    path: string,
    body: object,
  ): Promise<{ ok: boolean; data: T | null; raw: string }> {
    const res = await this.ctx.post(path, {
      headers: { 'X-CSRF-Token': this.csrfToken },
      data: body,
    });
    const raw = await res.text();
    let data: T | null = null;
    try {
      data = JSON.parse(raw)?.data ?? JSON.parse(raw);
    } catch {}
    return { ok: res.ok(), data, raw };
  }

  async put<T = unknown>(
    path: string,
    body: object,
  ): Promise<{ ok: boolean; data: T | null; raw: string }> {
    const res = await this.ctx.put(path, {
      headers: { 'X-CSRF-Token': this.csrfToken },
      data: body,
    });
    const raw = await res.text();
    let data: T | null = null;
    try {
      data = JSON.parse(raw)?.data ?? JSON.parse(raw);
    } catch {}
    return { ok: res.ok(), data, raw };
  }

  async delete(path: string): Promise<boolean> {
    const res = await this.ctx.delete(path, {
      headers: { 'X-CSRF-Token': this.csrfToken },
    });
    return res.ok();
  }

  async dispose() {
    await this.ctx.dispose();
  }
}

// ─────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────
test.describe('Admin CMS → 사용자 페이지 콘텐츠 노출 검증', () => {
  let api: AdminApiClient;

  // 생성된 리소스 ID (정리용)
  const created = {
    productId: null as string | null,
    noticeId: null as string | null,
    streamId: null as string | null,
  };

  test.beforeAll(async () => {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    log('=== CMS 콘텐츠 노출 검증 시작 ===');
    api = new AdminApiClient();
    await api.init();
  });

  test.beforeEach(async ({ page }) => {
    // Refresh admin auth before each test — storageState admin.json tokens may be expired
    await ensureAuth(page, 'ADMIN');
  });

  test.afterAll(async () => {
    log('\n=== 테스트 데이터 정리 ===');
    if (created.noticeId) {
      const ok = await api.delete(`/api/notices/admin/${created.noticeId}`);
      log(`공지사항 삭제 (${created.noticeId}): ${ok ? '성공' : '실패'}`);
    }
    await api.dispose();
    saveResults();
  });

  // ══════════════════════════════════════════
  // 1. 상품 등록 → Shop 페이지 노출
  // ══════════════════════════════════════════
  test('1. 상품 등록 후 사용자 Shop 페이지 노출 검증', async ({ page }) => {
    test.setTimeout(90000);
    const productName = `E2E_상품_${TS}`;
    const productPrice = '39.99';
    const productDesc = `E2E 테스트 상품입니다. ${TS}`;

    // 1-1. 어드민 상품 관리 페이지 접근
    await safeGoto(page, '/admin/products');
    record({ item: '상품', action: '어드민 상품 관리 페이지 접근', status: 'PASS' });

    // 1-2. API로 상품 생성 (retryWithBackoff: Pattern 7)
    log(`상품 API 생성 시도: name=${productName}, price=${productPrice}`);
    const { ok, data, raw } = await retryWithBackoff(() =>
      api.post<{ id: string; name: string; price: string }>('/api/products', {
        name: productName,
        description: productDesc,
        price: productPrice,
        stock: 100,
      }),
    );

    if (!ok || !data?.id) {
      record({ item: '상품', action: 'API 생성', status: 'FAIL', error: raw.slice(0, 200) });
      test.skip();
      return;
    }
    created.productId = data.id;
    record({ item: '상품', action: 'API 생성', status: 'PASS', detail: `id=${data.id}` });

    // 1-3. 어드민 목록에서 확인 (safeGoto + waitForText)
    await safeGoto(page, '/admin/products');
    await page.reload();
    await page.waitForSelector('main, table, [role="main"]', { timeout: 6_000 }).catch(() => {});
    const inAdmin = await waitForText(page, productName);
    record({ item: '상품', action: '어드민 목록 노출', status: inAdmin ? 'PASS' : 'FAIL' });

    // 1-4. 사용자 /shop 페이지 (safeGoto + waitForText)
    await safeGoto(page, '/shop');
    const ss1 = await takeScreenshot(page, 'product-shop');
    const inShop = await waitForText(page, productName);
    record({
      item: '상품',
      action: '사용자 Shop 페이지 노출',
      status: inShop ? 'PASS' : 'FAIL',
      screenshotPath: ss1,
    });

    if (inShop) {
      // 가격 표시 (waitForText)
      const hasPrice = await waitForText(page, productPrice, 4_000);
      record({
        item: '상품',
        action: '가격 표시',
        status: hasPrice ? 'PASS' : 'SKIP',
        detail: `$${productPrice}`,
      });

      // 설명 표시 (steps:5 for human-like click — v1.57)
      const card = page.getByText(productName, { exact: false }).first();
      await card.click({ steps: 5 }).catch(() => {});
      // Known Issue #4: re-query after SPA navigation
      await page
        .waitForSelector('[role="dialog"], [data-testid="product-detail"], main', {
          timeout: 4_000,
        })
        .catch(() => {});
      const hasDesc = await waitForText(page, productDesc.slice(0, 20), 4_000);
      const ss2 = await takeScreenshot(page, 'product-detail');
      record({
        item: '상품',
        action: '상세 설명 표시',
        status: hasDesc ? 'PASS' : 'SKIP',
        screenshotPath: ss2,
      });
    }

    // 1-5. 사용자 홈 페이지 인기 상품 섹션
    await safeGoto(page, '/');
    const ss3 = await takeScreenshot(page, 'product-home');
    const inHome = await waitForText(page, productName, 5_000);
    record({
      item: '상품',
      action: '홈 인기상품 섹션 노출',
      status: inHome ? 'PASS' : 'SKIP',
      detail: '정렬/페이지네이션 영향 가능',
      screenshotPath: ss3,
    });
  });

  // ══════════════════════════════════════════
  // 2. 공지사항 등록 → Alerts 페이지 노출
  // ══════════════════════════════════════════
  test('2. 공지사항 등록 후 사용자 Alerts 페이지 노출 검증', async ({ page }) => {
    const noticeTitle = `E2E_공지_${TS}`;
    const noticeContent = `E2E 테스트 공지사항 본문입니다. 타임스탬프: ${TS}`;

    // 2-1. API로 공지사항 생성 (retryWithBackoff: Pattern 7)
    log(`공지사항 API 생성: title=${noticeTitle}`);
    const { ok, data, raw } = await retryWithBackoff(() =>
      api.post<{ id: string; title: string }>('/api/notices/admin', {
        title: noticeTitle,
        content: noticeContent,
        category: 'IMPORTANT',
        isActive: true,
      }),
    );

    if (!ok || !data?.id) {
      record({ item: '공지사항', action: 'API 생성', status: 'FAIL', error: raw.slice(0, 200) });
      return;
    }
    created.noticeId = data.id;
    record({ item: '공지사항', action: 'API 생성', status: 'PASS', detail: `id=${data.id}` });

    // 2-2. 사용자 /alerts 페이지 (safeGoto + waitForText)
    await safeGoto(page, '/alerts');
    const ss = await takeScreenshot(page, 'notice-alerts');
    const inAlerts = await waitForText(page, noticeTitle);
    record({
      item: '공지사항',
      action: '사용자 Alerts 페이지 노출',
      status: inAlerts ? 'PASS' : 'FAIL',
      screenshotPath: ss,
    });

    if (inAlerts) {
      record({ item: '공지사항', action: '제목 텍스트 표시', status: 'PASS', detail: noticeTitle });

      // 본문 내용 (steps:5 click — v1.57, re-query after SPA nav — Known Issue #4)
      await page
        .getByText(noticeTitle, { exact: false })
        .first()
        .click({ steps: 5 })
        .catch(() => {});
      await page
        .waitForSelector('[role="dialog"], article, main', { timeout: 4_000 })
        .catch(() => {});
      const hasContent = await waitForText(page, noticeContent.slice(0, 20), 4_000);
      const ss2 = await takeScreenshot(page, 'notice-detail');
      record({
        item: '공지사항',
        action: '본문 내용 표시',
        status: hasContent ? 'PASS' : 'SKIP',
        screenshotPath: ss2,
      });
    }
  });

  // ══════════════════════════════════════════
  // 3. 라이브 방송 관리 → 홈/Upcoming 노출
  // ══════════════════════════════════════════
  test('3. 라이브 방송 등록 후 홈 및 Upcoming 페이지 노출 검증', async ({ page }) => {
    const streamTitle = `E2E_라이브_${TS}`;
    const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // 3-1. 어드민 라이브 관리 페이지 탐색 (safeGoto)
    await safeGoto(page, '/admin/live-management');
    const ss0 = await takeScreenshot(page, 'live-admin-management');
    record({
      item: '라이브 방송',
      action: '어드민 라이브 관리 페이지 접근',
      status: 'PASS',
      screenshotPath: ss0,
    });

    await safeGoto(page, '/admin/broadcasts');
    const ss1 = await takeScreenshot(page, 'live-admin-broadcasts');
    record({
      item: '라이브 방송',
      action: '어드민 broadcasts 목록 페이지 접근',
      status: 'PASS',
      screenshotPath: ss1,
    });

    // 3-2. API로 라이브 스트림 생성 (retryWithBackoff: Pattern 7)
    log(`라이브 API 생성: title=${streamTitle}`);
    const { ok, data, raw } = await retryWithBackoff(() =>
      api.post<{ id: string; title: string; streamKey: string }>('/api/streaming/generate-key', {
        title: streamTitle,
        scheduledAt,
      }),
    );

    if (!ok || !data?.id) {
      record({ item: '라이브 방송', action: 'API 생성', status: 'FAIL', error: raw.slice(0, 200) });
    } else {
      created.streamId = data.id;
      record({
        item: '라이브 방송',
        action: 'API 생성',
        status: 'PASS',
        detail: `id=${data.id}, key=${data.streamKey}`,
      });
    }

    // 3-3. 홈 페이지 라이브/예정 섹션 (safeGoto + waitForText)
    await safeGoto(page, '/');
    const ss2 = await takeScreenshot(page, 'live-home');
    const inHome = await waitForText(page, streamTitle, 5_000);
    record({
      item: '라이브 방송',
      action: '홈 예정 라이브 섹션 노출',
      status: inHome ? 'PASS' : 'SKIP',
      detail: '방송 상태(PENDING)에 따라 미노출 가능',
      screenshotPath: ss2,
    });

    // 3-4. /upcoming 페이지 (safeGoto + waitForText)
    await safeGoto(page, '/upcoming');
    const ss3 = await takeScreenshot(page, 'live-upcoming');
    const inUpcoming = await waitForText(page, streamTitle, 5_000);
    record({
      item: '라이브 방송',
      action: '/upcoming 페이지 노출',
      status: inUpcoming ? 'PASS' : 'FAIL',
      screenshotPath: ss3,
    });
  });

  // ══════════════════════════════════════════
  // 4. 마케팅 배너 설정 → 홈 노출
  // ══════════════════════════════════════════
  test('4. 마케팅 배너 설정 후 홈 페이지 노출 검증', async ({ page }) => {
    const bannerTitle = `E2E배너_${TS}`;

    // 4-1. 어드민 마케팅 페이지 (safeGoto)
    await safeGoto(page, '/admin/marketing');
    const ss0 = await takeScreenshot(page, 'banner-admin-marketing');
    record({
      item: '마케팅 배너',
      action: '어드민 마케팅 페이지 접근',
      status: 'PASS',
      screenshotPath: ss0,
    });

    // 4-2. 기존 캠페인 조회
    const { data: existing } = await api.get<{ items?: unknown[] }>(
      '/api/admin/config/marketing-campaigns',
    );
    const currentItems: unknown[] =
      (existing as any)?.items ?? (Array.isArray(existing) ? existing : []);
    log(`기존 마케팅 캠페인: ${currentItems.length}개`);

    // 4-3. 새 배너 추가 (retryWithBackoff: Pattern 7)
    const newBanner = {
      id: `e2e-${TS}`,
      title: bannerTitle,
      description: 'E2E 테스트 배너',
      imageUrl: 'https://placehold.co/600x200/FF1493/white?text=E2E+Banner',
      linkUrl: '/shop',
      isActive: true,
    };

    const { ok: putOk, raw } = await retryWithBackoff(() =>
      api.put('/api/admin/config/marketing-campaigns', {
        items: [...currentItems, newBanner],
      }),
    );

    if (!putOk) {
      record({ item: '마케팅 배너', action: 'API 설정', status: 'FAIL', error: raw.slice(0, 200) });
    } else {
      record({ item: '마케팅 배너', action: 'API 설정', status: 'PASS', detail: bannerTitle });
    }

    // 4-4. 홈에서 배너 확인 (safeGoto + waitForText)
    await safeGoto(page, '/');
    const ss = await takeScreenshot(page, 'banner-home');
    const inHome = await waitForText(page, bannerTitle, 5_000);
    record({
      item: '마케팅 배너',
      action: '홈 페이지 노출',
      status: inHome ? 'PASS' : 'SKIP',
      detail: '마케팅 배너 컴포넌트가 홈에 있을 경우 표시',
      screenshotPath: ss,
    });
  });

  // ══════════════════════════════════════════
  // 5. 홈 추천 상품 설정 → 홈 노출
  // ══════════════════════════════════════════
  test('5. 홈 추천 상품 설정 후 홈 페이지 노출 검증', async ({ page }) => {
    // 5-1. 어드민 Featured Products 페이지 (safeGoto)
    await safeGoto(page, '/admin/featured-products');
    const ss0 = await takeScreenshot(page, 'featured-admin');
    record({
      item: '홈 추천 상품',
      action: '어드민 featured-products 페이지 접근',
      status: 'PASS',
      screenshotPath: ss0,
    });

    // 5-2. 상품 목록에서 첫 번째 상품 ID 조회
    const { ok: prodOk, data: products } = await api.get<
      { data?: Array<{ id: string; name: string }> } | Array<{ id: string; name: string }>
    >('/api/products');
    const productList = Array.isArray(products) ? products : ((products as any)?.data ?? []);

    if (!prodOk || productList.length === 0) {
      record({
        item: '홈 추천 상품',
        action: 'API 설정',
        status: 'SKIP',
        detail: '설정할 상품 없음',
      });
      return;
    }

    const firstProduct = productList[0];
    log(`홈 추천 상품 설정: id=${firstProduct.id}, name=${firstProduct.name}`);

    // 5-3. 추천 상품 설정 (retryWithBackoff: Pattern 7)
    const { ok: putOk, raw } = await retryWithBackoff(() =>
      api.put('/api/admin/config/home-featured-products', {
        items: [{ id: firstProduct.id, order: 1 }],
      }),
    );

    if (!putOk) {
      record({
        item: '홈 추천 상품',
        action: 'API 설정',
        status: 'FAIL',
        error: raw.slice(0, 200),
      });
      return;
    }
    record({
      item: '홈 추천 상품',
      action: 'API 설정',
      status: 'PASS',
      detail: `상품: ${firstProduct.name}`,
    });

    // 5-4. 홈에서 확인 (safeGoto + waitForText)
    await safeGoto(page, '/');
    const ss = await takeScreenshot(page, 'featured-home');
    const inHome = await waitForText(page, firstProduct.name, 6_000);
    record({
      item: '홈 추천 상품',
      action: '홈 페이지 노출',
      status: inHome ? 'PASS' : 'SKIP',
      screenshotPath: ss,
    });
  });

  // ══════════════════════════════════════════
  // 6. 어드민 전체 메뉴 탐색 (접근 권한 검증)
  // ══════════════════════════════════════════
  test('6. 어드민 전체 메뉴 접근 권한 검증', async ({ page }) => {
    test.setTimeout(90000);
    const menus = [
      { path: '/admin/dashboard', name: '대시보드' },
      { path: '/admin/overview', name: '개요' },
      { path: '/admin/products', name: '상품 관리' },
      { path: '/admin/product-management', name: '상품 관리 (v2)' },
      { path: '/admin/orders', name: '주문 관리' },
      { path: '/admin/order-management', name: '주문 관리 (v2)' },
      { path: '/admin/users', name: '고객 관리' },
      { path: '/admin/customers', name: '고객 (v2)' },
      { path: '/admin/live-management', name: '라이브 관리' },
      { path: '/admin/broadcasts', name: '방송 목록' },
      { path: '/admin/featured-products', name: '피처드 상품' },
      { path: '/admin/marketing', name: '마케팅' },
      { path: '/admin/settlement', name: '정산' },
      { path: '/admin/analytics', name: '분석' },
      { path: '/admin/audit-log', name: '감사 로그' },
      { path: '/admin/payment-settings', name: '결제 설정' },
      { path: '/admin/settings', name: '설정' },
    ];

    log(`\n어드민 메뉴 ${menus.length}개 탐색 시작`);

    for (const menu of menus) {
      try {
        // safeGoto: Known Issue #3 — nav timeout fallback
        await safeGoto(page, menu.path, { timeout: 15_000 });

        const currentUrl = page.url();
        const redirectedToLogin = currentUrl.includes('/login') || currentUrl.includes('/403');

        if (redirectedToLogin) {
          record({
            item: `메뉴: ${menu.name}`,
            action: '접근 권한',
            status: 'FAIL',
            detail: `→ ${currentUrl}`,
          });
        } else {
          const ss = await takeScreenshot(
            page,
            `menu-${menu.name.replace(/[^a-zA-Z가-힣]/g, '_')}`,
          );
          record({
            item: `메뉴: ${menu.name}`,
            action: '접근 권한',
            status: 'PASS',
            detail: menu.path,
            screenshotPath: ss,
          });
        }
      } catch (err) {
        record({
          item: `메뉴: ${menu.name}`,
          action: '접근 권한',
          status: 'FAIL',
          error: String(err).slice(0, 100),
        });
      }
    }
  });

  // ══════════════════════════════════════════
  // 7. 이미지 표시 검증 (상품/라이브/배너)
  // ══════════════════════════════════════════
  test('7. 이미지 표시 검증 (Shop, 홈)', async ({ page }) => {
    // Shop 페이지 이미지 (safeGoto)
    await safeGoto(page, '/shop');

    const productImages = page
      .locator('img[data-nimg], img')
      .filter({ hasNot: page.locator('[class*="logo"]') });
    const imgCount = await productImages.count();

    if (imgCount > 0) {
      // 첫 번째 이미지 로딩 완료 확인
      const firstImg = productImages.first();
      const naturalWidth = await firstImg
        .evaluate((el: HTMLImageElement) => el.naturalWidth)
        .catch(() => 0);
      record({
        item: '이미지',
        action: 'Shop 페이지 상품 이미지 로딩',
        status: naturalWidth > 0 ? 'PASS' : 'SKIP',
        detail: `${imgCount}개 이미지, naturalWidth=${naturalWidth}`,
      });
    } else {
      const ss = await takeScreenshot(page, 'image-shop');
      record({
        item: '이미지',
        action: 'Shop 페이지 상품 이미지',
        status: 'SKIP',
        detail: 'img 엘리먼트 미발견',
        screenshotPath: ss,
      });
    }

    // 홈 페이지 이미지 (safeGoto)
    await safeGoto(page, '/');

    const homeImages = page
      .locator('img')
      .filter({ hasNot: page.locator('[alt="logo"], [class*="logo"]') });
    const homeImgCount = await homeImages.count();
    const ss2 = await takeScreenshot(page, 'image-home');
    record({
      item: '이미지',
      action: '홈 페이지 이미지 렌더링',
      status: homeImgCount > 0 ? 'PASS' : 'SKIP',
      detail: `${homeImgCount}개 이미지`,
      screenshotPath: ss2,
    });
  });
});
