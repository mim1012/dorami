# Dorami 라이브 커머스 - E2E 통합 테스트 보고서

**테스트 일시**: 2026-02-07
**테스트 환경**: macOS (Darwin 24.3.0, arm64)
**백엔드**: NestJS @ localhost:3001
**프론트엔드**: Next.js 16.1.4 (Turbopack) @ localhost:3002
**DB**: PostgreSQL 16, Redis
**브라우저**: Chrome (OpenClaw Browser)

---

## 1. 테스트 실행 요약

### 1.1 서버 시작 결과

| 서비스 | 포트 | 상태 | 비고 |
|--------|------|------|------|
| Backend (NestJS) | 3001 | ✅ 정상 | 0 errors, 컴파일 성공 |
| Frontend (Next.js) | 3002 | ⚠️ 부분 | recharts 모듈 누락 → 정산/마이페이지 빌드 에러 |
| PostgreSQL | 5432 | ✅ 정상 | live_commerce DB |
| Redis | 6379 | ✅ 정상 | 연결 확인 |

### 1.2 Backend 의존성 이슈

초기 `npm run dev:backend` 시 `@nestjs/swagger` 모듈 미발견 에러 38건 → `npm install` 후 해결.

### 1.3 Frontend 빌드 이슈

`recharts` 모듈 미설치로 인해 정산 페이지(`/admin/settlement`) 접근 시 빌드 에러. 
Next.js의 특성상 같은 레이아웃 내 라우팅에도 영향을 미침.

---

## 2. API 헬스체크

```bash
$ curl http://localhost:3001/api/health
{
  "data": {"status": "ok", "timestamp": "2026-02-07T17:58:55.490Z"},
  "success": true
}
```

**결과**: ✅ API 서버 정상 응답

---

## 3. 수동 화면 테스트 (Browser 도구)

### 3.1 메인 홈 화면 (/)

**스크린샷**: `docs/screenshots/01-home.jpg`

| 검증 항목 | 상태 | 비고 |
|----------|------|------|
| 페이지 렌더링 | ✅ | 정상 로딩 |
| DoReMi 로고 | ✅ | 좌상단 Hot Pink 색상 |
| 검색바 | ✅ | 상단 검색 UI 표시 |
| 라이브 카운트다운 배너 | ✅ | "NEXT LIVE" + 카운트다운 타이머 동작 |
| "알림받기" 버튼 | ✅ | UI 표시됨 (alert 임시 처리) |
| 소셜 프루프 | ✅ | "6,161명 단골!" 표시 |
| 예정된 라이브 카드 | ✅ | 3개 카드 렌더링, 썸네일 포함 |
| 상품 큐레이션 그리드 | ✅ | 2열 그리드, 6개 상품 |
| isNew 뱃지 | ✅ | NEW 태그 표시 |
| discount 뱃지 | ✅ | -30%, -15%, -20% 표시 |
| 하단 탭 바 | ✅ | Home, Shop, Live, 문의, My Page |
| 플로팅 네비게이션 | ✅ | 우측 플로팅 버튼 그룹 |
| 다크모드 토글 | ✅ | 우상단 아이콘 |
| 반응형 레이아웃 | ✅ | 모바일/데스크톱 대응 |

**이슈**: 
- 데이터가 Mock (하드코딩)임. API 연동 필요.
- "더보기 →" 버튼 클릭 시 동작 없음.

---

### 3.2 상품 목록 (/shop)

**스크린샷**: `docs/screenshots/02-shop.png`

| 검증 항목 | 상태 | 비고 |
|----------|------|------|
| 페이지 렌더링 | ✅ | 정상 로딩 |
| "DoReMi Shop" 제목 | ✅ | |
| 상품 수 표시 | ✅ | "8개의 상품" |
| 검색바 | ✅ | "상품 검색..." 플레이스홀더 |
| 4열 그리드 | ✅ | 데스크톱 4열 |
| 상품 카드 | ✅ | 이미지, 이름, 가격, 하트, 별점 |
| NEW 뱃지 | ✅ | 표시됨 |
| 할인 뱃지 | ✅ | -30%, -15%, -20% |
| 가격 표시 (할인) | ✅ | 원가 취소선 + 할인가 |
| 하단 탭 바 | ✅ | Shop 탭 활성 상태 |
| 다크모드 토글 | ✅ | |

**이슈**:
- 데이터가 Mock임.
- 상품 클릭 시 상세 페이지 라우팅이 `/product/${id}` (존재하지 않는 경로)

