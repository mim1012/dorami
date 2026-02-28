import { test } from '@playwright/test';

test('Visual check: Mainpage redesign', async ({ page }) => {
  console.log('📱 메인페이지 리디자인 시각 확인 시작...');

  // 홈페이지 접속
  await page.goto('http://localhost:3000');
  console.log('✓ 페이지 로드 완료');

  // 페이지 완전히 로드될 때까지 대기
  await page.waitForLoadState('networkidle');
  console.log('✓ 네트워크 로드 완료');

  // 현재 URL 확인
  console.log('📍 현재 URL:', page.url());

  // 페이지 제목 확인
  const title = await page.title();
  console.log('📄 페이지 제목:', title);

  // 주요 요소들이 있는지 확인
  const sections = {
    'Live Hero': page.locator('h1, h2').first(),
    'Deals Section': page.locator('[class*="deal"], [class*="Deal"]').first(),
    'Popular Products': page.locator('[class*="popular"], [class*="Popular"]').first(),
    Upcoming: page.locator('[class*="upcoming"], [class*="Upcoming"]').first(),
  };

  for (const [name, element] of Object.entries(sections)) {
    const isVisible = await element.isVisible().catch(() => false);
    console.log(`  ${isVisible ? '✓' : '✗'} ${name}`);
  }

  // 스크린샷 저장
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const screenshotPath = `mainpage-visual-${timestamp}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 스크린샷 저장: ${screenshotPath}`);

  // 5초간 열어둔 후 계속
  console.log('⏳ 5초간 UI 확인...');
  await page.waitForTimeout(5000);

  console.log('✓ 시각 확인 완료');
});
