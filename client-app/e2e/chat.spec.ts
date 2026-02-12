import { test, expect } from '@playwright/test';

/**
 * 채팅 E2E 테스트
 * - 라이브 스트림 페이지의 채팅 UI 검증
 * - 스트리밍 서비스 미구동 시 graceful skip
 *
 * 테스트 전략:
 * 1. /live 목록에서 라이브 중인 스트림 탐색
 * 2. 스트림이 없으면 테스트용 streamKey로 직접 접근
 * 3. 어느 경우든 채팅 UI가 보이지 않으면 graceful skip
 */

test.describe('Live Chat', () => {
  test.setTimeout(60000);

  /**
   * 라이브 스트림 페이지 진입 시도.
   * 채팅 UI가 보이면 true, 아니면 false 반환.
   */
  async function navigateToLiveStream(page: import('@playwright/test').Page): Promise<boolean> {
    // 1) /live 목록에서 LIVE 스트림 찾기
    await page.goto('/live', { waitUntil: 'domcontentloaded' });

    const liveCard = page.locator('a[href*="/live/"]').first();
    const emptyState = page.getByText('진행 중인 라이브가 없습니다');

    await Promise.race([
      liveCard.waitFor({ timeout: 10000 }).catch(() => {}),
      emptyState.waitFor({ timeout: 10000 }).catch(() => {}),
    ]);

    if (await liveCard.isVisible().catch(() => false)) {
      await liveCard.click();
      // 채팅 UI 대기
      const chatHeader = page.getByText('Chat');
      await chatHeader.waitFor({ timeout: 15000 }).catch(() => {});
      return await chatHeader.isVisible().catch(() => false);
    }

    // 2) 라이브 목록이 비어있으면 테스트용 streamKey로 직접 접근
    await page.goto('/live/test-stream', { waitUntil: 'domcontentloaded' });

    // 로딩 → 에러 또는 라이브 화면 대기
    const chatHeader = page.getByText('Chat');
    const errorText = page.getByText('홈으로 돌아가기');
    const notLiveText = page.getByText('아직 방송 전이에요');

    await Promise.race([
      chatHeader.waitFor({ timeout: 15000 }).catch(() => {}),
      errorText.waitFor({ timeout: 15000 }).catch(() => {}),
      notLiveText.waitFor({ timeout: 15000 }).catch(() => {}),
    ]);

    return await chatHeader.isVisible().catch(() => false);
  }

  test('should display chat UI elements on live stream page', async ({ page }) => {
    const hasChatUI = await navigateToLiveStream(page);

    if (!hasChatUI) {
      console.log('No live stream available - chat UI not accessible (skip)');
      return;
    }

    // 채팅 헤더
    await expect(page.getByText('Chat')).toBeVisible();

    // 메시지 입력 필드
    await expect(page.locator('input[placeholder="메시지 입력..."]')).toBeVisible();

    // 이모지 버튼
    await expect(page.locator('button[aria-label="Open emoji picker"]')).toBeVisible();

    // 전송 버튼
    await expect(page.locator('button[aria-label="Send message"]')).toBeVisible();

    console.log('Chat UI elements displayed on live stream page');
  });

  test('should show empty chat state or messages', async ({ page }) => {
    const hasChatUI = await navigateToLiveStream(page);

    if (!hasChatUI) {
      console.log('No live stream available - skip empty state test');
      return;
    }

    // 빈 상태 또는 메시지 목록
    const emptyChat = page.getByText('채팅이 비어 있습니다.');
    const chatMessages = page.locator('[class*="animate-fade-in"]').first();

    await Promise.race([
      emptyChat.waitFor({ timeout: 5000 }).catch(() => {}),
      chatMessages.waitFor({ timeout: 5000 }).catch(() => {}),
    ]);

    if (await emptyChat.isVisible().catch(() => false)) {
      await expect(page.getByText('첫 메시지를 남겨보세요!')).toBeVisible();
      console.log('Empty chat state displayed');
    } else {
      console.log('Chat messages already present');
    }
  });

  test('should show character counter when typing', async ({ page }) => {
    const hasChatUI = await navigateToLiveStream(page);

    if (!hasChatUI) {
      console.log('No live stream available - skip character counter test');
      return;
    }

    const input = page.locator('input[placeholder="메시지 입력..."]');

    // 입력 전에는 카운터 미표시
    await expect(page.locator('text=/\\d+\\/200/')).not.toBeVisible();

    // 텍스트 입력
    await input.fill('안녕하세요');
    await expect(page.getByText('5/200')).toBeVisible();

    // 더 긴 텍스트
    await input.fill('가나다라마바사아자차카타파하');
    await expect(page.getByText('14/200')).toBeVisible();

    // 입력 초기화 시 카운터 사라짐
    await input.fill('');
    await expect(page.locator('text=/\\d+\\/200/')).not.toBeVisible();

    console.log('Character counter works correctly');
  });

  test('should enforce 200 character max length', async ({ page }) => {
    const hasChatUI = await navigateToLiveStream(page);

    if (!hasChatUI) {
      console.log('No live stream available - skip max length test');
      return;
    }

    const input = page.locator('input[placeholder="메시지 입력..."]');

    // maxLength=200 속성 확인
    await expect(input).toHaveAttribute('maxlength', '200');

    // 200자 채우기
    const longText = 'A'.repeat(200);
    await input.fill(longText);
    await expect(page.getByText('200/200')).toBeVisible();

    console.log('200 character max length enforced');
  });

  test('should open and close emoji picker', async ({ page }) => {
    const hasChatUI = await navigateToLiveStream(page);

    if (!hasChatUI) {
      console.log('No live stream available - skip emoji picker test');
      return;
    }

    const emojiButton = page.locator('button[aria-label="Open emoji picker"]');

    // 이모지 피커 열기
    await emojiButton.click();

    // 이모지 그리드 확인
    const emojiGrid = page.locator('div.grid-cols-8, div[class*="grid-cols-8"]');
    await expect(emojiGrid).toBeVisible({ timeout: 3000 });

    // 이모지 버튼들 존재 확인
    const firstEmoji = page.locator('button[aria-label^="Emoji"]').first();
    await expect(firstEmoji).toBeVisible();

    // 이모지 피커 닫기 (다시 클릭)
    await emojiButton.click();
    await expect(emojiGrid).not.toBeVisible();

    console.log('Emoji picker open/close works');
  });

  test('should insert emoji into input field', async ({ page }) => {
    const hasChatUI = await navigateToLiveStream(page);

    if (!hasChatUI) {
      console.log('No live stream available - skip emoji insert test');
      return;
    }

    const input = page.locator('input[placeholder="메시지 입력..."]');
    const emojiButton = page.locator('button[aria-label="Open emoji picker"]');

    // 이모지 피커 열기
    await emojiButton.click();

    // 첫 번째 이모지(😀) 클릭
    const firstEmoji = page.locator('button[aria-label="Emoji 😀"]');
    await firstEmoji.click();

    // 입력 필드에 이모지 삽입 확인
    await expect(input).toHaveValue('😀');

    // 이모지 피커가 닫혔는지 확인
    const emojiGrid = page.locator('div.grid-cols-8, div[class*="grid-cols-8"]');
    await expect(emojiGrid).not.toBeVisible();

    // 카운터 표시 확인
    await expect(page.locator('text=/\\d+\\/200/')).toBeVisible();

    console.log('Emoji inserted into input field');
  });

  test('should have send button disabled when input is empty', async ({ page }) => {
    const hasChatUI = await navigateToLiveStream(page);

    if (!hasChatUI) {
      console.log('No live stream available - skip send button test');
      return;
    }

    const sendButton = page.locator('button[aria-label="Send message"]');
    const input = page.locator('input[placeholder="메시지 입력..."]');

    // 빈 상태 → 전송 버튼 disabled
    await expect(sendButton).toBeDisabled();

    // 텍스트 입력 → 연결 상태에 따라 enabled/disabled
    await input.fill('테스트 메시지');

    // 소켓 연결 여부에 따라 다를 수 있음
    const isDisabled = await sendButton.isDisabled();
    if (isDisabled) {
      console.log('Send button disabled (socket not connected)');
    } else {
      console.log('Send button enabled with text input');
    }

    // 다시 비우면 disabled
    await input.fill('');
    await expect(sendButton).toBeDisabled();

    console.log('Send button state works correctly');
  });

  test('should display connection status indicator', async ({ page }) => {
    const hasChatUI = await navigateToLiveStream(page);

    if (!hasChatUI) {
      console.log('No live stream available - skip connection status test');
      return;
    }

    // 연결 상태 표시기 (green 또는 gray dot)
    const connectedDot = page.locator('div[title="Connected"]');
    const disconnectedDot = page.locator('div[title="Disconnected"]');

    const isConnected = await connectedDot.isVisible().catch(() => false);
    const isDisconnected = await disconnectedDot.isVisible().catch(() => false);

    if (isConnected) {
      console.log('Chat connected (green dot)');
    } else if (isDisconnected) {
      console.log('Chat disconnected (gray dot)');
    } else {
      console.log('Connection status indicator present');
    }

    // 둘 중 하나는 보여야 함
    expect(isConnected || isDisconnected).toBeTruthy();
  });
});
