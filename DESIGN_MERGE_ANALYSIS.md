# Live Commerce Fashion Platform → Dorami 디자인 병합 분석

**작성일**: 2026-02-28
**분석 대상**: `Live Commerce Fashion Platform` (Figma 연동 프로젝트)

---

## 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [현황 비교](#현황-비교)
3. [병합 가능 영역](#병합-가능-영역)
4. [병합 불가/신중 영역](#병합-불가신중-영역)
5. [권장 병합 로드맵](#권장-병합-로드맵)
6. [상세 분석](#상세-분석)

---

## 프로젝트 개요

### Live Commerce Fashion Platform (소스)

- **프레임워크**: React 18.3.1 + Vite 6.3.5
- **UI 라이브러리**: Radix UI (46개 컴포넌트) + Material UI 7.3.5 혼합
- **스타일링**: TailwindCSS 4.1.12
- **아이콘**: Lucide React
- **상태관리**: 문서만 있음 (Zustand/React Query 권장)
- **문서**: 매우 상세함 (API 스펙, 데이터 구조, 상태 정의, 페이지 플로우)
- **컴포넌트**: 46개 UI 컴포넌트 (Radix UI) + Material UI + 9개 홈페이지 전용 컴포넌트

### Dorami (대상)

- **프레임워크**: NestJS (백엔드) + Next.js 16 (프론트엔드, React 19)
- **UI 라이브러리**: Radix UI/Material UI 미사용, 자체 구현 컴포넌트 사용
- **아이콘**: Lucide React (0.563.0) 사용 중
- **스타일링**: TailwindCSS 4.0
- **상태관리**: Zustand + TanStack Query v5 (이미 사용 중)
- **문서**: 기본 구조만 있음
- **컴포넌트**: 자체 구현 (admin, cart, chat 등)

---

## 현황 비교

| 항목                   | Live Commerce                        | Dorami                     |
| ---------------------- | ------------------------------------ | -------------------------- |
| **의존성 기초**        | Radix UI + Material UI + TailwindCSS | Lucide React + TailwindCSS |
| **UI 컴포넌트 시스템** | 46+ 완성 (Radix UI)                  | 자체 구현 (확장 필요)      |
| **API 명세서**         | 매우 상세                            | 기본 수준                  |
| **데이터 타입**        | 완전히 정의됨                        | 부분적                     |
| **상태 관리**          | 상세 설계만 있음                     | 구현됨                     |
| **페이지 플로우**      | 다이어그램 포함                      | 없음                       |
| **Admin 페이지**       | 10+ 페이지                           | 3~4개                      |
| **모바일 고려**        | 문서에만 명시                        | 구현됨                     |

---

## 병합 가능 영역

### 1️⃣ **UI 컴포넌트 시스템** ⭐⭐⭐⭐⭐

**난이도**: 중간 | **우선순위**: 최고 | **작업량**: 2-3주

**가능한 것**:

- Radix UI 모든 50+ 컴포넌트를 `client-app/src/components/ui/` 로 복사
- 현재 Dorami는 UI 컴포넌트가 없으므로 즉시 적용 가능
- 기존 Tailwind 4.0과 호환 가능 (Radix UI는 스타일링 불가지론)

**주의사항**:

```
Dorami는 이미 custom 컴포넌트를 사용중일 수 있음:
- 확인: client-app/src/components/ 에 기존 Button, Input 등이 있는지 확인
- 있다면: 충돌 가능 → 선택적 통합 또는 기존 것 유지
- 없다면: 전체 Radix UI 세트 복사 가능
```

**병합 전략**:

```bash
# 1. Radix UI 컴포넌트 복사
cp -r "Live Commerce"/src/app/components/ui/* \
  client-app/src/components/ui/

# 2. 의존성 추가 (package.json에 이미 있는지 확인)
npm install @radix-ui/react-* @emotion/react @emotion/styled
```

---

### 2️⃣ **홈페이지 컴포넌트** ⭐⭐⭐⭐

**난이도**: 낮음-중간 | **우선순위**: 높음 | **작업량**: 1-2주

**가능한 것**:

- `Header.tsx` — 공통 헤더 (검색, 알림, 마이페이지)
- `Footer.tsx` — 공통 푸터
- `LiveBanner.tsx` — 현재 라이브 방송 배너
- `LiveExclusiveDeals.tsx` — 라이브 특가 상품
- `UpcomingLives.tsx` — 예정된 라이브 (캐러셀)
- `PopularProducts.tsx` — 인기 상품
- `ProductDetailModal.tsx` — 상품 상세 모달
- `HostCuration.tsx` / `EventBanner.tsx` — 추가 섹션들

**Dorami와의 차이**:

```
Live Commerce:      Vite + React Router 기반
Dorami:             Next.js 16 App Router 기반

→ 컴포넌트 로직은 그대로 사용, 라우팅 부분만 Next.js에 맞게 수정
```

**병합 전략**:

```
1. 컴포넌트 로직 100% 복사 가능
2. Props 인터페이스 그대로 사용 가능
3. API 호출만 Dorami의 API client 방식으로 변경
4. 라우팅 (Link, navigate) → Next.js Link 컴포넌트로 수정
```

---

### 3️⃣ **API 명세서 & 타입 정의** ⭐⭐⭐⭐

**난이도**: 중간 | **우선순위**: 높음 | **작업량**: 1-2주

⚠️ **주의**: Live Commerce API 경로는 Dorami와 **불일치**합니다.

**Live Commerce 명세** vs **Dorami 실제 경로**:

- ❌ `GET /api/live/current` → ✅ `GET /api/streaming/active`
- ❌ `GET /api/live/deals` → ✅ `GET /api/products?streamKey=...` 또는 `GET /api/products/featured`
- ✅ `GET /api/live/upcoming` → ✅ `GET /api/streaming/upcoming`
- ❌ `GET /api/products/popular` → ✅ `GET /api/products/featured`
- ✅ `GET /api/products/{productId}` → ✅ `GET /api/products/:id`
- ⚠️ `POST /api/live/notifications/{liveId}` → ❓ Dorami 구현 상태 미확인
- ❌ `POST /api/products/{productId}/like` → ❌ **Dorami에 미구현**

**필요한 작업**:

1. Live Commerce 명세를 참고용으로만 사용
2. Dorami의 기존 API 경로에 맞게 컴포넌트 연결
3. 미구현 기능 (찜하기, 알림) 구현 필요

- 데이터 타입 정의 (`main-home-data-structure.md`)
  ```typescript
  - LiveStream, LiveDeal, Product, Host
  - ProductSize, ProductColor, DeliveryInfo
  - 모든 API 응답 타입
  ```

**Dorami와의 호환성**:

- Dorami는 `packages/shared-types/` 에 공유 타입이 있음
- Live Commerce의 타입들을 `shared-types` 에 추가 가능
- 백엔드 API 응답 구조가 이미 정의되어 있으므로 참고하여 타입만 추가

**병합 전략**:

```
1. Dorami shared-types의 기존 타입 확인 (StreamStatus, ProductStatus 등)
2. Live Commerce의 타입을 비교하여 필드 추가/변경
3. 기존 타입이 있으면 필드 추가, 없으면 신규 추가
4. API 응답 구조가 다를 수 있으므로 백엔드 DTO도 함께 검토
```

---

### 4️⃣ **페이지 플로우 & 상태 관리 설계** ⭐⭐⭐⭐

**난이도**: 낮음 | **우선순위**: 높음 | **작업량**: 3-5일

**가능한 것**:

- `main-home-page-flow.md` — 사용자 플로우 다이어그램
  - 페이지 초기 로딩
  - 라이브 입장 플로우
  - 상품 구매 플로우
  - 알림 설정 플로우
  - 찜하기 플로우
  - 모달 관리 플로우
  - 에러 처리 플로우

- `main-home-state-definition.md` — 전역 상태 구조
  ```typescript
  - currentLive (라이브 정보 + 로딩)
  - liveDeals (특가 상품 + 타이머)
  - upcomingLives (예정 방송)
  - popularProducts (인기 상품)
  - modals, toasts, likedProducts, etc.
  ```

**Dorami와의 호환성**:

- Dorami는 이미 Zustand + TanStack Query를 사용 중
- Live Commerce의 상태 설계를 참고하여 Dorami 상태 구조 확장 가능
- 캐싱 정책, 에러 처리, 실시간 업데이트 전략 그대로 적용 가능

**병합 전략**:

```
1. Dorami의 기존 store 확인 (lib/store/)
2. Live Commerce의 상태 구조를 Dorami 스타일로 변환
3. TanStack Query와 Zustand의 조합으로 구현
```

---

### 5️⃣ **Admin 페이지 레이아웃** ⭐⭐⭐

**난이도**: 중간 | **우선순위**: 중간 | **작업량**: 2-3주

**가능한 것**:

- AdminLayout (Sidebar + Header)
- DashboardPage — 대시보드
- LiveManagementPage — 라이브 관리
- ProductManagementPage — 상품 관리
- OrderManagementPage — 주문 관리
- AnalyticsPage — 분석 페이지
- SettingsPage — 설정

**Dorami와의 차이**:

```
Live Commerce:      완성도 높은 UI 디자인 제공
Dorami:             기본 Admin 페이지만 존재

→ Live Commerce의 레이아웃 & 구조를 참고하여 개선 가능
```

**병합 전략**:

```
1. Dorami의 backend/src/modules/admin/ 확인
2. Live Commerce Admin UI 컴포넌트를 frontend에 맞게 적용
3. 테이블, 차트, 필터 UI 참고
```

---

## 병합 불가/신중 영역

### 🔴 **백엔드 & 데이터베이스 — 통합 불가능**

⚠️ **중요**: Live Commerce와 Dorami는 **완전히 다른 DB 스키마와 백엔드 구조**를 가지고 있습니다.

**근본적인 차이**:

| 항목            | Live Commerce                | Dorami                    | 호환성         |
| --------------- | ---------------------------- | ------------------------- | -------------- |
| **DB 구현**     | ❌ 없음 (문서만)             | ✅ PostgreSQL 16 + Prisma | 불가능         |
| **ID 타입**     | number                       | UUID string               | 🔴 불가능      |
| **라이브 상태** | 'live'\|'scheduled'\|'ended' | PENDING\|LIVE\|OFFLINE    | 🔴 완전 다름   |
| **가격 모델**   | 3가지 (정가/현재/특가)       | 1가지 (price)             | 🔴 재설계 필요 |
| **평점/리뷰**   | rating, reviewCount          | ❌ 미구현                 | 🔴 추가 필요   |
| **찜하기**      | Product.isLiked              | ❌ 미구현                 | 🔴 추가 필요   |
| **백엔드**      | ❌ 없음                      | ✅ NestJS 17개 모듈       | 불가능         |

**결론**: ❌ **Live Commerce 스키마를 Dorami에 직접 적용 불가능**

→ 권장: Dorami 기존 스키마 유지하면서 필요한 기능만 추가 구현

**상세 분석**: `DB_BACKEND_COMPARISON_ANALYSIS.md` 참고

---

### ❌ **프론트엔드 — 직접 복사 불가**

| 항목              | 이유                                                               |
| ----------------- | ------------------------------------------------------------------ |
| **의존성**        | `@emotion/react`, `@emotion/styled` 추가 필요 (이미 Tailwind 있음) |
| **라우팅**        | `react-router` → `Next.js` 페이지 라우팅으로 변경 필요             |
| **상태관리 구현** | Live Commerce는 문서만 있음 (구현 없음)                            |
| **빌드 설정**     | `vite.config.ts` → `next.config.ts`                                |
| **패키지 구조**   | npm workspaces → npm workspaces (동일하지만 경로 다름)             |

### ⚠️ **프론트엔드 신중한 병합**

**1. UI 컴포넌트 라이브러리 추가**

```
현재: TailwindCSS만 사용
추가: Radix UI 46개 컴포넌트 (필요한 것만)

위험: 번들 사이즈 증가 (~50KB gzip)
권장: 필요한 것만 선택적으로 추가 (전체 복사 X)
```

**2. 의존성 호환성**

```
Live Commerce:
- React 18.3.1 (Dorami: React 19) ← 호환
- TailwindCSS 4.1.12 (Dorami: 4.0) ← 호환
- Radix UI 최신 (호환성 확인 필요)
- Material UI (추가 선택사항)

→ peer dependency 충돌 검토 필수
```

**3. API 스펙 변경**

```
Live Commerce의 API 명세:
  GET /api/live/current
  GET /api/live/deals
  GET /api/products/popular

Dorami의 실제 API:
  GET /api/streaming/active ✅
  GET /api/products/featured ✅
  GET /api/products?streamKey=... ✅

→ 컴포넌트 수정 필요 (API 경로 맞춤)
```

**4. 백엔드 API 응답 구조**

```
Live Commerce (예상):
{
  "success": true,
  "data": { ... }
}

Dorami (실제):
{
  "data": { ... },
  "success": true,
  "timestamp": "2026-02-28T12:00:00Z"
}

→ 어댑터 또는 API 클라이언트 수정 필요
```

---

## 권장 병합 로드맵

### Phase 0: 사전 검토 (3-5일) ⚠️ **필수**

- [ ] Dorami API 경로 상세 문서화 (스트리밍, 상품, 알림)
- [ ] 찜하기, 알림 기능 구현 여부 확인
- [ ] 홈페이지 레이아웃 아키텍처 파악
- [ ] 번들 사이즈 측정 기준선 수립

### Phase 1: 의존성 & UI 컴포넌트 준비 (1주)

- [ ] Radix UI 선택적 설치 (모든 컴포넌트 필요 시에만)
- [ ] Material UI 포함 여부 결정
- [ ] 46개 UI 컴포넌트 선택적 복사 (필요한 것만)
- [ ] 의존성 호환성 테스트 (Lucide React와의 중복 검토)
- [ ] 빌드 및 번들 사이즈 확인

### Phase 2: 홈페이지 UI 통합 (3주) ⬆️ **수정됨**

- [ ] Live Commerce 컴포넌트 구조 분석
- [ ] Next.js 페이지 레이아웃으로 변환
- [ ] **Dorami API 경로에 맞게 수정** (중요)
  - `/api/live/*` → `/api/streaming/*`
  - `/api/products/popular` → `/api/products/featured`
- [ ] Zustand + TanStack Query로 데이터 연결
- [ ] 스타일 일관성 확인
- [ ] 반응형 디자인 테스트

### Phase 3: 타입 & 상태 통합 (1주)

- [ ] API 타입 shared-types에 추가
- [ ] Zustand 상태 구조 확장
- [ ] TanStack Query 훅 작성
- [ ] 캐싱 정책 구현

### Phase 4: Admin 페이지 개선 (2-3주)

- [ ] Live Commerce Admin UI 참고
- [ ] Dorami Admin 페이지 디자인 개선
- [ ] 테이블, 차트, 필터 UI 추가

### Phase 5: 검증 & 최적화 (1주)

- [ ] 성능 테스트
- [ ] 번들 사이즈 최적화
- [ ] E2E 테스트
- [ ] 프로덕션 배포

---

## 상세 분석

### API 명세서 비교

**Live Commerce API**:

```typescript
GET / api / live / current; // 현재 라이브 정보
GET / api / live / deals; // 라이브 특가 상품
GET / api / live / upcoming; // 예정된 라이브
GET / api / products / popular; // 인기 상품
GET / api / products / { id }; // 상품 상세
POST / api / live / notifications; // 알림 설정
POST / api / products / { id } / like; // 찜하기
```

**Dorami 기존 API**:

```typescript
확인 필요: backend/src/modules/
- streaming/* — 라이브 스트리밍 관련
- products/* — 상품 관련
- notifications/* — 알림 관련
- users/* — 사용자 관련
```

**병합 액션**:

1. Dorami 백엔드 API 경로 확인
2. 일치하지 않는 경로는 통일
3. 응답 형식이 다르면 어댑터 작성

---

### 데이터 타입 분석

**LiveStream 타입**:

```typescript
// Live Commerce
interface LiveStream {
  id: number;
  title: string;
  status: 'live' | 'scheduled' | 'ended';
  thumbnail: string;
  hostId: number;
  startTime: string;
  viewers: number;
  peakViewers: number;
  streamUrl?: string;
  chatEnabled: boolean;
}

// Dorami (확인 필요)
// backend/src/modules/streaming/dto/streaming.dto.ts
```

**권장**:

- Dorami의 기존 `LiveStream` 타입 확인
- 필드 추가/삭제로 통일
- shared-types에 정의

---

### 상태 관리 비교

**Live Commerce (설계)**:

```typescript
// Zustand store 구조 (구현 없음)
useMainPageStore = {
  currentLive: { data, isLoading, error },
  liveDeals: { data, isLoading, error },
  upcomingLives: { data, isLoading, error },
  popularProducts: { data, isLoading, error },
  modals: { productDetail, viewAll },
  ...
}
```

**Dorami (현재)**:

```typescript
// client-app/src/lib/store/auth.ts (Zustand)
// client-app/src/lib/hooks/queries/ (TanStack Query)
```

**권장**:

1. 기존 Dorami store 구조 유지
2. Live Commerce의 상태 필드를 필요한 것만 추가
3. TanStack Query로 서버 상태 관리
4. Zustand로 UI 상태만 관리

---

### UI 컴포넌트 시스템 분석

**Live Commerce Radix UI 컴포넌트** (50+):

```
Accordion, AlertDialog, Avatar, Badge, Button, Calendar,
Card, Carousel, Checkbox, Collapsible, Command, ContextMenu,
Dialog, Drawer, DropdownMenu, Form, HoverCard, Input,
InputOTP, Label, Menubar, NavigationMenu, Pagination, Popover,
Progress, RadioGroup, Resizable, ScrollArea, Select, Separator,
Sheet, Sidebar, Skeleton, Slider, Switch, Table, Tabs,
Textarea, Toggle, ToggleGroup, Tooltip
```

**Dorami 현재**:

- Lucide React 아이콘 사용 중
- 자체 구현한 컴포넌트 (admin, cart, chat 등)
- Radix UI / Material UI 미사용

**권장** (실제 필요성 검토 필수):

```
1. 필요한 컴포넌트만 선택적으로 복사
2. Dorami 기존 컴포넌트와 기능 중복 검토
3. 충돌나는 것은 접두사 추가 (e.g., RadixButton) 또는 기존 것 유지
4. 점진적으로 마이그레이션 (전체 교체 권장하지 않음)
5. Material UI는 필요한 경우에만 추가 (번들 사이즈 증가 주의)
```

---

## 최종 권장사항

### ✅ 꼭 해야 할 것

1. ⚠️ **Phase 0 실행 필수** — API 경로, 기능 구현 상태 사전 확인
2. **홈페이지 컴포넌트 논리** 참고 — 사용자 플로우 이해
3. **타입 정의** 확인 후 추가 — 기존 Dorami 타입과 비교
4. **페이지 플로우 다이어그램** 참고 — 사용자 경험 설계

### 🤔 선택적으로 할 것

1. **Radix UI 컴포넌트** 추가 — 필요한 것만 선택적으로
2. Admin 페이지 UI 개선 — 낮은 우선순위
3. **Material UI** 추가 — 번들 사이즈 영향 검토 후 결정

### ⚠️ 피해야 할 것

1. ❌ **API 경로 직접 복사** — 적응 필요 (`/api/live/*` → `/api/streaming/*`)
2. ❌ **모든 컴포넌트 복사** — 필요한 것만 선택적으로
3. 의존성 충돌 — 호환성 테스트 먼저
4. 기존 코드 파괴 — 선택적 통합으로 진행

---

## 다음 단계

### 1️⃣ **Phase 0 실행 (사전 검토) — 3-5일**

- [ ] Dorami의 기존 UI 컴포넌트 구조 확인 (admin, cart, chat)
- [ ] 백엔드 API 경로 상세 문서화 (streaming, products, users)
- [ ] 찜하기 (`POST /api/products/{id}/like`) 구현 상태 확인
- [ ] 알림 기능 (`POST /api/live/notifications/`) 구현 상태 확인
- [ ] 홈페이지 페이지 구조 파악 (현재 구현 상태)
- [ ] 번들 사이즈 기준선 측정

### 2️⃣ **계획 수립**

- [ ] Phase 1 시작 일정 결정
- [ ] 팀원과 병합 전략 논의 (필수 컴포넌트 선정)
- [ ] 테스트 계획 수립
- [ ] 통합 테스트 기준 정의

### 3️⃣ **실행**

- [ ] 로드맵 Phase 0 (DB 설계) 먼저 실행
- [ ] 로드맵 Phase 1부터 시작
- [ ] **Phase 0 검토 사항을 반영하여 Phase 2 계획 수정**
- [ ] 각 단계별 검증 및 테스트
- [ ] 번들 사이즈 모니터링
- [ ] 문제 발생 시 즉시 조정

---

## 백엔드 & 데이터베이스 마이그레이션 계획

### ⚠️ **중요: DB 통합은 별도 프로젝트**

DESIGN_MERGE_ANALYSIS.md는 **프론트엔드 UI 통합**을 다루고 있습니다.
**백엔드 & DB 통합**은 별도의 복잡한 프로젝트로, 상세 분석은 `DB_BACKEND_COMPARISON_ANALYSIS.md` 참고.

### 권장 순서

#### Phase A: UI 통합 (4-6주)

1. Live Commerce 홈페이지 컴포넌트 적응
2. Dorami API와 연결
3. 테스트 & 배포

#### Phase B: 데이터베이스 확장 (7-9주)

1. Prisma 스키마 확장
   - `livePrice` 필드 추가 (라이브 특가)
   - `discount` 계산 필드 추가
   - UserLike 테이블 추가 (찜하기)
   - ProductRating 테이블 추가 (평점/리뷰)

2. 백엔드 API 확장
   - `POST /api/products/{id}/like` (찜하기)
   - `POST /api/products/{id}/ratings` (평점)
   - `GET /api/products/{id}` 응답 수정 (rating 포함)

3. 테스트 & 배포

**총 기간**: UI(4-6주) + DB(7-9주) = **11-15주**

**상세 계획**: `DB_BACKEND_COMPARISON_ANALYSIS.md`의 "마이그레이션 계획" 섹션 참고

---

**분석 완료**: 2026-02-28
**문서 파일**: `DESIGN_MERGE_ANALYSIS.md`
