const { chromium } = require('playwright');

(async () => {
  console.log('🚀 메인페이지 시각 확인 시작...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  try {
    console.log('📍 http://localhost:3000 접속...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });

    console.log('✓ 페이지 로드 완료\n');

    // 현재 URL 확인
    console.log('📍 현재 URL:', page.url());

    // 페이지 제목
    const title = await page.title();
    console.log('📄 페이지 제목:', title, '\n');

    // 콘텐츠 확인
    const bodyText = await page.textContent('body');
    console.log('📝 페이지 콘텐츠 미리보기:');
    console.log(bodyText?.substring(0, 300) || '(내용 없음)');

    console.log('\n✅ 확인 완료. 브라우저 창을 닫으세요.');

    // 20초 더 대기 (브라우저 유지)
    await page.waitForTimeout(20000);

  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    await browser.close();
  }
})();
