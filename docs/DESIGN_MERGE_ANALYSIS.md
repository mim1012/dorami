# Live Commerce Fashion Platform → Doremi 디자인 병합 분석

**작성일**: 2026-02-28
**분석 대상**: `Live Commerce Fashion Platform` (Figma 연동 프로젝트)

---

## 핵심 요약

### 👍 병합 추천 영역 (우선순위)

| 순위 | 항목                                         | 난이도 | 효과       | 작업량 |
| ---- | -------------------------------------------- | ------ | ---------- | ------ |
| 1️⃣   | **UI 컴포넌트 시스템** (Radix UI 50+)        | 중간   | ⭐⭐⭐⭐⭐ | 2-3주  |
| 2️⃣   | **홈페이지 컴포넌트** (Header, Banner, 모달) | 낮음   | ⭐⭐⭐⭐   | 1-2주  |
| 3️⃣   | **API 명세서 & 타입**                        | 낮음   | ⭐⭐⭐⭐   | 1주    |
| 4️⃣   | **상태관리 & 페이지 플로우**                 | 낮음   | ⭐⭐⭐⭐   | 1주    |
| 5️⃣   | **Admin 페이지 레이아웃**                    | 중간   | ⭐⭐⭐     | 2-3주  |

---

## 프로젝트 비교

### Live Commerce Fashion Platform (소스)

```
프레임워크:      React 18.3.1 + Vite
UI 라이브러리:   Radix UI (50+ 컴포넌트)
스타일링:        TailwindCSS 4.1.12
상태관리:        문서 (Zustand/React Query 권장 구조)
라우팅:          React Router
문서:            ✅ 매우 상세 (API, 타입, 상태, 플로우)
```

### Doremi (대상)

```
프레임워크:      NestJS (backend) + Next.js 16 (frontend)
UI 라이브러리:   없음 (자체 구현)
스타일링:        TailwindCSS 4.0
상태관리:        ✅ Zustand + TanStack Query v5
라우팅:          ✅ Next.js App Router
문서:            기본 수준
```

---

## 병합 가능 영역 상세 분석

### 1️⃣ UI 컴포넌트 시스템 ⭐⭐⭐⭐⭐

**What to Get**:

- 50+ Radix UI 컴포넌트 (Button, Input, Dialog, Tabs, Card, etc.)
- 모두 Tailwind CSS로 스타일링됨
- TypeScript 타입 완벽

**Path**:

```
Live Commerce/src/app/components/ui/*
  ↓
Doremi/client-app/src/components/ui/
```

**주의**:

```
✅ 가능: TailwindCSS 4.0과 호환 (4.1.12와 거의 동일)
✅ 가능: Doremi에 UI 컴포넌트 없으면 직접 복사
⚠️  주의: 기존 Button, Input 등이 있으면 충돌 체크
```

**예상 이득**:

- 개발 속도 30-40% 향상
- 디자인 일관성 보장
- 테스트된 컴포넌트 사용

---

### 2️⃣ 홈페이지 컴포넌트 ⭐⭐⭐⭐

**What to Get**:

```
Header.tsx                 — 공통 헤더
Footer.tsx                 — 공통 푸터
LiveBanner.tsx             — 라이브 배너 (Hero)
LiveExclusiveDeals.tsx     — 특가 상품 섹션
UpcomingLives.tsx          — 예정 방송 (캐러셀)
PopularProducts.tsx        — 인기 상품
ProductDetailModal.tsx     — 상품 상세 모달
HostCuration.tsx           — 호스트 큐레이션
EventBanner.tsx            — 이벤트 배너
NewProducts.tsx            — 신상품
```

**Path**:

```
Live Commerce/src/app/components/*
  ↓
Doremi/client-app/src/components/ (Next.js 맞게 수정)
```

**변환 필요**:

1. **라우팅**: `react-router` → `next/link`

   ```typescript
   // Before
   import { useNavigate } from 'react-router';
   navigate(`/products/${id}`);

   // After
   import Link from 'next/link';
   <Link href={`/products/${id}`}>Product</Link>
   ```