---

### 3.3 장바구니 (/cart)

**스크린샷**: `docs/screenshots/03-cart.png`

| 검증 항목 | 상태 | 비고 |
|----------|------|------|
| 페이지 렌더링 | ✅ | 정상 로딩 |
| 에러 메시지 | ⚠️ | "장바구니를 불러오는데 실패했습니다." |
| 하단 탭 바 | ✅ | |

**이슈**: 
- 사용자 미인증 상태에서 접근 시 API 호출 실패 (401)
- 에러 UI는 정상 표시되지만, 로그인 리다이렉트 없음.

---

### 3.4 관리자 대시보드 (/admin)

**스크린샷**: `docs/screenshots/04-admin-dashboard.png`

| 검증 항목 | 상태 | 비고 |
|----------|------|------|
| 사이드바 네비게이션 | ✅ | 대시보드, 방송관리, 상품관리, 주문관리, 사용자관리, 설정 |
| 상단 헤더 | ✅ | 검색, 알림, 관리자 프로필 |
| 환영 메시지 | ✅ | "반갑습니다, 관리자님 👋" |
| 총 매출 카드 | ✅ | 12,500,000원 (+12.5%) |
| 실시간 시청자 카드 | ✅ | 8,432명 (+23.1%) |
| 신규 주문 카드 | ✅ | 342건 (+8.3%) |
| 매출 현황 차트 | ⚠️ | 플레이스홀더 (차트 미구현) |
| "방송 시작하기" 버튼 | ✅ | |
| "리포트 다운로드" 버튼 | ✅ | |

**이슈**: 
- 인증 없이 접근 가능 (보안 이슈)
- 매출 데이터가 Mock (하드코딩)
- `/admin` 페이지와 `/admin/dashboard` 페이지가 별도로 존재 (중복)

---

### 3.5 관리자 상품관리 (/admin/products)

**스크린샷**: `docs/screenshots/05-admin-products.png`

| 검증 항목 | 상태 | 비고 |
|----------|------|------|
| 상품 테이블 | ✅ | 6개 상품 표시 |
| 상품 이미지 | ✅ | 썸네일 표시 |
| Stream Key 표시 | ✅ | 코드 형태로 표시 |
| 가격/배송비 표시 | ✅ | 원화 포맷 |
| 재고 표시 | ✅ | |
| 상태 뱃지 | ✅ | "판매중"/"품절" |
| 색상/사이즈 태그 | ✅ | "3 색상", "3 사이즈" |
| 타이머 표시 | ✅ | "⏱️ 15분" |
| 수정/품절/삭제 버튼 | ✅ | |
| "상품 등록" 버튼 | ✅ | |
| Stream Key 필터 | ✅ | |

**이슈**: 
- 데이터가 Mock임. 백엔드 products API와 미연동.

---

### 3.6 관리자 주문관리 (/admin/orders)

**스크린샷**: `docs/screenshots/06-admin-orders.png`

| 검증 항목 | 상태 | 비고 |
|----------|------|------|
| 주문 테이블 | ✅ | 5개 주문 표시 |
| Order ID | ✅ | ORD-001 ~ ORD-005 |
| 고객 정보 | ✅ | 이메일 + 인스타그램 ID |
| 입금자명 | ✅ | |
| 주문/결제/배송 상태 | ✅ | 뱃지 형태 |
| 금액 표시 | ✅ | USD 포맷 (KRW여야 함) |
| 검색 기능 | ✅ | Order ID, email 등 |
| 필터 기능 | ✅ | "Show Filters" 버튼 |
| 페이지네이션 | ✅ | "Showing 1-5 of 5" |
| 입금확인/알림전송 버튼 | ✅ | PENDING 상태에서 표시 |

**이슈**:
- 데이터가 Mock임.
- 금액이 USD로 표시 (`$153,000.00`) → KRW로 변경 필요.
- 인증 없이 접근 가능.

---

### 3.7 관리자 정산 (/admin/settlement)

**스크린샷**: `docs/screenshots/07-admin-settlement-error.png`

| 검증 항목 | 상태 | 비고 |
|----------|------|------|
| 페이지 렌더링 | ❌ | 빌드 에러 |

**에러**: `Module not found: Can't resolve 'recharts'`

**원인**: `client-app/package.json`에 `recharts` 의존성 미설치.

---

### 3.8 마이페이지 (/my-page)

**스크린샷**: `docs/screenshots/08-mypage-error.png`

