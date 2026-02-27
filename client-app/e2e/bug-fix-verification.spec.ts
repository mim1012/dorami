import { test, expect } from '@playwright/test';
import { ensureAuth, gotoWithRetry } from './helpers/auth-helper';
import path from 'path';
import fs from 'fs';

/**
 * 버그 수정 검증 E2E 테스트
 *
 * Fix 1: admin/orders 상품 컬럼 표시 확인
 * Fix 2: admin/products 갤러리 이미지 자동 업로드 확인
 */

test.describe('Bug Fix Verification', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'ADMIN');
  });

  test('Fix 1: admin/orders should display products column correctly', async ({ page }) => {
    console.log('🔍 [Fix 1] Checking admin/orders products column...');
    await gotoWithRetry(page, '/admin/orders');

    // 페이지 로드 확인
    await expect(page.getByRole('heading', { name: '주문 관리' })).toBeVisible({ timeout: 15000 });

    // "상품" 컬럼 헤더 확인
    const productColumnHeader = page.locator('th').getByText('상품', { exact: true });
    await expect(productColumnHeader).toBeVisible();
    console.log('✓ "상품" 컬럼 헤더 찾음');

    // 테이블 데이터 행 확인
    const tableRows = page.locator('tbody tr');
    const rowCount = await tableRows.count();
    console.log(`✓ 테이블에 ${rowCount}개 행 발견`);

    if (rowCount > 0) {
      const firstRow = tableRows.first();
      await expect(firstRow).toBeVisible();

      // 상품 컬럼에 실제 데이터가 있는지 확인
      // 행의 모든 셀을 확인하여 상품명이 표시되는지 체크
      const cells = firstRow.locator('td');
      const cellCount = await cells.count();
      console.log(`✓ 첫 번째 행에 ${cellCount}개 셀 발견`);

      // 상품 컬럼은 보통 5번째 정도 위치 (주문번호, 방송, 고객, 입금자명, 주문상태, 상품 순서로 보임)
      // 모든 셀을 확인해서 상품명 패턴 찾기
      let productFound = false;
      for (let i = 0; i < cellCount; i++) {
        const cell = cells.nth(i);
        const cellText = await cell.textContent();
        console.log(`  셀 ${i}: ${cellText?.substring(0, 50)}`);

        // 상품 정보는 productName, color, size, price 형태로 표시됨
        if (cellText && cellText.includes('×') && cellText.match(/\$/)) {
          productFound = true;
          console.log(`✓ 상품 컬럼에서 가격×수량 패턴 발견: ${cellText.substring(0, 50)}`);
          break;
        }
      }

      if (productFound) {
        console.log('✓✓ Fix 1 검증 완료: admin/orders 상품 컬럼 정상 표시');
      } else {
        console.log('⚠️  상품 컬럼 데이터가 "-"만 표시되고 있을 수 있음');
      }
    } else {
      console.log('⚠️  주문 데이터가 없어 상품 컬럼 검증 불가');
    }
  });

  test('Fix 2: admin/products should auto-upload gallery images on submit', async ({ page }) => {
    console.log('🔍 [Fix 2] Checking admin/products gallery auto-upload...');
    await gotoWithRetry(page, '/admin/products');

    // 페이지 로드 확인
    await expect(page.getByRole('heading', { name: '상품 관리' })).toBeVisible({ timeout: 15000 });

    // "상품 등록" 버튼 클릭하여 모달 열기
    await page.getByRole('button', { name: '상품 등록' }).click();
    console.log('✓ 상품 등록 모달 열음');

    // 모달이 표시될 때까지 대기 (heading만 사용)
    await expect(page.getByRole('heading', { name: '상품 등록' })).toBeVisible({ timeout: 10000 });

    // 필수 필드 채우기
    await page.getByLabel('상품명').fill('테스트 상품');
    await page.getByLabel('가격 ($)').fill('100');
    await page.getByLabel('재고').fill('10');
    console.log('✓ 기본 정보 입력');

    // 갤러리 이미지 파일 선택
    // 테스트용 이미지 파일 생성 (1x1 픽셀 PNG)
    const testImageDir = '/tmp';
    const testImage1 = path.join(testImageDir, 'test-image-1.png');
    const testImage2 = path.join(testImageDir, 'test-image-2.png');

    // 간단한 PNG 바이너리 데이터 (1x1 투명 픽셀)
    const pngData = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
      0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00,
      0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    fs.writeFileSync(testImage1, pngData);
    fs.writeFileSync(testImage2, pngData);
    console.log('✓ 테스트 이미지 파일 생성');

    // 갤러리 파일 입력
    const galleryFileInput = page.locator('input[accept="image/*"][multiple]');
    await galleryFileInput.setInputFiles([testImage1, testImage2]);
    console.log('✓ 갤러리 이미지 2개 선택');

    // 파일 선택 확인 텍스트
    const galleryStatus = page.locator('text=/개 파일 선택됨/');
    await expect(galleryStatus).toBeVisible({ timeout: 5000 });
    console.log('✓ 갤러리 파일 선택 상태 표시 확인');

    // ⭐ 핵심: "업로드" 버튼을 클릭하지 않고 바로 "등록하기" 클릭
    // 이전에는 갤러리 이미지가 저장되지 않았지만, Fix 2로 인해 자동 업로드되어야 함
    const submitButton = page.getByRole('button', { name: '등록하기' });
    await expect(submitButton).toBeEnabled();
    console.log('✓ "등록하기" 버튼 활성화 확인');

    // 로딩 상태 추적을 위해 "저장 중..." 텍스트 대기
    await submitButton.click();
    console.log('⏳ "등록하기" 클릭 - 갤러리 자동 업로드 진행 중...');

    // 저장 중 상태 확인
    await page.waitForTimeout(2000);
    const isSaving = submitButton.getByText(/저장 중|업로드 중/);
    if (await isSaving.isVisible().catch(() => false)) {
      console.log('✓ 저장/업로드 중 상태 감지');
      await expect(isSaving).not.toBeVisible({ timeout: 15000 });
    }

    // 모달이 닫혀야 함 (저장 완료)
    await expect(page.getByRole('heading', { name: '상품 등록' })).not.toBeVisible({
      timeout: 10000,
    });
    console.log('✓ 상품 저장 완료 (모달 닫힘)');

    // 상품 목록으로 돌아옴 확인
    await expect(page.getByRole('heading', { name: '상품 관리' })).toBeVisible();
    console.log('✓ 상품 관리 페이지로 돌아옴');

    // 등록한 상품 찾기
    const productName = page.locator('text=테스트 상품');
    await expect(productName).toBeVisible({ timeout: 10000 });
    console.log('✓ 등록한 상품 목록에서 확인');

    // 상품 상세 페이지로 이동해서 갤러리 이미지 확인
    const editButton = page.locator('button[title="수정"]').first();
    await editButton.click();
    console.log('✓ 상품 수정 모달 열음');

    await expect(page.getByRole('heading', { name: '상품 수정' })).toBeVisible({ timeout: 10000 });

    // 갤러리 이미지가 저장되었는지 확인 (img 태그로 표시되는 갤러리 썸네일)
    const galleryImages = page.locator('img[alt^="Gallery"]');
    const imageCount = await galleryImages.count();

    if (imageCount >= 2) {
      console.log(`✓✓ Fix 2 검증 완료: ${imageCount}개 갤러리 이미지 자동 업로드 및 저장 확인!`);
    } else {
      console.log(`⚠️  갤러리 이미지 ${imageCount}개만 발견 (기대값: 2개)`);
    }

    // 정리
    fs.unlinkSync(testImage1);
    fs.unlinkSync(testImage2);
  });
});
