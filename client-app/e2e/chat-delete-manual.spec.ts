import { test, expect } from '@playwright/test';

const STREAM_KEY = '42c4b2b31a39d66ad9eaac1a7d34f9b2';
const LIVE_URL = `http://localhost:3000/live/${STREAM_KEY}`;

test.describe('채팅 메시지 삭제 수동 테스트', () => {
  test.setTimeout(120000); // 2분 타임아웃

  test('관리자와 사용자 브라우저 동시 실행', async ({ browser }) => {
    // 관리자 컨텍스트
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    // 사용자 컨텍스트
    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();

    console.log('📋 Step 1: 관리자 로그인');
    await adminPage.goto('http://localhost:3000/login');
    await adminPage.waitForLoadState('networkidle');
    
    // 관리자 localStorage 설정
    await adminPage.evaluate(() => {
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          user: {
            id: 'admin-test-123',
            email: 'admin-test@test.com',
            nickname: 'TestAdmin',
            role: 'ADMIN',
            kakaoId: 'admin-kakao-123',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            depositorName: null,
            instagramId: null
          },
          isAuthenticated: true,
          isLoading: false
        },
        version: 0
      }));
    });

    console.log('📺 Step 2: 관리자 라이브 페이지 이동');
    await adminPage.goto(LIVE_URL);
    await adminPage.waitForLoadState('networkidle');
    await adminPage.waitForTimeout(3000);

    console.log('👤 Step 3: 사용자 라이브 페이지 이동');
    await userPage.goto(LIVE_URL);
    await userPage.waitForLoadState('networkidle');
    await userPage.waitForTimeout(3000);

    // 스크린샷 저장
    await adminPage.screenshot({ path: '/tmp/admin-before.png', fullPage: true });
    await userPage.screenshot({ path: '/tmp/user-before.png', fullPage: true });
    console.log('📸 초기 스크린샷 저장: /tmp/admin-before.png, /tmp/user-before.png');

    console.log('\n✅ 브라우저 준비 완료!');
    console.log('👉 수동으로 테스트 진행:');
    console.log('   1. 사용자 브라우저에서 채팅 메시지 전송');
    console.log('   2. 관리자 브라우저에서 🗑️ 버튼 클릭');
    console.log('   3. 양쪽 브라우저에서 "관리자에 의해 삭제된 메시지입니다" 확인');
    console.log('\n⏳ 60초 대기 중... (테스트 진행하세요)');

    // 60초 대기
    await adminPage.waitForTimeout(60000);

    // 최종 스크린샷
    await adminPage.screenshot({ path: '/tmp/admin-after.png', fullPage: true });
    await userPage.screenshot({ path: '/tmp/user-after.png', fullPage: true });
    console.log('📸 최종 스크린샷 저장: /tmp/admin-after.png, /tmp/user-after.png');

    await adminContext.close();
    await userContext.close();
  });
});
