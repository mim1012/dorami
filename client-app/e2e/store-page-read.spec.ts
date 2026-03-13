import { type Browser, expect, test } from '@playwright/test';

const TS = Date.now();
const ADMIN_STORAGE_STATE = './e2e/.auth/admin.json';

async function createAdminProduct(browser: Browser, productName: string) {
  const productPayload = {
    name: productName,
    price: 29000,
    stock: 10,
    description: 'E2E_스토어_노출_검증',
    colorOptions: [],
    sizeOptions: [],
  };

  const adminContext = await browser.newContext({ storageState: ADMIN_STORAGE_STATE });
  const adminPage = await adminContext.newPage();

  try {
    // Ensure CSRF/session cookies are initialized for admin context
    await adminPage.goto('/admin/products', { waitUntil: 'domcontentloaded', timeout: 60000 });

    const createRes = await adminPage.request.post('/api/products', { data: productPayload });
    if (!createRes.ok()) {
      const raw = await createRes.text().catch(() => '');
      throw new Error(`상품 생성 실패: ${createRes.status()} ${raw}`);
    }

    const body = await createRes.json();
    const createdId = body?.data?.id || body?.id;
    if (!createdId) {
      throw new Error('상품 ID를 응답에서 추출할 수 없습니다');
    }

    return createdId;
  } finally {
    // Keep page for caller context only when request is still needed
    await adminPage.close().catch(() => {});
    await adminContext.close().catch(() => {});
  }
}

async function deleteProduct(browser: Browser, productId: string | null) {
  if (!productId) return;

  const adminContext = await browser.newContext({ storageState: ADMIN_STORAGE_STATE });
  const adminPage = await adminContext.newPage();

  try {
    await adminPage
      .goto('/admin/products', { waitUntil: 'domcontentloaded', timeout: 60000 })
      .catch(() => {});
    await adminPage.request.delete(`/api/products/${productId}`).catch(() => {});
  } finally {
    await adminPage.close().catch(() => {});
    await adminContext.close().catch(() => {});
  }
}

test.describe('Store page visibility', () => {
  test('1. 스토어 페이지에서 상품 노출 및 검색 동작', async ({ page, browser }) => {
    test.setTimeout(120000);
    const productName = `StoreVisible_${TS}`;
    let productId: string | null = null;

    try {
      productId = await createAdminProduct(browser, productName);

      // 1) /store 직접 접근
      await page.goto('/store', { waitUntil: 'domcontentloaded', timeout: 12000 });

      await expect(page.getByText('지난 방송 상품 스토어')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(productName)).toBeVisible({ timeout: 10000 });

      // 2) 검색 동작
      await page.getByPlaceholder('상품명으로 검색').fill(productName);
      await page.getByRole('button', { name: '검색' }).click();
      await expect(page.getByText(productName)).toBeVisible({ timeout: 10000 });

      // 3) 미존재 검색어는 "검색 결과가 없습니다"로 처리되는지 확인
      await page.getByPlaceholder('상품명으로 검색').fill('not-exist-store-e2e-' + TS);
      await page.getByRole('button', { name: '검색' }).click();
      await expect(page.getByText('검색 결과가 없습니다')).toBeVisible({ timeout: 10000 });

      // 4) 모바일 주 사용자 동선: 스토어 탭 존재 여부 확인
      const storeTab = page.getByRole('button', { name: '스토어' });
      if (await storeTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await storeTab.click();
        await expect(page).toHaveURL(/\/store/);
      }
    } finally {
      await deleteProduct(browser, productId);
    }
  });
});