2. **API 호출**: Doremi의 API client 방식으로 통일

   ```typescript
   // Doremi 방식
   import { api } from '@/lib/api/client';
   const response = await api.get('/api/live/current');
   ```

3. **Props 인터페이스**: 그대로 사용 가능

**예상 이득**:

- 홈페이지 4-6주 → 1-2주로 단축
- 기하학적 섹션 배치 참고 가능

---

### 3️⃣ API 명세서 & 타입 정의 ⭐⭐⭐⭐

**What to Get**:

#### API 명세 (main-home-api-spec.md):

```
GET /api/live/current              — 현재 라이브
GET /api/live/deals?liveId=123     — 특가 상품
GET /api/live/upcoming?limit=6     — 예정 라이브
GET /api/products/popular          — 인기 상품
GET /api/products/{id}             — 상품 상세
POST /api/live/notifications       — 알림 설정
POST /api/products/{id}/like       — 찜하기
```

#### 타입 정의 (main-home-data-structure.md):

```typescript
interface LiveStream {
  id: number;
  title: string;
  status: 'live' | 'scheduled' | 'ended';
  thumbnail: string;
  hostId: number;
  viewers: number;
  peakViewers: number;
  streamUrl?: string;
  chatEnabled: boolean;
}

interface Product {
  id: number;
  name: string;
  originalPrice: number;
  currentPrice: number;
  livePrice?: number;
  discount: number;
  image: string;
  stock: number;
  isAvailable: boolean;
  sizes?: ProductSize[];
  colors?: ProductColor[];
  deliveryInfo?: DeliveryInfo;
}

// ... 10+ 더 있음
```

**적용 방법**:

1. **Doremi 기존 API 경로 확인**

   ```
   backend/src/modules/streaming/
   backend/src/modules/products/
   backend/src/modules/notifications/
   ```

2. **경로 일치 확인**

   ```
   Live Commerce: GET /api/live/current
   Doremi:        GET /api/streaming/{streamKey} (?)

   → 경로 통일 필요
   ```

3. **타입 추가**
   ```
   packages/shared-types/
     → types/live-commerce.ts 신규 생성
     → 모든 Live Commerce 타입 정의
   ```

**예상 이득**:

- 타입 안전성 강화
- API 문서화 완료
- 백엔드 개발 시 참고 가능

---

### 4️⃣ 상태관리 & 페이지 플로우 ⭐⭐⭐⭐

**What to Get**:

#### 상태 구조 (main-home-state-definition.md):

```typescript
interface MainPageState {
  // 라이브 정보
  currentLive: {
    data: LiveStream | null;
    isLoading: boolean;
    error: string | null;
  };

  // 특가 상품
  liveDeals: {
    data: LiveDeal[];
    isLoading: boolean;
    dealEndTime: string | null;
  };

  // 예정 라이브
  upcomingLives: {
    data: LiveStream[];
    totalCount: number;
    hasMore: boolean;
  };

  // UI 상태
  modals: {
    productDetail: boolean;
    viewAll: boolean;
  };

  // 사용자 상호작용
  likedProducts: Set<number>;
  notifiedLives: Set<number>;

  // 타이머
  dealTimer: {
    hours: number;
    minutes: number;
    seconds: number;
  };
}
```

#### 페이지 플로우 (main-home-page-flow.md):

```
초기 로딩 → 병렬 API 호출 → 섹션 렌더링 → 사용자 상호작용
  ↓
사용자 경로:
  1. 라이브 입장
  2. 특가 상품 구매
  3. 알림 설정
  4. 찜하기
```

**Doremi 통합 방법**:

```typescript
// 1. Zustand store 확장
export const useMainPageStore = create<MainPageState>((set) => ({
  currentLive: { data: null, isLoading: false, error: null },
  liveDeals: { data: [], isLoading: false, dealEndTime: null },
  // ... 나머지 상태
}));

// 2. TanStack Query 훅
export const useCurrentLive = () =>
  useQuery({
    queryKey: ['currentLive'],
    queryFn: () => api.get('/api/live/current'),
    staleTime: 60 * 1000,
    refetchInterval: 30 * 1000,
  });

// 3. 컴포넌트에서 사용
function HomePage() {
  const { data: currentLive, isLoading } = useCurrentLive();
  const { openModal } = useMainPageStore();
  // ...
}
```

