import { test, expect } from '@playwright/test';

const STREAM_KEY = '42c4b2b31a39d66ad9eaac1a7d34f9b2';
const LIVE_URL = `http://localhost:3004/live/${STREAM_KEY}`;

test('채팅 WebSocket 연결 디버그', async ({ page }) => {
  test.setTimeout(60000);

  // 콘솔 로그 캡처
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);
    console.log(`[Browser Console ${msg.type()}] ${text}`);
  });

  // 네트워크 요청 모니터링
  page.on('requestfailed', request => {
    console.log(`❌ Request failed: ${request.url()}`);
  });

  // WebSocket 연결 모니터링
  page.on('websocket', ws => {
    console.log(`🔌 WebSocket: ${ws.url()}`);
    ws.on('close', () => console.log('❌ WebSocket closed'));
    ws.on('framereceived', event => console.log('⬇️  WS Receive:', event.payload));
    ws.on('framesent', event => console.log('⬆️  WS Send:', event.payload));
  });

  console.log('\n📋 Step 1: 로그인');
  await page.goto('http://localhost:3004/login');
  await page.waitForLoadState('networkidle');

  const loginResponse = await page.evaluate(async () => {
    const res = await fetch('http://localhost:3002/api/v1/auth/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'debug-user@test.com', role: 'USER' }),
    });
    const data = await res.json();
    if (data.data?.accessToken) {
      localStorage.setItem('accessToken', data.data.accessToken);
      console.log('✅ accessToken saved:', data.data.accessToken.substring(0, 20) + '...');
    }
    return data;
  });

  console.log('✅ 로그인 완료:', loginResponse.data?.user?.email);

  console.log('\n📺 Step 2: 라이브 페이지 접속');
  await page.goto(LIVE_URL);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000); // WebSocket 연결 대기

  console.log('\n🔍 Step 3: 채팅 UI 상태 확인');
  
  // 채팅 입력창 찾기
  const chatInput = await page.locator('input[placeholder*="메시지"], textarea[placeholder*="메시지"]').first();
  const isDisabled = await chatInput.isDisabled().catch(() => true);
  console.log('채팅 입력창 disabled:', isDisabled);

  // 연결 상태 확인
  const connectionStatus = await page.evaluate(() => {
    const statusElement = document.querySelector('[class*="Connected"], [class*="Disconnected"]');
    return statusElement?.textContent || 'Unknown';
  });
  console.log('연결 상태 표시:', connectionStatus);

  // localStorage 확인
  const storageCheck = await page.evaluate(() => {
    return {
      accessToken: localStorage.getItem('accessToken')?.substring(0, 20) + '...',
      authStorage: localStorage.getItem('auth-storage')?.substring(0, 50) + '...',
    };
  });
  console.log('localStorage 확인:', storageCheck);

  // WebSocket 객체 확인
  const wsCheck = await page.evaluate(() => {
    // @ts-ignore
    return window.socketDebugInfo || 'No socket info';
  });
  console.log('WebSocket 객체:', wsCheck);

  // 스크린샷 저장
  await page.screenshot({ path: '/tmp/chat-debug.png', fullPage: true });
  console.log('\n📸 스크린샷 저장: /tmp/chat-debug.png');

  // 콘솔 로그 출력
  console.log('\n📝 콘솔 로그:');
  consoleMessages.forEach(msg => console.log(msg));

  // 10초 대기 (수동 확인용)
  console.log('\n⏳ 10초 대기 중...');
  await page.waitForTimeout(10000);
});
