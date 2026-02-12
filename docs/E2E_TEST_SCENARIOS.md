# Dorami 라이브커머스 — E2E 테스트 시나리오 참조 문서

> **최종 업데이트**: 2026-02-12
> **대상**: 실사용 검증 및 Playwright E2E 자동화 테스트 작성 시 참조용

---

## 목차

1. [테스트 환경 & 설정](#1-테스트-환경--설정)
2. [인증 & 프로젝트 구조](#2-인증--프로젝트-구조)
3. [공통 패턴 & 유틸리티](#3-공통-패턴--유틸리티)
4. [사용자 시나리오](#4-사용자user-시나리오)
5. [관리자 시나리오](#5-관리자admin-시나리오)
6. [크로스 시나리오 (E2E 핵심 흐름)](#6-크로스-시나리오)
7. [엣지 케이스 & 동시성](#7-엣지-케이스--동시성)
8. [기존 스펙 파일 매핑](#8-기존-스펙-파일-매핑)
9. [API 엔드포인트 참조](#9-api-엔드포인트-참조)
10. [코드 스니펫 참조](#10-코드-스니펫-참조)

---

## 1. 테스트 환경 & 설정

### 1.1 Playwright 구성 요약

| 항목            | 값                                                                   |
| --------------- | -------------------------------------------------------------------- |
| 테스트 디렉토리 | `client-app/e2e/`                                                    |
| 글로벌 셋업     | `client-app/e2e/global-setup.ts`                                     |
| Base URL        | `http://localhost:3000` (환경변수 `PLAYWRIGHT_BASE_URL`로 변경 가능) |
| 병렬 실행       | `fullyParallel: true`                                                |
| 워커 수         | 로컬 3개, CI 1개                                                     |
| 재시도          | 로컬 0회, CI 2회                                                     |
| 브라우저        | Desktop Chrome                                                       |
| Trace           | `on-first-retry`                                                     |
| 스크린샷        | `only-on-failure`                                                    |
| 비디오          | `retain-on-failure`                                                  |

### 1.2 실행 명령어

```bash
# 전체 테스트 (user + admin 프로젝트)
npx playwright test

# 프로젝트별
npx playwright test --project=user
npx playwright test --project=admin

# 특정 파일
npx playwright test e2e/user-cart-order.spec.ts

# 디버그 모드 (브라우저 표시 + 단계별 실행)
npx playwright test --debug

# UI 모드 (인터랙티브)
npx playwright test --ui

# 리포트 보기
npx playwright show-report
```

### 1.3 필수 서비스

테스트 전 아래 서비스가 모두 실행 중이어야 합니다:

| 서비스               | 포트      | 용도                             |
| -------------------- | --------- | -------------------------------- |
| Next.js (프론트엔드) | 3000      | 클라이언트 앱                    |
| NestJS (백엔드)      | 3001      | API 서버                         |
| PostgreSQL           | 5432      | 데이터베이스                     |
| Redis                | 6379      | 캐시 / WebSocket 어댑터          |
| nginx-rtmp           | 1935/8080 | 라이브 스트리밍 (방송 테스트 시) |

---

## 2. 인증 & 프로젝트 구조

### 2.1 Playwright 프로젝트

| 프로젝트 | storageState           | 테스트 범위                                |
| -------- | ---------------------- | ------------------------------------------ |
| `user`   | `e2e/.auth/user.json`  | `admin-*.spec.ts`를 **제외**한 모든 테스트 |
| `admin`  | `e2e/.auth/admin.json` | `admin-*.spec.ts`만 실행                   |

### 2.2 글로벌 셋업 인증 흐름

`global-setup.ts`가 모든 테스트 전에 한 번 실행됩니다:

```
1. .auth/ 디렉토리 생성
2. Chromium 브라우저 실행
3. USER 인증:
   - POST /api/v1/auth/dev-login { email, name, role: "USER" }
   - POST /api/v1/users/complete-profile { depositorName, instagramId, ... }
   - GET /api/v1/users/me → 프로필 조회
   - localStorage에 Zustand auth-storage 시드
   - storageState → e2e/.auth/user.json 저장
4. ADMIN 인증:
   - POST /api/v1/auth/dev-login { email, name, role: "ADMIN" }
   - localStorage에 Zustand auth-storage 시드
   - storageState → e2e/.auth/admin.json 저장
```

### 2.3 테스트 계정

| 역할  | 이메일               | 이름      | 비고                                              |
| ----- | -------------------- | --------- | ------------------------------------------------- |
| USER  | `e2e-user@test.com`  | E2E USER  | 프로필 완성 (입금자명, Instagram ID, 배송지 포함) |
| ADMIN | `e2e-admin@test.com` | E2E ADMIN | 관리자 권한                                       |

### 2.4 인증 상태 구조

**쿠키:**

- `accessToken` — JWT 액세스 토큰 (httpOnly)
- `refreshToken` — JWT 리프레시 토큰 (httpOnly)
- `csrf-token` — CSRF 방지 토큰 (httpOnly: false)

**localStorage (`auth-storage`):**

```json
{
  "state": {
    "user": {
      "id": "uuid",
      "email": "e2e-user@test.com",
      "nickname": "E2E USER",
      "role": "USER",
      "depositorName": "테스트사용자",
      "instagramId": "@e2e_test"
    },
    "isAuthenticated": true,
    "isLoading": false
  },
  "version": 0
}
```

---

## 3. 공통 패턴 & 유틸리티

### 3.1 헬퍼 파일

| 파일                          | 용도                               |
| ----------------------------- | ---------------------------------- |
| `e2e/helpers/auth-helper.ts`  | `createTestStream()`, `devLogin()` |
| `e2e/helpers/ngrok-helper.ts` | ngrok 경고 페이지 자동 처리        |

### 3.2 `createTestStream()`

관리자로 로그인하여 테스트용 라이브 스트림을 생성합니다. 상품 CRUD 테스트에서 `beforeAll()`에서 호출합니다.

```typescript
import { createTestStream } from './helpers/auth-helper';

let streamKey: string;

test.beforeAll(async () => {
  streamKey = await createTestStream();
});
```

### 3.3 CSRF 토큰 처리

POST/PUT/DELETE API 호출 시 반드시 CSRF 토큰을 포함해야 합니다:

```typescript
await page.evaluate(async (data) => {
  const csrf = document.cookie.match(/csrf-token=([^;]+)/)?.[1] || '';
  await fetch('/api/v1/some-endpoint', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf,
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
}, payload);
```

### 3.4 셀렉터 규칙

프로젝트에서 사용하는 셀렉터 우선순위:

```
1순위: getByRole('button', { name: '주문하기' })
2순위: getByLabel('상품명')
3순위: getByText('주문이 완료되었습니다')
4순위: getByTestId('product-card')
5순위: locator('css-selector')  ← 최후의 수단
```

### 3.5 주요 코드 패턴

#### 빈 상태 vs 콘텐츠 분기

```typescript
const emptyState = page.getByText('주문 내역이 없습니다');
const content = page.locator('table tbody tr').first();

await Promise.race([emptyState.waitFor({ timeout: 10000 }), content.waitFor({ timeout: 10000 })]);

if (await emptyState.isVisible()) {
  console.log('빈 상태 — 스킵');
  return;
}
// 콘텐츠 테스트 진행...
```

#### 모달 워크플로우

```typescript
await page.getByRole('button', { name: '새 상품' }).click();
const modal = page.getByRole('dialog');
await expect(modal).toBeVisible({ timeout: 5000 });

await modal.getByLabel('상품명').fill('테스트 상품');
await modal.getByRole('button', { name: '등록' }).click();

await expect(modal).not.toBeVisible({ timeout: 10000 });
```

#### 확인 다이얼로그

```typescript
await page.getByRole('button', { name: '삭제' }).click();
const dialog = page.getByRole('alertdialog');
await expect(dialog).toBeVisible({ timeout: 5000 });
await dialog.getByRole('button', { name: '확인' }).click();
await expect(dialog).not.toBeVisible({ timeout: 10000 });
```

#### API 응답 대기

```typescript
const [response] = await Promise.all([
  page.waitForResponse(
    (resp) => resp.url().includes('/api/v1/orders') && resp.request().method() === 'POST',
    { timeout: 15000 },
  ),
  page.getByRole('button', { name: '주문하기' }).click(),
]);
expect(response.ok()).toBeTruthy();
```

#### 순서 보장이 필요한 테스트 (serial)

```typescript
test.describe.configure({ mode: 'serial' });

test.describe('장바구니 → 주문 흐름', () => {
  test('상품 추가', async ({ page }) => {
    /* ... */
  });
  test('수량 변경', async ({ page }) => {
    /* ... */
  });
  test('주문 생성', async ({ page }) => {
    /* ... */
  });
});
```

---

## 4. 사용자(USER) 시나리오

### 4.1 회원가입 & 로그인

> 스펙 파일: `user-registration.spec.ts`

| ID        | 시나리오                                   | 검증 포인트                                    | 우선순위 |
| --------- | ------------------------------------------ | ---------------------------------------------- | -------- |
| U-AUTH-01 | 카카오 로그인 → 최초 진입                  | 프로필 완성 페이지 리다이렉트                  | P0       |
| U-AUTH-02 | 프로필 완성 (Instagram ID + 입금자명 입력) | profileCompletedAt 갱신, 홈으로 이동           | P0       |
| U-AUTH-03 | 프로필 미완성 상태에서 장바구니/주문 시도  | 프로필 완성 유도 메시지, 기능 차단             | P0       |
| U-AUTH-04 | 로그아웃                                   | 쿠키 삭제, /login 리다이렉트                   | P0       |
| U-AUTH-05 | 토큰 만료 → API 요청                       | 리프레시 토큰으로 자동 갱신 또는 재로그인 유도 | P1       |
| U-AUTH-06 | SUSPENDED 계정 로그인                      | 접근 차단 메시지 표시                          | P1       |
| U-AUTH-07 | dev-login 엔드포인트 (테스트 전용)         | 정상 토큰 발급                                 | P2       |

**테스트 작성 힌트:**

```typescript
// dev-login을 사용한 인증 (global-setup에서 자동 처리되므로 개별 테스트에서는 불필요)
// 프로필 미완성 상태를 테스트하려면 새 컨텍스트에서 dev-login만 호출하고
// complete-profile을 호출하지 않는 별도 storageState 필요
```

---

### 4.2 홈 & 스토어 탐색

> 스펙 파일: `home.spec.ts`, `shop-purchase-flow.spec.ts`

| ID        | 시나리오                    | 검증 포인트                                          | 우선순위 |
| --------- | --------------------------- | ---------------------------------------------------- | -------- |
| U-HOME-01 | 홈 페이지 로드              | 다가오는 방송(최대 3개) + 추천 상품(최대 6개) 렌더링 | P0       |
| U-HOME-02 | 라이브 방송 진행 중일 때 홈 | LIVE 인디케이터 표시, 클릭 시 방송 페이지 이동       | P1       |
| U-HOME-03 | 추천 상품 NEW 뱃지          | `isNew: true`인 상품에 NEW 표시                      | P2       |
| U-SHOP-01 | 스토어 페이지 로드          | 종료된 방송의 상품 그리드(24개/페이지)               | P0       |
| U-SHOP-02 | 페이지네이션                | 다음/이전 페이지 정상 전환, 상품 변경                | P1       |
| U-SHOP-03 | 상품 카드 클릭 → 상세 모달  | 이미지, 가격, 할인율, 색상/사이즈 옵션 표시          | P0       |
| U-SHOP-04 | 품절 상품 표시              | SOLD_OUT 뱃지, 장바구니 추가 버튼 비활성화           | P0       |
| U-SHOP-05 | 할인 상품 표시              | 원가(취소선) + 할인가 + 할인율 표시                  | P2       |
| U-SHOP-06 | 무료배송 상품               | "무료배송" 메시지 표시                               | P2       |

---

### 4.3 라이브 방송 시청

> 스펙 파일: `live-page.spec.ts`, `live-cart-pickup.spec.ts`

| ID        | 시나리오                       | 검증 포인트                                 | 우선순위 |
| --------- | ------------------------------ | ------------------------------------------- | -------- |
| U-LIVE-01 | 라이브 방송 페이지 진입        | HLS 영상 재생, LIVE 뱃지, 시청자 수         | P0       |
| U-LIVE-02 | 모바일 뷰                      | 세로(9:16) 레이아웃, 하단 채팅 오버레이     | P1       |
| U-LIVE-03 | 데스크톱 뷰                    | 가로 레이아웃, 사이드 채팅 + 상품 리스트    | P1       |
| U-LIVE-04 | 시청자 수 실시간 업데이트      | WebSocket으로 카운트 변동 + 펄스 애니메이션 | P1       |
| U-LIVE-05 | 추천 상품 바                   | 관리자 설정한 추천 상품 하단 노출           | P0       |
| U-LIVE-06 | 추천 상품 실시간 변경          | WebSocket 이벤트로 즉시 UI 반영             | P1       |
| U-LIVE-07 | 다른 시청자 장바구니 활동 피드 | "OOO님이 XXX를 담았습니다" 실시간 노출      | P1       |
| U-LIVE-08 | 방송 종료 감지                 | 방송 종료 안내 메시지 표시                  | P1       |
| U-LIVE-09 | 방송 없는 상태에서 접근        | "현재 방송 중이 아닙니다" 안내              | P0       |
| U-LIVE-10 | 뒤로가기 / 공유 버튼           | 홈 이동 / URL 공유 기능                     | P2       |

**테스트 작성 힌트:**

```typescript
// 라이브 방송 테스트는 실제 RTMP 스트림이 필요하므로
// nginx-rtmp가 구동된 환경에서만 전체 검증 가능
// 스트림 없이는 UI 렌더링 + 빈 상태 검증 위주로 작성
```

---

### 4.4 실시간 채팅

> 스펙 파일: `chat.spec.ts`

| ID        | 시나리오                  | 검증 포인트                                  | 우선순위 |
| --------- | ------------------------- | -------------------------------------------- | -------- |
| U-CHAT-01 | 채팅 메시지 전송          | 메시지가 채팅창에 실시간 표시                | P0       |
| U-CHAT-02 | 200자 초과 입력           | 글자 수 제한 경고, 전송 차단                 | P1       |
| U-CHAT-03 | 이모지 피커 사용          | 이모지 그리드 표시, 선택 시 입력 필드에 삽입 | P1       |
| U-CHAT-04 | 글자 수 카운터            | 입력 중 실시간 카운트 표시 (예: 45/200)      | P2       |
| U-CHAT-05 | 연결 상태 인디케이터      | 연결 시 녹색, 끊김 시 회색                   | P1       |
| U-CHAT-06 | 입장 시 히스토리 로드     | Redis 캐시에서 이전 메시지 표시              | P1       |
| U-CHAT-07 | 관리자에 의한 메시지 삭제 | 해당 메시지가 화면에서 사라짐                | P1       |
| U-CHAT-08 | 네트워크 재연결           | 자동 재연결 후 메시지 동기화                 | P2       |

**테스트 작성 힌트:**

```typescript
// 채팅 테스트는 WebSocket 연결이 필요
// Socket.IO 연결 대기: page.waitForEvent('websocket') 또는
// 연결 상태 인디케이터의 색상 변화로 판단
// 두 개의 브라우저 컨텍스트로 송수신 테스트 가능
```

---

### 4.5 장바구니 & 타이머

> 스펙 파일: `user-cart-order.spec.ts`, `live-cart-pickup.spec.ts`

| ID        | 시나리오                                | 검증 포인트                                            | 우선순위 |
| --------- | --------------------------------------- | ------------------------------------------------------ | -------- |
| U-CART-01 | 상품 모달에서 옵션 선택 → 장바구니 추가 | 장바구니에 추가, 토스트/확인 표시                      | P0       |
| U-CART-02 | 타이머 상품 추가 후 카운트다운          | 만료시간까지 실시간 카운트다운 표시                    | P0       |
| U-CART-03 | 타이머 만료                             | 장바구니에서 자동 제거, 재고 복구                      | P0       |
| U-CART-04 | 수량 변경 (증가/감소)                   | 수량 업데이트, 합계 재계산                             | P0       |
| U-CART-05 | 개별 상품 제거                          | 해당 항목 제거, 재고 복구                              | P0       |
| U-CART-06 | 장바구니 전체 비우기                    | 모든 항목 제거                                         | P1       |
| U-CART-07 | 장바구니 요약                           | 상품 수, 소계, 배송비 합계, 총 합계 정확히 계산        | P0       |
| U-CART-08 | 장바구니 추가 시 시청자 피드            | WebSocket 브로드캐스트 "OOO님이 담았습니다"            | P1       |
| U-CART-09 | 품절 상품 추가 시도                     | 추가 불가 메시지, 예약 안내                            | P0       |
| U-CART-10 | 빈 장바구니 상태                        | "장바구니가 비어있습니다" 안내, 체크아웃 버튼 비활성화 | P1       |

**테스트 작성 힌트:**

```typescript
// 장바구니 테스트는 serial 모드 권장 (상태 공유)
test.describe.configure({ mode: 'serial' });

// API를 통한 장바구니 추가 (UI보다 빠르고 안정적)
await page.evaluate(
  async ({ productId, quantity, color, size }) => {
    const csrf = document.cookie.match(/csrf-token=([^;]+)/)?.[1] || '';
    const res = await fetch('/api/v1/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      credentials: 'include',
      body: JSON.stringify({ productId, quantity, color, size }),
    });
    return res.json();
  },
  { productId, quantity: 1, color: '블랙', size: 'M' },
);
```

---

### 4.6 예약 대기열

> 스펙 파일: `reservation-system.spec.ts`

| ID       | 시나리오                      | 검증 포인트                            | 우선순위 |
| -------- | ----------------------------- | -------------------------------------- | -------- |
| U-RSV-01 | 품절 상품 예약 신청           | 예약번호 부여, WAITING 상태 표시       | P0       |
| U-RSV-02 | 대기열 순번 확인              | 현재 대기 위치 (예: 3번째)             | P1       |
| U-RSV-03 | 앞 사람 취소 → 자동 승격      | 다음 예약자 PROMOTED, 10분 타이머 시작 | P0       |
| U-RSV-04 | PROMOTED 알림 수신            | "구매 가능합니다" 알림 표시            | P1       |
| U-RSV-05 | 승격 후 10분 내 장바구니 추가 | 정상 장바구니 추가 성공                | P0       |
| U-RSV-06 | 승격 후 10분 초과             | 자동 만료(EXPIRED), 다음 예약자 승격   | P1       |
| U-RSV-07 | 예약 취소                     | CANCELLED 상태, 대기열 제거            | P1       |
| U-RSV-08 | 마이페이지 예약 목록          | 활성 예약 리스트 + 순번 표시           | P1       |
| U-RSV-09 | 동일 상품 중복 예약 시도      | 중복 예약 차단 메시지                  | P1       |

**테스트 작성 힌트:**

```typescript
// 예약 테스트에는 품절 상품이 필요
// 사전 조건: 재고 0인 상품 생성 (admin API 사용)
// 승격 테스트: 두 명의 사용자 컨텍스트 필요 (user1 예약 → user1 취소 → user2 승격)
```

---

### 4.7 주문 & 결제

> 스펙 파일: `user-cart-order.spec.ts`

| ID       | 시나리오                         | 검증 포인트                                         | 우선순위 |
| -------- | -------------------------------- | --------------------------------------------------- | -------- |
| U-ORD-01 | 체크아웃 페이지 진입             | 장바구니 요약, 배송지, 포인트 입력 표시             | P0       |
| U-ORD-02 | 배송지 미등록 상태에서 주문 시도 | 배송지 입력 필수 안내                               | P0       |
| U-ORD-03 | 포인트 사용 — 최소금액 미만      | "최소 1,000포인트부터 사용 가능" 검증 에러          | P1       |
| U-ORD-04 | 포인트 사용 — 최대비율 초과      | "주문금액의 50%까지 사용 가능" 검증 에러            | P1       |
| U-ORD-05 | 포인트 "전액 사용" 버튼          | 사용 가능 최대 금액 자동 입력, 최종 금액 재계산     | P1       |
| U-ORD-06 | 정상 주문 생성                   | 주문번호(ORD-YYYYMMDD-XXXXX) 발급, 확인 페이지 이동 | P0       |
| U-ORD-07 | 주문 확인 페이지                 | 주문 상세, 무통장 입금 계좌 정보, 입금자명 안내     | P0       |
| U-ORD-08 | 결제 전 주문 취소                | CANCELLED 전환, 포인트 환불, 재고 복구              | P0       |
| U-ORD-09 | 결제 확인 후 취소 시도           | 취소 불가 또는 관리자 문의 안내                     | P1       |
| U-ORD-10 | 미입금 주문 자동 만료            | 크론잡에 의한 자동 CANCELLED 처리                   | P2       |
| U-ORD-11 | 포인트 시스템 OFF 상태에서 주문  | 포인트 입력 UI 비노출, 포인트 없이 주문 가능        | P1       |
| U-ORD-12 | 빈 장바구니로 체크아웃 시도      | 체크아웃 차단, 안내 메시지                          | P1       |
| U-ORD-13 | 체크아웃 중 타이머 만료          | 주문 실패, 장바구니 비워짐 안내                     | P1       |

**테스트 작성 힌트:**

```typescript
// 주문 생성 후 API 응답 검증
const [orderResponse] = await Promise.all([
  page.waitForResponse(
    (resp) => resp.url().includes('/orders/from-cart') && resp.request().method() === 'POST',
    { timeout: 15000 },
  ),
  page.getByRole('button', { name: '주문하기' }).click(),
]);
expect(orderResponse.ok()).toBeTruthy();
// URL이 /orders/:orderId로 변경되었는지 확인
await expect(page).toHaveURL(/\/orders\//, { timeout: 15000 });
```

---

### 4.8 마이페이지

> 스펙 파일: `user-mypage.spec.ts`

| ID      | 시나리오                 | 검증 포인트                                               | 우선순위 |
| ------- | ------------------------ | --------------------------------------------------------- | -------- |
| U-MY-01 | 마이페이지 로드          | 프로필 정보 (Instagram ID, 입금자명, 이메일)              | P0       |
| U-MY-02 | 배송지 등록              | US 형식 주소 입력 (이름, 주소1/2, 시, 주, 우편번호, 전화) | P0       |
| U-MY-03 | 배송지 수정              | 기존 주소 복호화 표시 → 수정 → 저장                       | P0       |
| U-MY-04 | 주문 내역 카드           | 클릭 시 주문 목록 페이지 이동                             | P1       |
| U-MY-05 | 포인트 잔액 카드         | 현재 잔액 표시, 클릭 시 포인트 히스토리 이동              | P1       |
| U-MY-06 | 예약 카드                | 활성 예약 건수, 클릭 시 예약 상세 이동                    | P1       |
| U-MY-07 | 관리자 계정 → 마이페이지 | "관리자 대시보드" 바로가기 노출                           | P2       |
| U-MY-08 | 로그아웃                 | 세션 종료, /login 이동                                    | P0       |

---

### 4.9 포인트 내역

| ID      | 시나리오                     | 검증 포인트                                       | 우선순위 |
| ------- | ---------------------------- | ------------------------------------------------- | -------- |
| U-PT-01 | 포인트 히스토리 페이지       | 전체 내역 + 잔액 요약 (현재/총적립/총사용/총만료) | P1       |
| U-PT-02 | 유형별 필터                  | 적립/사용/환불/수동/만료 필터링                   | P1       |
| U-PT-03 | 결제 확인 후 적립 확인       | EARNED_ORDER 내역 (주문금액의 5%)                 | P1       |
| U-PT-04 | 주문 취소 후 환불 확인       | REFUND_CANCELLED 내역                             | P1       |
| U-PT-05 | 관리자 수동 포인트 추가 확인 | MANUAL_ADD + 사유 표시                            | P2       |
| U-PT-06 | 페이지네이션 (20건/페이지)   | 페이지 전환 정상                                  | P2       |
| U-PT-07 | 반응형 레이아웃              | 데스크톱(테이블) ↔ 모바일(카드) 전환              | P2       |

---

### 4.10 주문 상세 & 추적

| ID      | 시나리오               | 검증 포인트                               | 우선순위 |
| ------- | ---------------------- | ----------------------------------------- | -------- |
| U-OD-01 | 주문 상세 페이지       | 주문번호, 상품 목록, 결제/배송 상태, 금액 | P0       |
| U-OD-02 | PENDING_PAYMENT 상태   | "입금 대기 중" + 입금 계좌 안내           | P0       |
| U-OD-03 | PAYMENT_CONFIRMED 상태 | "결제 완료" + 결제일시                    | P1       |
| U-OD-04 | SHIPPED 상태           | "배송 중" + 발송일시                      | P1       |
| U-OD-05 | DELIVERED 상태         | "배송 완료" + 수령일시                    | P1       |
| U-OD-06 | CANCELLED 상태         | "주문 취소됨" 표시                        | P1       |

---

### 4.11 알림

> 스펙 파일: `user-alerts.spec.ts`

| ID       | 시나리오            | 검증 포인트                              | 우선순위 |
| -------- | ------------------- | ---------------------------------------- | -------- |
| U-NTF-01 | 브라우저 알림 구독  | 권한 요청 → 수락 시 구독 등록            | P1       |
| U-NTF-02 | 방송 시작 알림      | "라이브 방송이 시작되었습니다" 푸시 수신 | P1       |
| U-NTF-03 | 예약 승격 알림      | "예약하신 상품 구매가 가능합니다" 푸시   | P1       |
| U-NTF-04 | 주문 상태 변경 알림 | 결제확인/배송/배송완료 푸시              | P2       |
| U-NTF-05 | 알림 구독 해제      | 이후 푸시 수신 안 함                     | P2       |

---

## 5. 관리자(ADMIN) 시나리오

### 5.1 관리자 대시보드

> 스펙 파일: `admin-management.spec.ts`

| ID        | 시나리오                | 검증 포인트                                 | 우선순위 |
| --------- | ----------------------- | ------------------------------------------- | -------- |
| A-DASH-01 | 대시보드 로드           | 총 사용자, 활성 사용자, 매출 통계 위젯 표시 | P0       |
| A-DASH-02 | 라이브 방송 현황        | 현재 라이브 수, 피크 시청자, 전체 방송 수   | P1       |
| A-DASH-03 | 주문 통계               | 대기/확인/취소 건수 카드                    | P1       |
| A-DASH-04 | 최근 활동 로그          | 관리자 최근 액션 히스토리                   | P2       |
| A-DASH-05 | 일반 사용자 /admin 접근 | 403 또는 리다이렉트, 접근 차단              | P0       |

---

### 5.2 방송 관리

> 스펙 파일: `admin-broadcasts.spec.ts`

| ID      | 시나리오                      | 검증 포인트                           | 우선순위 |
| ------- | ----------------------------- | ------------------------------------- | -------- |
| A-BC-01 | 새 스트림 키 생성 (제목 입력) | 스트림 키 발급, PENDING 상태          | P0       |
| A-BC-02 | RTMP URL + 스트림 키 복사     | 클립보드 복사 기능 작동               | P0       |
| A-BC-03 | OBS 연결 → LIVE 전환          | on_publish 콜백 정상 처리             | P0       |
| A-BC-04 | OBS 종료 → OFFLINE 전환       | on_publish_done 콜백, 통계 기록       | P0       |
| A-BC-05 | 만료된 스트림 키로 방송 시도  | 인증 실패, 방송 차단                  | P1       |
| A-BC-06 | 방송 중 추천 상품 설정        | WebSocket으로 시청자 전체에 즉시 반영 | P0       |
| A-BC-07 | 추천 상품 해제                | 추천 상품 바 제거                     | P1       |
| A-BC-08 | 방송 히스토리 테이블          | 날짜, 제목, 피크 시청자, 총 시간 표시 | P1       |
| A-BC-09 | 히스토리 페이지네이션         | 정상 페이지 전환                      | P2       |

---

### 5.3 멀티 플랫폼 동시 송출 (ReStream)

| ID      | 시나리오                         | 검증 포인트                             | 우선순위 |
| ------- | -------------------------------- | --------------------------------------- | -------- |
| A-RS-01 | YouTube 리스트림 타겟 추가       | RTMP URL + 키 입력, 타겟 생성           | P1       |
| A-RS-02 | Instagram 리스트림 타겟 추가     | 타겟 생성, IDLE 상태                    | P1       |
| A-RS-03 | TikTok 리스트림 타겟 추가        | 타겟 생성                               | P2       |
| A-RS-04 | 커스텀 RTMP 타겟 추가            | 타겟 생성                               | P2       |
| A-RS-05 | 라이브 시작 → 자동 리스트림 시작 | 활성 타겟 CONNECTING → ACTIVE           | P1       |
| A-RS-06 | 개별 타겟 수동 정지              | 해당 타겟만 STOPPED                     | P1       |
| A-RS-07 | 개별 타겟 수동 재시작            | CONNECTING → ACTIVE                     | P1       |
| A-RS-08 | 리스트림 실패                    | FAILED + 에러 메시지 + 재시작 횟수 증가 | P1       |
| A-RS-09 | 타겟 비활성화                    | 다음 방송에서 자동 시작 안 됨           | P2       |
| A-RS-10 | 타겟 삭제                        | 목록에서 완전 제거                      | P2       |
| A-RS-11 | 실시간 상태 모니터링             | WebSocket으로 상태 변경 반영            | P1       |

---

### 5.4 상품 관리

> 스펙 파일: `admin-products-crud.spec.ts`

| ID       | 시나리오                         | 검증 포인트                         | 우선순위 |
| -------- | -------------------------------- | ----------------------------------- | -------- |
| A-PRD-01 | 새 상품 등록                     | 이름, 가격, 재고, 이미지, 방송 연결 | P0       |
| A-PRD-02 | 멀티 옵션 설정                   | 색상 (빨강/파랑), 사이즈 (S/M/L)    | P0       |
| A-PRD-03 | 할인가 설정                      | 원가 대비 할인율 자동 계산          | P1       |
| A-PRD-04 | 배송비 설정 / 무료배송           | 배송비 0원 → "무료배송"             | P1       |
| A-PRD-05 | 타이머 활성화 + 시간 설정        | 장바구니 추가 시 타이머 작동 확인   | P0       |
| A-PRD-06 | NEW 뱃지 토글                    | 홈 추천 상품에 NEW 표시/미표시      | P2       |
| A-PRD-07 | 재고 수량 변경                   | 즉시 반영 (0이면 SOLD_OUT)          | P0       |
| A-PRD-08 | 상태 변경 (AVAILABLE ↔ SOLD_OUT) | 사용자 화면에 품절 표시             | P0       |
| A-PRD-09 | 상품 수정 (가격, 이름 등)        | 변경 즉시 반영                      | P0       |
| A-PRD-10 | 상품 삭제                        | 목록에서 제거, 확인 다이얼로그      | P0       |
| A-PRD-11 | 이미지 업로드                    | 이미지 정상 표시                    | P1       |

**테스트 작성 힌트:**

```typescript
// 상품 CRUD는 스트림 키가 필요
// beforeAll에서 createTestStream() 호출
test.beforeAll(async () => {
  streamKey = await createTestStream();
});
```

---

### 5.5 주문 관리

> 스펙 파일: `admin-orders-management.spec.ts`, `admin-payment-confirmation.spec.ts`

| ID       | 시나리오                                     | 검증 포인트                             | 우선순위 |
| -------- | -------------------------------------------- | --------------------------------------- | -------- |
| A-ORD-01 | 전체 주문 목록                               | 주문 리스트 + 필터 UI 렌더링            | P0       |
| A-ORD-02 | 날짜 범위 필터                               | 해당 기간 주문만 표시                   | P1       |
| A-ORD-03 | 주문/결제/배송 상태별 필터                   | 필터 적용 후 목록 갱신                  | P1       |
| A-ORD-04 | 검색 (주문번호/이메일/입금자명/Instagram ID) | 매칭 결과 표시                          | P0       |
| A-ORD-05 | 결제 확인 (무통장 입금 확인)                 | PAYMENT_CONFIRMED 전환, paidAt 기록     | P0       |
| A-ORD-06 | 결제 확인 후 포인트 자동 적립                | 사용자 포인트 잔액 증가 확인            | P0       |
| A-ORD-07 | 결제 독촉 (카카오톡 알림)                    | 미입금 사용자에게 알림 전송             | P1       |
| A-ORD-08 | 배송 처리 (CSV 일괄 업로드)                  | 다수 주문 SHIPPED 전환                  | P1       |
| A-ORD-09 | 주문 상세 조회                               | 주문자 정보, 상품 목록, 금액, 상태 이력 | P0       |
| A-ORD-10 | 주문 취소 처리                               | CANCELLED, 재고/포인트 복구             | P0       |

---

### 5.6 사용자 관리

> 스펙 파일: `admin-users-detail.spec.ts`

| ID       | 시나리오                               | 검증 포인트                        | 우선순위 |
| -------- | -------------------------------------- | ---------------------------------- | -------- |
| A-USR-01 | 전체 사용자 목록 (페이지네이션 + 검색) | 사용자 리스트 표시                 | P0       |
| A-USR-02 | 사용자 상세 조회                       | 프로필, 주문 히스토리, 포인트 잔액 | P0       |
| A-USR-03 | 상태 변경 (ACTIVE → SUSPENDED + 사유)  | 해당 사용자 이용 차단              | P0       |
| A-USR-04 | 정지 해제 (SUSPENDED → ACTIVE)         | 이용 재개                          | P1       |
| A-USR-05 | 포인트 수동 추가 (사유 입력)           | 잔액 증가 + MANUAL_ADD 기록        | P1       |
| A-USR-06 | 포인트 수동 차감 (사유 입력)           | 잔액 감소 + MANUAL_SUBTRACT 기록   | P1       |

---

### 5.7 채팅 관리

| ID       | 시나리오             | 검증 포인트                            | 우선순위 |
| -------- | -------------------- | -------------------------------------- | -------- |
| A-CHT-01 | 라이브 채팅 모니터링 | 실시간 채팅 관리자 확인 가능           | P1       |
| A-CHT-02 | 부적절한 메시지 삭제 | 소프트 삭제, 시청자 화면에서 즉시 제거 | P0       |
| A-CHT-03 | 삭제 로그 확인       | 모더레이션 로그 (DELETE_MESSAGE) 기록  | P1       |

---

### 5.8 정산

> 스펙 파일: `admin-settlement.spec.ts`

| ID       | 시나리오                                 | 검증 포인트                  | 우선순위 |
| -------- | ---------------------------------------- | ---------------------------- | -------- |
| A-STL-01 | 날짜 범위 선택 → 정산 리포트 생성        | totalSales, 수수료, 정산금액 | P0       |
| A-STL-02 | 정산 상태별 필터 (PENDING/APPROVED/PAID) | 필터링 정상                  | P1       |
| A-STL-03 | Excel 다운로드                           | .xlsx 파일 다운로드 확인     | P0       |
| A-STL-04 | 정산 승인                                | APPROVED 전환                | P1       |
| A-STL-05 | 정산 완료                                | PAID 전환                    | P1       |

**테스트 작성 힌트:**

```typescript
// Excel 다운로드 검증
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Excel 다운로드' }).click(),
]);
expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
```

---

### 5.9 시스템 설정

> 스펙 파일: `admin-settings.spec.ts`

| ID       | 시나리오                       | 검증 포인트                           | 우선순위 |
| -------- | ------------------------------ | ------------------------------------- | -------- |
| A-SET-01 | 공지사항 텍스트 수정           | 저장 후 방송 화면에 반영              | P1       |
| A-SET-02 | 공지 폰트 크기/서체 변경       | 스타일 변경 반영                      | P2       |
| A-SET-03 | 배송 상태 메시지 커스터마이징  | 준비중/발송/운송/배달완료 메시지 변경 | P2       |
| A-SET-04 | 포인트 시스템 ON/OFF 토글      | OFF 시 체크아웃에서 포인트 UI 비노출  | P0       |
| A-SET-05 | 포인트 적립률 변경 (5% → 10%)  | 이후 결제 확인 주문부터 새 적립률     | P1       |
| A-SET-06 | 최소 사용 포인트 변경          | 체크아웃 유효성 검증 변경             | P1       |
| A-SET-07 | 최대 사용 비율 변경            | 체크아웃 최대 한도 변경               | P1       |
| A-SET-08 | 포인트 만료 ON/OFF + 만료 기간 | 크론잡 동작 변경                      | P2       |

---

### 5.10 감사 로그

> 스펙 파일: `admin-audit-log.spec.ts`

| ID       | 시나리오                              | 검증 포인트              | 우선순위 |
| -------- | ------------------------------------- | ------------------------ | -------- |
| A-LOG-01 | 감사 로그 페이지 로드                 | 관리자 행동 전체 기록    | P0       |
| A-LOG-02 | 날짜 범위 필터                        | 해당 기간 로그           | P1       |
| A-LOG-03 | 액션 타입 필터 (CREATE/UPDATE/DELETE) | 필터링                   | P1       |
| A-LOG-04 | 엔티티 필터 (주문/상품/사용자)        | 특정 엔티티 이력만       | P1       |
| A-LOG-05 | before/after 비교                     | JSON diff 변경 내용 확인 | P2       |
| A-LOG-06 | 관리자 ID 확인                        | 누가 수행했는지 표시     | P2       |

---

## 6. 크로스 시나리오

### 6.1 전체 구매 흐름 (Happy Path)

가장 중요한 E2E 흐름입니다. 이 시나리오가 통과해야 서비스가 정상입니다.

```
[관리자] 스트림 키 생성 → OBS 방송 시작
    ↓
[관리자] 상품 등록 (타이머 10분, 재고 10개)
    ↓
[관리자] 추천 상품 설정
    ↓
[사용자] 라이브 방송 입장 → HLS 영상 시청
    ↓
[사용자] 채팅 메시지 전송 → 다른 시청자에게 표시
    ↓
[사용자] 추천 상품 클릭 → 상세 모달
    ↓
[사용자] 색상/사이즈 선택 → 장바구니 추가 (타이머 시작)
    ↓
[다른 시청자] "OOO님이 XXX를 담았습니다" 피드 확인
    ↓
[사용자] 체크아웃 → 포인트 사용 → 주문 생성 (ORD-XXXXXXXX-XXXXX)
    ↓
[관리자] 주문 목록에서 확인 → 결제 확인 (무통장 입금)
    ↓
[사용자] 포인트 적립 확인 (주문금액의 5%)
    ↓
[관리자] 배송 처리 (CSV 업로드)
    ↓
[사용자] 주문 상세에서 "배송 중" 확인
    ↓
[관리자] 배송 완료 처리
    ↓
[사용자] "배송 완료" 확인
```

**자동화 테스트 구성 (serial):**

```typescript
test.describe.configure({ mode: 'serial' });

test.describe('전체 구매 흐름', () => {
  let streamKey: string;
  let productId: string;
  let orderId: string;

  test('관리자: 스트림 키 생성', async ({ browser }) => {
    /* ... */
  });
  test('관리자: 상품 등록', async ({ browser }) => {
    /* ... */
  });
  test('사용자: 장바구니 추가', async ({ browser }) => {
    /* ... */
  });
  test('사용자: 주문 생성', async ({ browser }) => {
    /* ... */
  });
  test('관리자: 결제 확인', async ({ browser }) => {
    /* ... */
  });
  test('사용자: 포인트 적립 확인', async ({ browser }) => {
    /* ... */
  });
  test('관리자: 배송 처리', async ({ browser }) => {
    /* ... */
  });
  test('사용자: 배송 완료 확인', async ({ browser }) => {
    /* ... */
  });
});
```

### 6.2 예약 → 구매 흐름

```
[관리자] 재고 0 상품 존재
    ↓
[사용자A] 장바구니 추가 시도 → 품절 안내
    ↓
[사용자A] 예약 신청 → 예약번호 #1 (WAITING)
    ↓
[사용자B] 예약 신청 → 예약번호 #2 (WAITING)
    ↓
[관리자] 재고 1개 추가 (또는 다른 사용자 장바구니 만료)
    ↓
[사용자A] 자동 승격 (PROMOTED) → 10분 타이머 시작
    ↓
[사용자A] 10분 내 장바구니 추가 → 체크아웃 → 주문 완료
    ↓
(또는)
[사용자A] 10분 초과 → EXPIRED → 사용자B 자동 승격
```

### 6.3 주문 취소 → 포인트 환불 흐름

```
[사용자] 포인트 3,000P 사용하여 주문 생성
    ↓
[사용자] 결제 전 주문 취소
    ↓
[시스템] 사용한 포인트 3,000P 환불 (REFUND_CANCELLED)
    ↓
[시스템] 재고 복구
    ↓
[사용자] 포인트 히스토리에서 환불 내역 확인
```

---

## 7. 엣지 케이스 & 동시성

### 7.1 동시 접속 시나리오

| ID       | 시나리오                                     | 검증 포인트                          | 우선순위 |
| -------- | -------------------------------------------- | ------------------------------------ | -------- |
| E-CON-01 | 10명 동시 같은 상품 장바구니 추가 (재고 5개) | 5명 성공, 5명 품절 안내, 재고 정확   | P0       |
| E-CON-02 | 여러 시청자 동시 채팅 전송                   | 모든 메시지 순서대로 표시, 유실 없음 | P1       |
| E-CON-03 | 여러 사용자 동시 예약 신청                   | 순차 예약번호, 중복 없음             | P1       |

**테스트 작성 힌트:**

```typescript
// 여러 브라우저 컨텍스트로 동시 접속 시뮬레이션
const contexts = await Promise.all(
  Array.from({ length: 5 }, () => browser.newContext({ storageState: 'e2e/.auth/user.json' })),
);
const pages = await Promise.all(contexts.map((ctx) => ctx.newPage()));

// 동시에 장바구니 추가
await Promise.all(
  pages.map((p) =>
    p.evaluate(async (productId) => {
      const csrf = document.cookie.match(/csrf-token=([^;]+)/)?.[1] || '';
      return fetch('/api/v1/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        credentials: 'include',
        body: JSON.stringify({ productId, quantity: 1 }),
      }).then((r) => r.json());
    }, productId),
  ),
);
```

### 7.2 엣지 케이스

| ID        | 시나리오                                              | 검증 포인트                     | 우선순위 |
| --------- | ----------------------------------------------------- | ------------------------------- | -------- |
| E-EDGE-01 | 장바구니 상품이 관리자에 의해 품절 처리               | 적절한 안내 메시지              | P1       |
| E-EDGE-02 | 체크아웃 중 타이머 만료                               | 주문 실패, 장바구니 비워짐 안내 | P1       |
| E-EDGE-03 | 결제 확인 직후 취소 시도                              | 취소 불가 처리                  | P1       |
| E-EDGE-04 | 포인트 시스템 OFF 상태에서 포인트 사용 시도           | 포인트 입력 UI 비노출           | P1       |
| E-EDGE-05 | 빈 장바구니로 체크아웃                                | 차단 + 안내                     | P1       |
| E-EDGE-06 | 배송지 미입력 상태에서 주문                           | 배송지 입력 필수 안내           | P0       |
| E-EDGE-07 | 동일 상품 중복 예약                                   | 중복 차단                       | P1       |
| E-EDGE-08 | 방송 없는 상태에서 라이브 접근                        | "현재 방송 중이 아닙니다"       | P0       |
| E-EDGE-09 | 로그인 없이 보호 페이지 접근 (/my-page, /checkout 등) | 로그인 리다이렉트               | P0       |
| E-EDGE-10 | 관리자 아닌 사용자가 관리자 API 직접 호출             | 403 Forbidden                   | P0       |
| E-EDGE-11 | 존재하지 않는 주문번호로 상세 페이지 접근             | 404 또는 적절한 에러            | P1       |
| E-EDGE-12 | 매우 긴 채팅 메시지 입력 (경계값: 정확히 200자)       | 200자 허용, 201자 차단          | P2       |
| E-EDGE-13 | 특수문자/이모지만으로 구성된 채팅                     | 정상 전송                       | P2       |

---

## 8. 기존 스펙 파일 매핑

현재 구현된 E2E 테스트 파일과 커버리지 영역입니다:

| 스펙 파일                            | 라인 수 | 커버 시나리오 ID                      |
| ------------------------------------ | ------- | ------------------------------------- |
| `api-health.spec.ts`                 | 45      | 인프라 헬스체크                       |
| `home.spec.ts`                       | 65      | U-HOME-01~03                          |
| `shop-purchase-flow.spec.ts`         | 84      | U-SHOP-01~04                          |
| `live-page.spec.ts`                  | 51      | U-LIVE-01, U-LIVE-09                  |
| `live-cart-pickup.spec.ts`           | 256     | U-LIVE-05~07, U-CART-01~02, U-CART-08 |
| `chat.spec.ts`                       | 272     | U-CHAT-01~06                          |
| `user-registration.spec.ts`          | 120     | U-AUTH-01~04                          |
| `user-cart-order.spec.ts`            | 283     | U-CART-01~07, U-ORD-01~08             |
| `user-mypage.spec.ts`                | 176     | U-MY-01~08                            |
| `user-alerts.spec.ts`                | 65      | U-NTF-01~02                           |
| `reservation-system.spec.ts`         | 286     | U-RSV-01~09                           |
| `admin-management.spec.ts`           | 97      | A-DASH-01~05                          |
| `admin-products-crud.spec.ts`        | 172     | A-PRD-01~10                           |
| `admin-orders-management.spec.ts`    | 337     | A-ORD-01~10                           |
| `admin-payment-confirmation.spec.ts` | 318     | A-ORD-05~06 (심화)                    |
| `admin-broadcasts.spec.ts`           | 114     | A-BC-01~09                            |
| `admin-users-detail.spec.ts`         | 95      | A-USR-01~04                           |
| `admin-settings.spec.ts`             | 86      | A-SET-01~08                           |
| `admin-settlement.spec.ts`           | 78      | A-STL-01~05                           |
| `admin-audit-log.spec.ts`            | 77      | A-LOG-01~06                           |

### 미구현/보강 필요 영역

| 영역                      | 상태       | 비고                                |
| ------------------------- | ---------- | ----------------------------------- |
| 리스트림 (A-RS-\*)        | **미구현** | ReStream 기능 E2E 테스트 없음       |
| 포인트 히스토리 (U-PT-\*) | **미구현** | 포인트 내역 페이지 전용 테스트 없음 |
| 주문 상세/추적 (U-OD-\*)  | **부분**   | user-cart-order에서 일부 커버       |
| 동시성 테스트 (E-CON-\*)  | **미구현** | 멀티 컨텍스트 테스트 없음           |
| 채팅 관리 (A-CHT-\*)      | **미구현** | 관리자 채팅 모더레이션 테스트 없음  |
| 엣지 케이스 (E-EDGE-\*)   | **부분**   | 일부 빈 상태 처리만 구현            |
| 크로스 시나리오 6.1~6.3   | **미구현** | 관리자-사용자 간 통합 시나리오 없음 |

---

## 9. API 엔드포인트 참조

테스트에서 직접 호출하는 주요 API입니다:

### 인증

| Method | Endpoint                         | 용도               |
| ------ | -------------------------------- | ------------------ |
| POST   | `/api/v1/auth/dev-login`         | 개발/테스트 로그인 |
| POST   | `/api/v1/auth/logout`            | 로그아웃           |
| POST   | `/api/v1/users/complete-profile` | 프로필 완성        |
| GET    | `/api/v1/users/me`               | 내 정보 조회       |

### 상품

| Method | Endpoint                     | 용도               |
| ------ | ---------------------------- | ------------------ |
| GET    | `/api/v1/products`           | 상품 목록          |
| GET    | `/api/v1/products/:id`       | 상품 상세          |
| POST   | `/api/v1/admin/products`     | 상품 생성 (관리자) |
| PATCH  | `/api/v1/admin/products/:id` | 상품 수정 (관리자) |
| DELETE | `/api/v1/admin/products/:id` | 상품 삭제 (관리자) |

### 장바구니

| Method | Endpoint           | 용도          |
| ------ | ------------------ | ------------- |
| GET    | `/api/v1/cart`     | 장바구니 조회 |
| POST   | `/api/v1/cart`     | 장바구니 추가 |
| PATCH  | `/api/v1/cart/:id` | 수량 변경     |
| DELETE | `/api/v1/cart/:id` | 항목 삭제     |
| DELETE | `/api/v1/cart`     | 전체 비우기   |

### 주문

| Method | Endpoint                    | 용도                 |
| ------ | --------------------------- | -------------------- |
| POST   | `/api/v1/orders/from-cart`  | 장바구니 → 주문 생성 |
| GET    | `/api/v1/orders`            | 주문 목록            |
| GET    | `/api/v1/orders/:id`        | 주문 상세            |
| PATCH  | `/api/v1/orders/:id/cancel` | 주문 취소            |

### 관리자 주문

| Method | Endpoint                                   | 용도           |
| ------ | ------------------------------------------ | -------------- |
| GET    | `/api/v1/admin/orders`                     | 주문 관리 목록 |
| PATCH  | `/api/v1/admin/orders/:id/confirm-payment` | 결제 확인      |
| PATCH  | `/api/v1/admin/orders/:id/ship`            | 배송 처리      |
| POST   | `/api/v1/admin/orders/bulk-shipping`       | CSV 일괄 배송  |

### 예약

| Method | Endpoint                          | 용도         |
| ------ | --------------------------------- | ------------ |
| POST   | `/api/v1/reservations`            | 예약 신청    |
| GET    | `/api/v1/reservations`            | 내 예약 목록 |
| PATCH  | `/api/v1/reservations/:id/cancel` | 예약 취소    |

### 포인트

| Method | Endpoint                      | 용도               |
| ------ | ----------------------------- | ------------------ |
| GET    | `/api/v1/points/balance`      | 잔액 조회          |
| GET    | `/api/v1/points/history`      | 내역 조회          |
| POST   | `/api/v1/admin/points/adjust` | 수동 조정 (관리자) |

### 스트리밍

| Method | Endpoint                                 | 용도           |
| ------ | ---------------------------------------- | -------------- |
| POST   | `/api/v1/admin/streams/generate-key`     | 스트림 키 생성 |
| GET    | `/api/v1/admin/streams/status`           | 스트리밍 상태  |
| GET    | `/api/v1/admin/streams/history`          | 방송 히스토리  |
| POST   | `/api/v1/admin/streams/featured-product` | 추천 상품 설정 |

### 정산

| Method | Endpoint                          | 용도           |
| ------ | --------------------------------- | -------------- |
| GET    | `/api/v1/admin/settlement`        | 정산 리포트    |
| GET    | `/api/v1/admin/settlement/export` | Excel 다운로드 |

### 설정

| Method | Endpoint                 | 용도      |
| ------ | ------------------------ | --------- |
| GET    | `/api/v1/admin/settings` | 설정 조회 |
| PATCH  | `/api/v1/admin/settings` | 설정 수정 |

---

## 10. 코드 스니펫 참조

### 10.1 새 테스트 파일 템플릿

```typescript
import { test, expect } from '@playwright/test';

test.describe('기능 이름', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/target-page', { waitUntil: 'domcontentloaded' });
  });

  test('시나리오 설명', async ({ page }) => {
    // Arrange
    await expect(page.getByText('페이지 제목')).toBeVisible({ timeout: 15000 });

    // Act
    await page.getByRole('button', { name: '동작' }).click();

    // Assert
    await expect(page.getByText('기대 결과')).toBeVisible({ timeout: 10000 });
  });
});
```

### 10.2 관리자 + 사용자 크로스 테스트 템플릿

```typescript
import { test, expect, Browser } from '@playwright/test';

test.describe('관리자-사용자 크로스 시나리오', () => {
  test('관리자 결제 확인 → 사용자 포인트 적립', async ({ browser }) => {
    // 관리자 컨텍스트
    const adminCtx = await browser.newContext({
      storageState: 'e2e/.auth/admin.json',
    });
    const adminPage = await adminCtx.newPage();

    // 사용자 컨텍스트
    const userCtx = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const userPage = await userCtx.newPage();

    // 관리자: 결제 확인
    await adminPage.goto('/admin/orders');
    // ... 결제 확인 로직

    // 사용자: 포인트 확인
    await userPage.goto('/my-page/points');
    // ... 포인트 적립 확인

    await adminCtx.close();
    await userCtx.close();
  });
});
```

### 10.3 API를 통한 테스트 데이터 사전 설정

```typescript
async function createProductViaAPI(page: Page, streamKey: string) {
  return page.evaluate(
    async ({ streamKey }) => {
      const csrf = document.cookie.match(/csrf-token=([^;]+)/)?.[1] || '';
      const res = await fetch('/api/v1/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
        },
        credentials: 'include',
        body: JSON.stringify({
          name: `테스트상품-${Date.now()}`,
          price: 29900,
          stock: 10,
          streamKey,
          colorOptions: ['블랙', '화이트'],
          sizeOptions: ['S', 'M', 'L'],
          shippingFee: 3000,
          timerEnabled: true,
          timerDuration: 600,
        }),
      });
      return res.json();
    },
    { streamKey },
  );
}
```

### 10.4 타이머 테스트 (시간 가속)

```typescript
test('타이머 만료 시 장바구니 자동 제거', async ({ page }) => {
  // 짧은 타이머(30초)로 상품 생성 후 테스트
  // 또는 page.clock API 사용
  await page.clock.install();

  // 장바구니 추가
  // ...

  // 시간 10분 앞으로
  await page.clock.fastForward('10:00');

  // 만료 확인
  await expect(page.getByText('장바구니가 비어있습니다')).toBeVisible();
});
```

### 10.5 파일 다운로드 검증

```typescript
test('Excel 다운로드', async ({ page }) => {
  await page.goto('/admin/settlement');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Excel 다운로드' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/settlement.*\.xlsx$/);

  // 선택: 파일 내용 검증
  const path = await download.path();
  // ExcelJS로 파일 내용 검증 가능
});
```

### 10.6 WebSocket 이벤트 검증

```typescript
test('추천 상품 실시간 업데이트', async ({ page }) => {
  await page.goto('/live/stream-key');

  // WebSocket 메시지 수신 대기
  const wsMessage = page.waitForEvent('websocket', {
    predicate: (ws) => ws.url().includes('socket.io'),
  });

  // 또는 UI 변화로 간접 검증 (더 안정적)
  await expect(page.locator('[data-testid="featured-product"]')).toContainText('새 추천 상품', {
    timeout: 30000,
  });
});
```

---

## 부록: 우선순위 가이드

| 우선순위 | 의미                | 기준                                     |
| -------- | ------------------- | ---------------------------------------- |
| **P0**   | 필수 (Must)         | 서비스 핵심 흐름. 실패 시 서비스 불가    |
| **P1**   | 중요 (Should)       | 주요 기능. 실패 시 사용자 경험 심각 저하 |
| **P2**   | 권장 (Nice-to-have) | 보조 기능. 실패 시 불편하지만 대체 가능  |

**권장 자동화 순서:**

1. P0 시나리오 전체 자동화 (서비스 안정성 보장)
2. 크로스 시나리오 6.1 전체 구매 흐름 (가장 중요한 비즈니스 흐름)
3. P1 시나리오 중 빈번한 사용 경로
4. 엣지 케이스 (E-EDGE) 중 보안 관련 (E-EDGE-09, 10)
5. 나머지 P1, P2 순차 추가