**예상 이득**:

- 상태 관리 체계화
- 캐싱 전략 명확화
- 실시간 업데이트 구조 파악

---

### 5️⃣ Admin 페이지 레이아웃 ⭐⭐⭐

**What to Get**:

```
AdminLayout.tsx            — 사이드바 + 헤더
DashboardPage.tsx          — 대시보드
LiveManagementPage.tsx     — 라이브 관리
ProductManagementPage.tsx  — 상품 관리
OrderManagementPage.tsx    — 주문 관리
AnalyticsPage.tsx          — 분석
```

**Doremi와의 비교**:

```
Live Commerce: 완성도 높은 UI
Doremi:        backend/src/modules/admin/ (기본)

→ UI를 현대화할 수 있음
```

**작업량**: 2-3주 (낮은 우선순위)

---

## 🚨 주의사항

### 의존성 호환성

```
Live Commerce 추가 필요:
  @radix-ui/react-* (모든 Radix UI 컴포넌트)
  @emotion/react, @emotion/styled
  cmdk, embla-carousel-react, input-otp

Doremi 기존:
  React 19 (Live Commerce: 18.3.1)
  TailwindCSS 4.0 (Live Commerce: 4.1.12)

→ Peer dependency 충돌 가능성
  해결: npm ls로 확인 후 필요시 버전 조정
```

### 라우팅 변환

```
❌ Live Commerce:
import { useNavigate } from 'react-router';
navigate(`/live/${id}`);

✅ Doremi (Next.js):
import Link from 'next/link';
<Link href={`/live/${id}`}>Join</Link>
```

### API 경로 일치

```
Live Commerce API:
  GET /api/live/current
  GET /api/products/{id}

Doremi 기존 API:
  GET /api/streaming/current? (확인 필요)

→ 백엔드 API 경로 통일 필수
```

---

## 🗓️ 권장 병합 로드맵

### Phase 1: 기초 준비 (1주)

- [ ] Radix UI 의존성 추가
- [ ] 호환성 테스트 (React 19, TailwindCSS 4.0)
- [ ] 번들 사이즈 확인
- [ ] UI 컴포넌트 복사

### Phase 2: 홈페이지 UI (2주)

- [ ] 컴포넌트 복사 및 라우팅 변환
- [ ] Doremi API 연결
- [ ] 스타일 조정
- [ ] E2E 테스트

### Phase 3: 타입 & 상태 (1주)

- [ ] 공유 타입 정의
- [ ] Zustand 상태 구현
- [ ] TanStack Query 훅 작성

### Phase 4: Admin 페이지 (2-3주)

- [ ] UI 컴포넌트 적용
- [ ] 기존 Admin 페이지 개선

### Phase 5: 검증 (1주)

- [ ] 성능 테스트
- [ ] 번들 최적화
- [ ] 프로덕션 배포

---

## 📋 체크리스트

### 시작 전 확인

- [ ] Doremi 기존 UI 컴포넌트 구조 파악
- [ ] 백엔드 API 경로 & 응답 형식 확인
- [ ] 기존 타입 정의 위치 파악
- [ ] 의존성 버전 확인

### Phase 1 실행

- [ ] Radix UI npm install
- [ ] 테스트 빌드 (번들 사이즈 확인)
- [ ] 컴포넌트 복사

### Phase 2 실행

- [ ] 홈페이지 컴포넌트 복사
- [ ] 라우팅 변환
- [ ] API 연결
- [ ] 테스트

---

## 🎯 최종 결론

### ✅ 꼭 하세요

1. **UI 컴포넌트** — 개발 생산성 30-40% 향상
2. **홈페이지 컴포넌트** — 빠른 개발
3. **타입 정의** — 타입 안전성 강화

### 🤔 선택적

- Admin 페이지 개선
- 상태관리 전체 리팩토링 (점진적)

### ❌ 하지 마세요

- 번들 사이즈 무시
- 의존성 호환성 무시
- 기존 코드 파괴적 변경

---

**작성**: 2026-02-28
**분석자**: Claude Code
**상태**: 검토 대기
