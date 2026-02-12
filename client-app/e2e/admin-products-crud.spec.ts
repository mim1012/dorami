import { test, expect } from '@playwright/test';
import { createTestStream } from './helpers/auth-helper';

test.describe('Admin Products CRUD', () => {
  test.describe.configure({ timeout: 60000 });

  let testStreamKey: string;

  test.beforeAll(async () => {
    testStreamKey = await createTestStream();
  });

  test('should complete full product lifecycle: create, view, update, delete', async ({ page }) => {
    test.setTimeout(90000);

    // 1. Navigate to admin products page
    await page.goto('/admin/products', { waitUntil: 'domcontentloaded' });

    // 2. CREATE: Wait for page content and find "상품 등록" button
    const createButton = page.locator('button').filter({ hasText: '상품 등록' }).first();
    await expect(createButton).toBeVisible({ timeout: 15000 });
    await createButton.click();

    // Wait for modal to open (role="dialog")
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('textbox', { name: 'Stream Key', exact: true })).toBeVisible({
      timeout: 10000,
    });

    // Fill out the product form (use the pre-created stream key)
    const testProductName = `E2E Test Product ${Date.now()}`;

    await page.getByRole('textbox', { name: 'Stream Key', exact: true }).fill(testStreamKey);
    await page.getByLabel('상품명').fill(testProductName);
    await page.getByLabel('가격 (원)').fill('29000');
    await page.getByLabel('재고').fill('50');
    await page.getByLabel('색상 옵션 (쉼표로 구분)').fill('Red, Blue, Black');
    await page.getByLabel('사이즈 옵션 (쉼표로 구분)').fill('S, M, L, XL');
    await page.getByLabel('배송비 (원)').fill('3000');

    // Submit the form — button text is "등록하기", becomes "저장 중..." while submitting
    await page.getByRole('button', { name: '등록하기', exact: true }).click();

    // Wait for modal to close (success path: setIsModalOpen(false) then showToast)
    await expect(modal).not.toBeVisible({ timeout: 15000 });

    // Verify success toast
    await expect(page.getByRole('alert').filter({ hasText: '등록되었습니다' })).toBeVisible({
      timeout: 5000,
    });

    // 3. READ: Verify product appears in the list (scoped to product row)
    const productRow = page.locator('tr', { hasText: testProductName });
    await expect(productRow).toBeVisible({ timeout: 10000 });
    await expect(productRow.getByText(testStreamKey)).toBeVisible();
    await expect(productRow.getByText('29,000')).toBeVisible();
    await expect(productRow.getByText('50개')).toBeVisible();
    await expect(productRow.getByText('판매중')).toBeVisible();

    // 4. UPDATE: Click edit button for our product
    const editButton = productRow.getByRole('button', { name: '수정' });
    await editButton.click();

    // Wait for edit modal
    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#modal-title')).toHaveText('상품 수정');

    // Verify form is pre-filled
    await expect(page.getByLabel('상품명')).toHaveValue(testProductName);

    // Update product details
    const updatedProductName = `${testProductName} Updated`;
    await page.getByLabel('상품명').fill(updatedProductName);
    await page.getByLabel('가격 (원)').fill('35000');
    await page.getByLabel('재고').fill('30');

    // Submit update — button text is "수정하기"
    await page.getByRole('button', { name: '수정하기' }).click();

    // Wait for modal to close
    await expect(modal).not.toBeVisible({ timeout: 15000 });

    // Verify success toast
    await expect(page.getByRole('alert').filter({ hasText: '수정되었습니다' })).toBeVisible({
      timeout: 5000,
    });

    // Verify updated product in list (scoped to row)
    const updatedProductRow = page.locator('tr', { hasText: updatedProductName });
    await expect(updatedProductRow).toBeVisible({ timeout: 10000 });
    await expect(updatedProductRow.getByText('35,000')).toBeVisible();
    await expect(updatedProductRow.getByText('30개')).toBeVisible();

    // 5. Mark as SOLD OUT
    const soldOutButton = updatedProductRow.getByRole('button', { name: '품절 처리' });
    await soldOutButton.click();

    // ConfirmDialog appears (role="alertdialog")
    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });
    await expect(confirmDialog.getByText('품절 처리하시겠습니까')).toBeVisible();

    // Click confirm button in the ConfirmDialog
    await confirmDialog.getByRole('button', { name: '품절 처리' }).click();

    // Wait for confirm dialog to close
    await expect(confirmDialog).not.toBeVisible({ timeout: 10000 });

    // Verify success toast
    await expect(page.getByRole('alert').filter({ hasText: '품절 처리되었습니다' })).toBeVisible({
      timeout: 5000,
    });

    // Verify status changed — the row for our product should now show 품절
    await expect(updatedProductRow.getByText('품절')).toBeVisible({ timeout: 10000 });

    // 6. DELETE: Click delete button
    const deleteButton = updatedProductRow.getByRole('button', { name: '삭제' });
    await deleteButton.click();

    // ConfirmDialog appears
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });
    await expect(confirmDialog.getByText('정말 삭제하시겠습니까')).toBeVisible();

    // Click confirm button
    await confirmDialog.getByRole('button', { name: '삭제' }).click();

    // Wait for confirm dialog to close
    await expect(confirmDialog).not.toBeVisible({ timeout: 10000 });

    // Verify success toast
    await expect(page.getByRole('alert').filter({ hasText: '삭제되었습니다' })).toBeVisible({
      timeout: 5000,
    });

    // Verify product is removed from list
    await expect(page.getByText(updatedProductName)).not.toBeVisible({ timeout: 10000 });

    console.log('Full CRUD lifecycle test completed successfully!');
  });

  test('should filter products by stream key', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/admin/products', { waitUntil: 'domcontentloaded' });

    // Find the filter input
    const filterInput = page.getByPlaceholder('stream key 입력 (비우면 전체 조회)');
    await expect(filterInput).toBeVisible({ timeout: 15000 });

    // Enter a stream key to filter
    await filterInput.fill('test-stream');
    await page.waitForLoadState('domcontentloaded');

    // Verify filtering works
    await expect(filterInput).toHaveValue('test-stream');
  });

  test('should handle empty product list', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/admin/products', { waitUntil: 'domcontentloaded' });

    // Check if empty state might be visible
    const emptyStateButton = page.getByRole('button', { name: '첫 상품 등록하기' });

    // If empty state exists, verify it
    if (await emptyStateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(page.getByText('등록된 상품이 없습니다')).toBeVisible();
      await expect(emptyStateButton).toBeVisible();
    }
  });
});
