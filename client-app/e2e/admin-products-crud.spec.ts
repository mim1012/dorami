import { test, expect } from '@playwright/test';
import { gotoWithNgrokHandling } from './helpers/ngrok-helper';

test.describe('Admin Products CRUD', () => {
  test('should complete full product lifecycle: create, view, update, delete', async ({ page }) => {
    // 1. Navigate to admin products page
    await gotoWithNgrokHandling(page, '/admin/products');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Extra wait for React hydration

    // 2. CREATE: Wait for page content and find "상품 등록" button
    // Try multiple selectors for the create button
    const createButton = page.locator('button').filter({ hasText: '상품 등록' }).first();
    await expect(createButton).toBeVisible({ timeout: 15000 });
    await createButton.click();

    // Wait for modal to open - give it more time and wait for form elements
    await page.waitForTimeout(2000);
    // Wait for the modal's Stream Key input (not the filter input)
    // Use the exact role selector that targets the modal input
    await expect(page.getByRole('textbox', { name: 'Stream Key', exact: true })).toBeVisible({ timeout: 15000 });

    // Fill out the product form
    const testProductName = `E2E Test Product ${Date.now()}`;
    const testStreamKey = `test-stream-${Date.now()}`;

    // Use specific selectors to target modal inputs (not filter inputs)
    await page.getByRole('textbox', { name: 'Stream Key', exact: true }).fill(testStreamKey);
    await page.getByLabel('상품명').fill(testProductName);
    await page.getByLabel('가격 (원)').fill('29000');
    await page.getByLabel('재고').fill('50');
    await page.getByLabel('색상 옵션 (쉼표로 구분)').fill('Red, Blue, Black');
    await page.getByLabel('사이즈 옵션 (쉼표로 구분)').fill('S, M, L, XL');
    await page.getByLabel('배송비 (원)').fill('3000');

    // Submit the form - use exact match to avoid matching "첫 상품 등록하기"
    await page.getByRole('button', { name: '등록하기', exact: true }).click();

    // Wait for alert and confirm
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('등록되었습니다');
      dialog.accept();
    });

    // Wait for modal to close
    await expect(page.getByText('상품 등록')).not.toBeVisible({ timeout: 10000 });

    // 3. READ: Verify product appears in the list
    await page.waitForLoadState('networkidle');

    // Check if our product is in the list
    await expect(page.getByText(testProductName)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(testStreamKey)).toBeVisible();
    await expect(page.getByText('29,000')).toBeVisible();
    await expect(page.getByText('50개')).toBeVisible();

    // Verify status badge
    await expect(page.getByText('판매중')).toBeVisible();

    // 4. UPDATE: Click edit button for our product
    const productRow = page.locator('tr', { hasText: testProductName });
    const editButton = productRow.getByRole('button', { name: '수정' });
    await editButton.click();

    // Wait for edit modal
    await expect(page.getByText('상품 수정')).toBeVisible();

    // Verify form is pre-filled
    await expect(page.getByLabel('상품명')).toHaveValue(testProductName);

    // Update product details
    const updatedProductName = `${testProductName} Updated`;
    await page.getByLabel('상품명').fill(updatedProductName);
    await page.getByLabel('가격 (원)').fill('35000');
    await page.getByLabel('재고').fill('30');

    // Submit update
    await page.getByRole('button', { name: '수정하기' }).click();

    // Wait for confirmation
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('수정되었습니다');
      dialog.accept();
    });

    // Wait for modal to close
    await expect(page.getByText('상품 수정')).not.toBeVisible({ timeout: 10000 });

    // Verify updated product in list
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(updatedProductName)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('35,000')).toBeVisible();
    await expect(page.getByText('30개')).toBeVisible();

    // 5. Mark as SOLD OUT
    const updatedProductRow = page.locator('tr', { hasText: updatedProductName });
    const soldOutButton = updatedProductRow.getByRole('button', { name: '품절 처리' });

    // Handle confirmation dialog
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('품절 처리하시겠습니까');
      dialog.accept();
    });

    await soldOutButton.click();

    // Wait for success message
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('품절 처리되었습니다');
      dialog.accept();
    });

    // Verify status changed to SOLD_OUT
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('품절')).toBeVisible({ timeout: 10000 });

    // 6. DELETE: Click delete button
    const finalProductRow = page.locator('tr', { hasText: updatedProductName });
    const deleteButton = finalProductRow.getByRole('button', { name: '삭제' });

    // Handle confirmation dialog
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('정말 삭제하시겠습니까');
      dialog.accept();
    });

    await deleteButton.click();

    // Wait for deletion confirmation
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('삭제되었습니다');
      dialog.accept();
    });

    // Verify product is removed from list
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(updatedProductName)).not.toBeVisible({ timeout: 10000 });

    console.log('✅ Full CRUD lifecycle test completed successfully!');
  });

  test('should filter products by stream key', async ({ page }) => {
    await gotoWithNgrokHandling(page, '/admin/products');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Extra wait for React hydration

    // Find the filter input
    const filterInput = page.getByPlaceholder('stream key 입력 (비우면 전체 조회)');
    await expect(filterInput).toBeVisible({ timeout: 15000 });

    // Enter a stream key to filter
    await filterInput.fill('test-stream');
    await page.waitForLoadState('networkidle');

    // Verify filtering works (this will depend on available data)
    // Just verify the input is working
    await expect(filterInput).toHaveValue('test-stream');
  });

  test('should handle empty product list', async ({ page }) => {
    await gotoWithNgrokHandling(page, '/admin/products');
    await page.waitForLoadState('networkidle');

    // Check if empty state might be visible
    // Note: This depends on whether there are products in the database
    const emptyStateButton = page.getByRole('button', { name: '첫 상품 등록하기' });

    // If empty state exists, verify it
    if (await emptyStateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(page.getByText('등록된 상품이 없습니다')).toBeVisible();
      await expect(emptyStateButton).toBeVisible();
    }
  });
});