| 검증 항목 | 상태 | 비고 |
|----------|------|------|
| 페이지 렌더링 | ❌ | recharts 빌드 에러 영향 |

**원인**: Next.js 레이아웃 시스템에서 `recharts` 에러가 전파되어 다른 페이지에도 영향.

---

## 4. 기존 E2E 테스트 파일 분석

### 4.1 Backend E2E 테스트 (14개 파일)

| 파일 | 대상 기능 |
|------|----------|
| `admin/admin-orders.e2e-spec.ts` | 관리자 주문 관리 |
| `admin/admin-user-detail.e2e-spec.ts` | 관리자 사용자 상세 |
| `admin/admin-users.e2e-spec.ts` | 관리자 사용자 목록 |
| `admin/dashboard-and-audit.e2e-spec.ts` | 대시보드/감사 로그 |
| `admin/payment-confirmation.e2e-spec.ts` | 입금 확인 |
| `admin/settlement.e2e-spec.ts` | 정산 |
| `app.e2e-spec.ts` | 앱 기본 |
| `auth/kakao-auth.e2e-spec.ts` | 카카오 인증 |
| `cart/cart.e2e-spec.ts` | 장바구니 |
| `orders/orders.e2e-spec.ts` | 주문 |
| `products.e2e-spec.ts` | 상품 |
| `products/store-products.e2e-spec.ts` | 스토어 상품 |
| `users/my-page-address-update.e2e-spec.ts` | 배송지 수정 |
| `users/profile-completion.e2e-spec.ts` | 프로필 완성 |

### 4.2 Frontend Playwright 테스트 (5개 파일)

| 파일 | 대상 기능 |
|------|----------|
| `api-health.spec.ts` | API 헬스체크 |
| `shop.spec.ts` | 상점 페이지 |
| `shop-purchase-flow.spec.ts` | 구매 플로우 |
| `home.spec.ts` | 홈 페이지 |
| `admin-products-crud.spec.ts` | 관리자 상품 CRUD |

---

## 5. 발견된 버그 및 이슈

### 5.1 Critical 버그

| # | 이슈 | 위치 | 영향 |
|---|------|------|------|
| 1 | `recharts` 미설치로 정산/마이페이지 빌드 실패 | client-app | 2개 페이지 완전 사용 불가 |
| 2 | Admin 인증 비활성화 | admin.controller.ts | 보안 취약 |

### 5.2 High 버그

| # | 이슈 | 위치 | 영향 |
|---|------|------|------|
| 3 | 주문 금액 USD 표시 (KRW여야 함) | admin/orders/page.tsx | UX |
| 4 | 프론트엔드 Mock 데이터 | 홈, 상품관리, 주문관리 | 기능 미동작 |
| 5 | 비인증 상태 장바구니 접근 시 로그인 리다이렉트 없음 | cart/page.tsx | UX |
| 6 | `/admin` 과 `/admin/dashboard` 중복 | admin/ | 혼란 |

### 5.3 Medium 버그

| # | 이슈 | 위치 | 영향 |
|---|------|------|------|
| 7 | 상품 클릭 라우팅 `/product/${id}` (존재하지 않는 경로) | 홈 페이지 | 404 |
| 8 | "더보기" 버튼 미구현 | 홈 페이지 | UX |
| 9 | Backend 시작 시 `@nestjs/swagger` 미설치 | backend/ | 개발 환경 |

---

## 6. 테스트 통과율 요약

| 테스트 유형 | 총 건수 | 통과 | 실패 | 통과율 |
|------------|--------|------|------|--------|
| API 헬스체크 | 1 | 1 | 0 | 100% |
| 수동 화면 테스트 | 8 | 5 | 3 | 63% |
| 전체 | 9 | 6 | 3 | 67% |

**실패 사유**: recharts 의존성 미설치 (2건), API 미인증 (1건)

---

## 7. 권장 조치

### 즉시 (배포 전 필수)

1. `cd client-app && npm install recharts` → 정산/마이페이지 정상화
2. Admin 인증 재활성화
3. Mock 데이터 → API 연동 전환

### 단기 (1주 이내)

4. 주문 금액 KRW 포맷 수정
5. 비인증 상태 리다이렉트 구현
6. 상품 상세 라우팅 수정 (`/products/[id]`)

### 중기 (2주 이내)

7. Backend E2E 테스트 실행 및 통과 확인
8. Playwright 테스트 실행 및 통과 확인
9. 에러 바운더리 구현

---

*E2E 통합 테스트 보고서: 2026-02-07*
