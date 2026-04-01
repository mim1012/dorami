/**
 * run-flow-test.js  v2
 * Playwright Node.js — 라이브 커머스 구매 플로우 E2E
 * Confirmed selectors from DOM inspection.
 * Usage: node run-flow-test.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname);
const FRONTEND = 'http://localhost:3004';

const steps = [];

async function shot(page, filename, desc, ok = true) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: false });
  steps.push({ filename, desc, ok });
  console.log(`  ${ok ? '✓' : '✗'} ${filename}`);
}

async function login(page) {
  await page.goto(`${FRONTEND}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.locator('input[type="email"]').fill('admin@doremi.shop');
  await page.locator('button:has-text("테스트 로그인")').click({ force: true });
  await page.waitForTimeout(4000);
  console.log('  logged in, URL:', page.url());
}

(async () => {
  const startTime = Date.now();
  const browser = await chromium.launch({ headless: true });

  // ─────────────────────────────────────────────────────────
  // MOBILE FLOW  390×844
  // ─────────────────────────────────────────────────────────
  console.log('\n[Mobile 390×844]');
  const mCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await mCtx.newPage();

  // Step 1: Login
  console.log('Step 1: Login');
  await login(page);

  // Step 2: Navigate to /live/preview
  console.log('Step 2: /live/preview');
  await page.goto(`${FRONTEND}/live/preview`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await shot(page, 'flow-01-live-page.png', '라이브 페이지 진입 (모바일 390×844)');

  // Step 3: Wait 15s for chat messages to accumulate
  console.log('Step 3: Waiting 15s for chat messages...');
  await page.waitForTimeout(15000);

  // Step 4: Scroll chat up — all .overflow-y-auto elements
  console.log('Step 4: Scroll chat up');
  await page.evaluate(() => {
    document.querySelectorAll('.overflow-y-auto').forEach(el => {
      el.scrollTop = 0;
      el.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
  });
  await page.waitForTimeout(1000);
  await shot(page, 'flow-02-chat-scrolled.png', '채팅 위로 스크롤 → 최신 채팅 버튼 표시');

  // Step 5: Click 최신 채팅 button (aria-label="최신 채팅으로 이동")
  console.log('Step 5: Click 최신 채팅 button');
  try {
    await page.locator('[aria-label="최신 채팅으로 이동"]').click({ force: true, timeout: 5000 });
    await page.waitForTimeout(1000);
    await shot(page, 'flow-03-chat-latest.png', '최신 채팅 버튼 클릭 후 (채팅 최하단)');
  } catch (_) {
    await shot(page, 'flow-03-chat-latest.png', '최신 채팅 버튼 (요소 미발견)', false);
  }

  // Step 6: Click 장바구니 FAB (aria-label="장바구니")
  console.log('Step 6: Click 장바구니 FAB');
  try {
    await page.locator('[aria-label="장바구니"]').click({ force: true, timeout: 5000 });
    await page.waitForTimeout(2000);
    await shot(page, 'flow-04-cart-empty.png', '장바구니 FAB 클릭 → 빈 장바구니 시트');
  } catch (_) {
    await shot(page, 'flow-04-cart-empty.png', '장바구니 FAB (요소 미발견)', false);
  }

  // Step 7: Close cart sheet — click backdrop (top-left corner)
  console.log('Step 7: Close cart sheet');
  await page.mouse.click(20, 20);
  await page.waitForTimeout(1000);

  // Step 8: Click 구매하기 (aria-label="구매하기")
  console.log('Step 8: Click 구매하기');
  try {
    await page.locator('[aria-label="구매하기"]').click({ force: true, timeout: 5000 });
    await page.waitForTimeout(2000);
    await shot(page, 'flow-05-product-detail.png', '구매하기 클릭 → 상품 상세 모달');
  } catch (_) {
    await shot(page, 'flow-05-product-detail.png', '구매하기 버튼 (요소 미발견)', false);
  }

  // Step 9: Click gallery next arrow (aria-label="다음 이미지")
  console.log('Step 9: Gallery next arrow');
  try {
    await page.locator('[aria-label="다음 이미지"]').click({ force: true, timeout: 5000 });
    await page.waitForTimeout(1000);
    await shot(page, 'flow-06-gallery-second.png', '갤러리 다음 이미지 화살표 클릭');
  } catch (_) {
    await shot(page, 'flow-06-gallery-second.png', '갤러리 다음 화살표 (요소 미발견)', false);
  }

  // Step 10: Click color option — confirmed: 블랙/베이지/네이비 buttons
  console.log('Step 10: Click color option');
  try {
    // Color buttons are text buttons: 블랙, 베이지, 네이비
    const colorBtn = page.locator('button:has-text("블랙"), button:has-text("베이지"), button:has-text("네이비")').first();
    await colorBtn.click({ force: true, timeout: 3000 });
    await page.waitForTimeout(500);
    await shot(page, 'flow-07-color-selected.png', '색상 옵션 선택 (블랙)');
  } catch (_) {
    await shot(page, 'flow-07-color-selected.png', '색상 옵션 선택 (없거나 이미 선택됨)');
  }

  // Step 11: Click size option — confirmed: S/M/L/XL buttons
  console.log('Step 11: Click size option');
  try {
    const sizeBtn = page.locator('button:has-text("M"), button:has-text("S"), button:has-text("L")').first();
    await sizeBtn.click({ force: true, timeout: 3000 });
    await page.waitForTimeout(500);
    await shot(page, 'flow-08-size-selected.png', '사이즈 옵션 선택 (M)');
  } catch (_) {
    await shot(page, 'flow-08-size-selected.png', '사이즈 옵션 선택 (없거나 이미 선택됨)');
  }

  // Step 12: Click 장바구니에 담기
  console.log('Step 12: Click 장바구니에 담기');
  try {
    await page.locator('button:has-text("장바구니에 담기")').click({ force: true, timeout: 5000 });
    await page.waitForTimeout(2000);
    await shot(page, 'flow-09-added-to-cart.png', '장바구니에 담기 클릭 후 (토스트/확인)');
  } catch (_) {
    await shot(page, 'flow-09-added-to-cart.png', '장바구니에 담기 버튼 (요소 미발견)', false);
  }

  // Step 13: Click 장바구니 FAB again
  console.log('Step 13: Reopen 장바구니 FAB');
  try {
    await page.locator('[aria-label="장바구니"]').click({ force: true, timeout: 5000 });
    await page.waitForTimeout(2000);
    await shot(page, 'flow-10-cart-with-item.png', '장바구니 재오픈 → 담긴 상품 확인');
  } catch (_) {
    await shot(page, 'flow-10-cart-with-item.png', '장바구니 FAB 재오픈 (요소 미발견)', false);
  }

  // Step 14: Close cart
  console.log('Step 14: Close cart');
  await page.mouse.click(20, 20);
  await page.waitForTimeout(1000);

  await mCtx.close();

  // ─────────────────────────────────────────────────────────
  // DESKTOP FLOW  1400×900
  // ─────────────────────────────────────────────────────────
  console.log('\n[Desktop 1400×900]');
  const dCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const dPage = await dCtx.newPage();

  await login(dPage);

  // Step 15: Desktop layout
  console.log('Step 15: Desktop /live/preview');
  await dPage.goto(`${FRONTEND}/live/preview`, { waitUntil: 'domcontentloaded' });
  await dPage.waitForTimeout(3000);
  await shot(dPage, 'flow-11-desktop-layout.png', '데스크톱 레이아웃 (사이드바 + 비디오 + 채팅)');

  // Step 16: Click product in aside sidebar
  // Confirmed selector: button[aria-label*="상세보기"] inside aside
  console.log('Step 16: Click sidebar product');
  try {
    await dPage.locator('aside button[aria-label*="상세보기"]').first().click({ force: true, timeout: 5000 });
    await dPage.waitForTimeout(2000);
    await shot(dPage, 'flow-12-desktop-product-modal.png', '데스크톱 사이드바 상품 클릭 → 상세 모달');
  } catch (_) {
    await shot(dPage, 'flow-12-desktop-product-modal.png', '데스크톱 사이드바 상품 (요소 미발견)', false);
  }

  // Step 17: Close modal (Escape), screenshot chat panel
  console.log('Step 17: Close modal, screenshot chat');
  await dPage.keyboard.press('Escape');
  await dPage.waitForTimeout(800);
  // Also try close button
  try {
    await dPage.locator('[aria-label="상세 모달 닫기"]').click({ force: true, timeout: 2000 });
  } catch (_) { /* ignore */ }
  await dPage.waitForTimeout(500);
  await shot(dPage, 'flow-13-desktop-chat.png', '데스크톱 채팅 패널 (메시지 목록)');

  await dCtx.close();
  await browser.close();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const successCount = steps.filter(s => s.ok).length;
  console.log(`\nDone in ${elapsed}s — ${steps.length} screenshots (${successCount} success, ${steps.length - successCount} failed)`);

  // ─────────────────────────────────────────────────────────
  // UPDATE report.html — append new section before </body>
  // ─────────────────────────────────────────────────────────
  const mobileSteps = steps.slice(0, 10);   // flow-01 to flow-10
  const desktopSteps = steps.slice(10);     // flow-11 to flow-13

  const now = new Date().toLocaleString('ko-KR');
  const nowIso = new Date().toISOString();

  function cardHtml(s, stepNum) {
    const imgOrError = s.ok
      ? `<div class="img-wrap"><img src="${s.filename}" alt="${s.desc}" loading="lazy" /></div>`
      : `<div class="img-wrap"><img src="${s.filename}" alt="${s.desc}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=no-img>스크린샷 없음</div>'" /></div>`;
    return `
            <div class="card ${s.ok ? '' : 'error'}">
              <div class="badge">Step ${stepNum}</div>
              ${imgOrError}
              <p class="label">${s.desc}</p>
            </div>`;
  }

  const newSection = `
      <!-- ═══ NEW RUN: ${nowIso} ═══ -->
      <section>
        <h2>라이브 커머스 구매 플로우 E2E 테스트 — Mobile (390×844)</h2>
        <div class="meta" style="margin-bottom:16px;margin-top:-8px">
          <span><strong>실행 시각:</strong> ${now}</span>
          <span><strong>소요 시간:</strong> ${elapsed}s</span>
          <span><strong>스크린샷:</strong> ${steps.length}장 (성공: ${successCount})</span>
          <span><strong>URL:</strong> ${FRONTEND}/live/preview</span>
        </div>
        <div class="grid">
          ${mobileSteps.map((s, i) => cardHtml(s, i + 1)).join('')}
        </div>
      </section>

      <section>
        <h2>라이브 커머스 구매 플로우 E2E 테스트 — Desktop (1400×900)</h2>
        <div class="grid">
          ${desktopSteps.map((s, i) => cardHtml(s, mobileSteps.length + i + 1)).join('')}
        </div>
      </section>`;

  const reportPath = path.join(SCREENSHOT_DIR, 'report.html');
  let html = fs.readFileSync(reportPath, 'utf8');

  // Insert new sections before the <footer> tag
  if (html.includes('<footer>')) {
    html = html.replace('<footer>', `${newSection}\n<footer>`);
  } else {
    html = html.replace('</body>', `${newSection}\n</body>`);
  }

  fs.writeFileSync(reportPath, html, 'utf8');
  console.log(`\nReport updated: ${reportPath}`);
  console.log('\nSteps summary:');
  steps.forEach((s, i) => console.log(`  ${s.ok ? '✓' : '✗'} [${i+1}] ${s.filename}`));
})();
