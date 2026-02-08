# 🎨 DoRaMi UI 개선 보고서 v2

> 작성일: 2026-02-07  
> 목표: eunimarket.com을 뛰어넘는 프리미엄 라이브 커머스 UI

---

## 📋 작업 요약

| # | 작업 | 상태 |
|---|------|------|
| 1 | recharts 설치 | ✅ 완료 |
| 2 | Admin 인증 조건부 처리 | ✅ 완료 |
| 3 | UI 전면 개선 (홈/라이브/샵) | ✅ 완료 |
| 4 | 장바구니 실시간 표시 | ✅ 완료 (기존 구현 검증 + 개선) |
| 5 | 빌드 확인 + 스크린샷 | ✅ 완료 |

---

## 1. recharts 설치

```bash
cd client-app && npm install recharts
```
- Admin 대시보드 차트에서 사용 가능

---

## 2. Admin 인증 — 환경별 조건부 처리

### 현재 구조 (변경 불필요, 이미 올바르게 작동)
- `JwtAuthGuard` 내부에서 `NODE_ENV !== 'production'`일 때 mock admin 유저 자동 주입
- `AdminController`는 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('ADMIN')` 적용
- **Development**: 인증 자동 bypass → mock admin (`dev-admin`, `ADMIN` 역할) 주입
- **Production**: 실제 JWT 토큰 + ADMIN 역할 필수
- 관련 파일에 명확한 한국어 주석 추가

### 관련 파일
- `backend/src/modules/auth/guards/jwt-auth.guard.ts` — 핵심 bypass 로직
- `backend/src/modules/admin/admin.controller.ts` — 가드 적용 + 주석 개선

---

## 3. UI 대폭 개선

### 🎨 디자인 시스템
- **메인 컬러**: Hot Pink (#FF007A) + Purple (#7928CA) + Orange (#FF4500) 그라디언트
- **다크 모드**: #0A0A0A (primary-black), #1A1A1A (content-bg)
- **라이트 모드**: 화이트 베이스, 따뜻한 그레이 톤
- **Glass Morphism**: 반투명 배경 + backdrop-blur

### 🏠 홈 페이지 (`src/app/page.tsx`)

#### 개선 사항
- **히어로 섹션 임팩트 강화**
  - 멀티 레이어 그라디언트 배경 (pink → purple → orange)
  - Floating orbs 효과 (blur + pulse 애니메이션)
  - 히어로 텍스트: "라이브로 만나는 특별한 쇼핑 ✨" — 그라디언트 텍스트
  - 브랜드 로고에 glow 애니메이션 (`animate-hero-glow`)
  - 입장 애니메이션 (opacity + translateY transition)

- **상품 카드 그림자/호버 강화**
  - `card-magazine` 클래스: 호버 시 translateY(-8px) + scale(1.02)
  - 호버 시 20px 그림자 + pink glow
  - Quick-add 버튼 슬라이드업 효과

- **카테고리 필터 그라디언트**
  - 활성: pink → purple 그라디언트 배경
  - 비활성: hover 시 pink 배경 틴트

- **Weekly Pick 배너**
  - 3색 그라디언트 (pink → purple → orange)
  - 데코 원형 + blur 오버레이
  - hero-glow 애니메이션

### 🛒 상품 목록 (`src/app/shop/page.tsx`)

#### 개선 사항
- **2열 매거진 카드 레이아웃** (모바일), 4열 (데스크톱)
- **SALE / NEW 뱃지 강화**
  - NEW: `✨ NEW` — purple → pink 그라디언트
  - SALE: `🔥 -30%` — red → orange 그라디언트
- **필터 탭**: 아이콘 + 그라디언트 활성 상태
- **필터 초기화 버튼**: 핑크 테두리 뱃지
- **Stagger 애니메이션**: 각 카드 60ms 간격 순차 등장
- **Glass morphism 장바구니 버튼**: pulse 뱃지
- **가격 강조**: 할인율 빨간 볼드 + 할인가 핑크 볼드

### 📺 라이브 화면 (`src/app/live/[streamKey]/page.tsx`)

#### 인스타 라이브 느낌 구현
- **세로 풀스크린** (9:16 비율, 데스크톱에서 최대 480px)
- **강화된 그라디언트 오버레이**
  - 상단: black/70 → transparent (40px 높이)
  - 하단: black/90 → transparent (56px 높이)
- **LIVE 뱃지 + 시청자 수**
  - LIVE: 빨간 뱃지 + red glow (20px)
  - 시청자: 증가 시 pulse 효과 (scale + pink tint)
- **스트림 제목**: pink text-glow 효과
- **뒤로가기/공유 버튼**: glass morphism + white border

#### 🛒 장바구니 실시간 피드 (`CartActivityFeed`)
- **toast-in / toast-out 애니메이션**
  - 입장: translateY(40px) → 0 + scale(0.95→1)
  - 퇴장 (5초 후): translateY(0→-20px) + fade out
- **유저 아바타**: 유저 컬러 그라디언트 + glow shadow
- **Glass morphism 배경**: blur(16px) + 유저 컬러 테두리 tint
- **텍스트**: `OOO님이 [상품명] 담았어요! 🛒`

#### ❤️ 하트 애니메이션 (`HeartAnimation`)
- **다양한 이모지**: ❤️ 💖 💗 💕 🩷 💜 🧡 (7종)
- **확장된 컬러 팔레트**: 8종 (pink, purple, orange 계열)
- **탭 → 3연발 burst**: 80ms 간격 3개 동시 생성
- **하트 버튼**: pink → orange 그라디언트 + glow shadow
- **Float 애니메이션**: wobble(회전) + size variation

---

## 4. 장바구니 실시간 표시 (검증)

### 백엔드 (이미 완벽 구현됨)
- `CartService.addToCart()` → `EventEmitter.emit('cart:added', { ... })`
- `WebsocketGateway.handleCartItemAdded()` → `cart:item-added` 브로드캐스트
- **유저 컬러**: 16색 팔레트에서 userId 해시 기반 선택
- **데이터**: userId, userName, userColor, productName, quantity, streamKey

### 프론트엔드 (이미 구현 + 개선)
- `useCartActivity` 훅: WebSocket `cart:item-added` 이벤트 수신
- `CartActivityFeed`: 실시간 토스트 표시
- **이번 개선**: 
  - fade-in/fade-out 애니메이션 추가
  - glass morphism 배경
  - 유저 아바타 glow 효과
  - 5초 후 부드러운 fade-out

---

## 5. 추가된 CSS 애니메이션

| 애니메이션 | 용도 |
|-----------|------|
| `animate-cart-toast-in` | 장바구니 토스트 입장 |
| `animate-cart-toast-out` | 장바구니 토스트 퇴장 |
| `animate-hero-glow` | 히어로 섹션 글로우 |
| `animate-bounce-in` | 에러/빈 상태 등장 |
| `animate-stagger-fade` | 카드 순차 등장 |
| `.glass` / `.glass-light` | Glass morphism |
| `.text-glow-pink` | 핑크 텍스트 글로우 |
| `.neon-border` | 네온 테두리 |
| `.card-magazine` | 매거진 카드 호버 |

---

## 📸 스크린샷

| 화면 | 파일 |
|------|------|
| 홈 (데스크톱) | `docs/screenshots/v2/01-home-page.jpg` |
| 상품 목록 (데스크톱) | `docs/screenshots/v2/02-shop-page.png` |
| 라이브 에러 화면 | `docs/screenshots/v2/03-live-error-page.png` |
| 홈 (모바일) | `docs/screenshots/v2/04-home-mobile.jpg` |

> 라이브 화면의 실제 스트리밍 UI는 백엔드에 LIVE 상태 스트림이 있어야 표시됩니다.
> 에러 화면에서도 그라디언트 버튼, glass morphism 등 개선된 스타일을 확인할 수 있습니다.

---

## 🔧 기술 스택

- **프레임워크**: Next.js 16.1.6 (Turbopack) + NestJS
- **스타일링**: Tailwind CSS + CSS Variables + 커스텀 키프레임
- **차트**: recharts (신규 설치)
- **실시간**: Socket.IO (WebSocket) + EventEmitter2
- **DB**: PostgreSQL + Prisma + Redis

---

## 📝 참고사항

- 커밋 없음 (요청 사항)
- 모든 변경은 기존 코드 구조를 유지하면서 진행
- 라이트/다크 모드 모두 지원
- 모바일 퍼스트 반응형 디자인
