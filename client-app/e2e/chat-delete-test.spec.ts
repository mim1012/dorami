import { test, expect, chromium } from '@playwright/test';

const STREAM_KEY = '42c4b2b31a39d66ad9eaac1a7d34f9b2';
const LIVE_URL = `http://localhost:3000/live/${STREAM_KEY}`;

test.describe('채팅 메시지 삭제 기능 테스트', () => {
  test('관리자가 메시지를 삭제하면 모든 사용자에게 즉시 반영됨', async () => {
    test.setTimeout(120000); // 2분 타임아웃
    // 1. 관리자 브라우저 설정
    const adminBrowser = await chromium.launch({ headless: false });
    const adminContext = await adminBrowser.newContext();
    const adminPage = await adminContext.newPage();

    // 2. 사용자 브라우저 설정
    const userBrowser = await chromium.launch({ headless: false });
    const userContext = await userBrowser.newContext();
    const userPage = await userContext.newPage();

    try {
      // 3. 관리자 로그인
      console.log('📋 관리자 로그인 중...');
      await adminPage.goto('http://localhost:3000/login');
      await adminPage.waitForTimeout(2000);
      
      // Dev login via API to get real JWT token
      const adminLoginResponse = await adminPage.evaluate(async () => {
        const res = await fetch('http://localhost:3001/api/v1/auth/dev-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: 'admin-test@test.com', role: 'ADMIN' }),
        });
        const data = await res.json();
        // Store accessToken in localStorage for WebSocket auth
        if (data.data?.accessToken) {
          localStorage.setItem('accessToken', data.data.accessToken);
        }
        return data;
      });
      console.log('✅ 관리자 로그인 완료:', adminLoginResponse.data?.user?.email);

      // 4. 사용자 로그인 (일반 USER)
      console.log('👤 사용자 로그인 중...');
      await userPage.goto('http://localhost:3000/login');
      await userPage.waitForTimeout(2000);
      
      const userLoginResponse = await userPage.evaluate(async () => {
        const res = await fetch('http://localhost:3001/api/v1/auth/dev-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: 'user-test@test.com', role: 'USER' }),
        });
        const data = await res.json();
        if (data.data?.accessToken) {
          localStorage.setItem('accessToken', data.data.accessToken);
        }
        return data;
      });
      console.log('✅ 사용자 로그인 완료:', userLoginResponse.data?.user?.email);

      // 5. 관리자 라이브 페이지 접속
      console.log('📺 관리자 라이브 페이지 접속...');
      await adminPage.goto(LIVE_URL);
      await adminPage.waitForTimeout(3000);

      // 6. 사용자 라이브 페이지 접속
      console.log('👤 사용자 라이브 페이지 접속...');
      await userPage.goto(LIVE_URL);
      await userPage.waitForTimeout(3000);

      // 7. 사용자가 채팅 메시지 전송
      console.log('💬 사용자 메시지 전송 중...');
      const chatInput = await userPage.locator('input[placeholder*="메시지"], textarea[placeholder*="메시지"]').first();
      await chatInput.fill('테스트 메시지 - 삭제될 예정');
      await chatInput.press('Enter');
      
      await userPage.waitForTimeout(2000);

      // 8. 관리자 화면에서 메시지 확인
      console.log('🔍 관리자 화면에서 메시지 확인...');
      const messageInAdmin = await adminPage.getByText('테스트 메시지 - 삭제될 예정').first();
      await expect(messageInAdmin).toBeVisible({ timeout: 10000 });
      console.log('✅ 관리자 화면에 메시지 표시됨');

      // 9. 사용자 화면에서도 메시지 확인
      const messageInUser = await userPage.getByText('테스트 메시지 - 삭제될 예정').first();
      await expect(messageInUser).toBeVisible({ timeout: 5000 });
      console.log('✅ 사용자 화면에 메시지 표시됨');

      // 10. 관리자 화면에서 삭제 버튼 찾기 및 클릭
      console.log('🗑️  관리자가 메시지 삭제 중...');
      const deleteButton = await adminPage.locator('button[title="메시지 삭제"]').first();
      await expect(deleteButton).toBeVisible({ timeout: 5000 });
      await deleteButton.click();
      
      await adminPage.waitForTimeout(2000);

      // 11. 관리자 화면에서 삭제 결과 확인
      console.log('🔍 삭제 결과 확인 중...');
      const deletedMessageAdmin = await adminPage.getByText('관리자에 의해 삭제된 메시지입니다').first();
      await expect(deletedMessageAdmin).toBeVisible({ timeout: 5000 });
      console.log('✅ 관리자 화면: 삭제된 메시지 표시됨');

      // 12. 사용자 화면에서도 삭제 결과 확인 (실시간 반영)
      const deletedMessageUser = await userPage.getByText('관리자에 의해 삭제된 메시지입니다').first();
      await expect(deletedMessageUser).toBeVisible({ timeout: 5000 });
      console.log('✅ 사용자 화면: 삭제된 메시지 실시간 반영됨');

      // 13. 사용자 화면에서 삭제 버튼이 없는지 확인
      const deleteButtonInUser = await userPage.locator('button[title="메시지 삭제"]').count();
      expect(deleteButtonInUser).toBe(0);
      console.log('✅ 사용자 화면에는 삭제 버튼 없음 (권한 체크 통과)');

      console.log('\n🎉 모든 테스트 통과!');
      
      // 스크린샷 저장
      await adminPage.screenshot({ path: '/tmp/admin-chat-deleted.png' });
      await userPage.screenshot({ path: '/tmp/user-chat-deleted.png' });
      console.log('📸 스크린샷 저장: /tmp/admin-chat-deleted.png, /tmp/user-chat-deleted.png');

      // 10초 대기 (결과 확인용)
      await adminPage.waitForTimeout(10000);

    } finally {
      await adminBrowser.close();
      await userBrowser.close();
    }
  });
});
