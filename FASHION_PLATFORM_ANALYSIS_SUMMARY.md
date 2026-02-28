# Fashion Platform → Dorami 적용 분석 📊

**작성일**: 2026-02-28 | **분석 결과**: 완료 | **적용 가능도**: 70-80%

---

## Executive Summary

| 항목           | 결과                          |
| -------------- | ----------------------------- |
| **프레임워크** | React 18 + Vite vs Next.js 16 |
| **적용 가능**  | ✅ 70-80%                     |
| **예상 기간**  | 3-4주                         |
| **권장 인력**  | 2-3명 병렬                    |
| **위험도**     | 중간                          |

---

## 1. Fashion Platform 구조

### 주요 컴포넌트

- **MainPage**: 메인 홈페이지
- **LiveBanner**: 라이브 배너
- **LiveExclusiveDeals**: 특가 상품 (타이머)
- **PopularProducts**: 인기 상품
- **UpcomingLives**: 예정 라이브
- **ProductDetailModal**: 상품 상세

### 관리자 페이지 (8개)

1. OverviewPage - 대시보드
2. ProductsPage - 상품 관리
3. ProductDetailPage - 상품 편집
4. OrdersPage - 주문 관리
5. CustomersPage - 고객 관리
6. AnalyticsPage - 분석
7. SettingsPage - 설정
8. HomeFeaturedProductsPage - 홈 상품
9. LiveManagementPage - 라이브 관리

---

## 2. 기술 스택 비교

### Fashion Platform

- React 18.3.1 + Vite
- React Router 7
- Radix UI (45개 컴포넌트)
- MUI + Emotion
- Tailwind CSS 4.1

### Dorami

- Next.js 16
- App Router
- Tailwind CSS 4.0
- Zustand + TanStack Query

### 주요 차이점

| 항목       | Fashion      | Dorami     | 호환성  |
| ---------- | ------------ | ---------- | ------- |
| 프레임워크 | React        | Next.js    | ⚠️ 낮음 |
| 라우팅     | React Router | App Router | ⚠️ 낮음 |
| UI         | Radix+MUI    | Tailwind   | 🟡 중간 |

---

## 3. 데이터 구조 (중요!)

### Fashion Platform의 타입

- **LiveStream**: 라이브 방송 (15+ 필드)
- **Product**: 상품 (25+ 필드)
- **LiveDeal**: 특가 상품
- **Host**: 호스트 정보
- **ProductSize/Color**: 옵션

### Dorami와의 차이

✅ Dorami는 기본 타입 정의됨
⚠️ Fashion Platform은 훨씬 상세함

**필요 추가 필드:**

- livePrice, soldCount, rating, reviewCount
- fromLiveId, fromLiveTitle, tags
- sizes[], colors[], material, deliveryInfo

---

## 4. 상태 관리 패턴

### MainPageState (Fashion Platform)

```
- currentLive (라이브 데이터 + 상태)
- liveDeals (특가 데이터 + 타이머)
- upcomingLives (예정 라이브)
- popularProducts (인기 상품)
- modals (UI 모달 상태)
- dealTimer (특가 타이머)
- likedProducts (Set<number>)
- notifiedLives (Set<number>)
- isOnline, scrollPosition, activeSection
```

✅ **Dorami에 통합 가능**: Zustand store 확장으로 구현

---

## 5. UI 컴포넌트 (45개 Radix UI)

✅ **완벽하게 활용 가능**

주요:

- button, card, dialog, form, input, select
- table, tabs, modal, popover, dropdown-menu
- carousel, accordion, badge, avatar, chart
- progress, slider, skeleton, sonner (토스트)
- ... 총 45개

⚠️ **주의**: MUI와 emotion 제거 필요 (Tailwind만 사용)

---

## 6. 적용 가능 항목 (✅ DO)

### 1. Radix UI 라이브러리

- 45개 컴포넌트 파일 복사
- 기간: 1-2일
- 호환성: 100%

### 2. 메인 페이지 컴포넌트

- LiveBanner, LiveExclusiveDeals, PopularProducts, UpcomingLives, ProductDetailModal
- 기간: 2-3일
- API: TanStack Query로 연결

### 3. 관리자 페이지 패턴

- 레이아웃, Sidebar, Header 구조 참고
- Radix UI 컴포넌트 적용
- 기간: 3-4일

### 4. 데이터 타입 확장

- shared-types에 필드 추가
- 기간: 1일

### 5. 상태 관리 패턴

- Zustand store 확장
- TanStack Query hooks
- 기간: 1-2일

### 6. 실시간 기능

- Socket.IO + Fashion Platform UI 패턴
- 기간: 2-3일

---

## 7. 마이그레이션 불가 (❌ DON'T)

1. ❌ React Router → Next.js App Router 유지
2. ❌ Vite 설정 → Next.js Webpack 유지
3. ❌ Emotion CSS → Tailwind로 통일
4. ❌ MUI → Radix UI로 대체
5. ❌ 목업 API → 실제 NestJS API 사용

---

## 8. 마이그레이션 일정 (3-4주)

### Week 1: UI + 데이터

- Radix UI 설치 및 테스트 (1-2일)
- 45개 컴포넌트 복사 (2-3일)
- 데이터 타입 확장 (1일) + 백엔드 DTO 업데이트 (병렬)

### Week 2: 메인 페이지 + 상태

- 5개 컴포넌트 마이그레이션 (3-4일)
- API 연결 (1-2일)
- Zustand store 확장 (1-2일)

### Week 3: 실시간 + 관리자

- Socket.IO 통합 (2-3일)
- 관리자 페이지 개선 (3-4일)
- 병행 테스트

### Week 4: 테스트 + 배포

- E2E 테스트 (2-3일)
- Staging 배포 (1-2일)
- Production 배포 (1-2일)

---

## 9. 실제 구현 예시

### LiveBanner 마이그레이션

```typescript
// client-app/src/components/mainpage/LiveBanner.tsx
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'

export const LiveBanner = () => {
  const { data: currentLive } = useQuery({
    queryKey: ['currentLive'],
    queryFn: () => apiClient.get('/api/streams/current'),
  })

  if (!currentLive) return null

  return (
    <div className="relative bg-gradient-to-r from-[#FF1493] to-red-500">
      {/* Fashion Platform UI 패턴 적용 */}
      <Button>라이브 입장</Button>
    </div>
  )
}
```

### 데이터 타입 확장

```typescript
// packages/shared-types/src/product.ts
export interface Product {
  // 기존 필드
  id: string;
  name: string;
  price: number;

  // Fashion Platform 추가 필드
  originalPrice?: number;
  livePrice?: number;
  discount?: number;
  soldCount?: number;
  rating?: number;
  isLiked?: boolean;
  tags?: string[];
  sizes?: ProductSize[];
  colors?: ProductColor[];
  fromLiveId?: number;
}
```

### Zustand Store 확장

```typescript
// client-app/src/lib/store/mainpage.ts
const useMainPageStore = create((set) => ({
  // 기존 상태

  // 추가: Fashion Platform 상태
  likedProducts: new Set<number>(),
  notifiedLives: new Set<number>(),
  dealTimer: { hours: 0, minutes: 0, seconds: 0 },
  modals: {
    productDetail: false,
    viewAllDeals: false,
  },
}));
```

---

## 10. 위험도 및 완화

| 위험            | 영향    | 완화 방안              |
| --------------- | ------- | ---------------------- |
| 프레임워크 차이 | ⚠️ 높음 | 컴포넌트 로직만 재사용 |
| 스타일 시스템   | 🟡 중간 | Tailwind만 사용        |
| API 형식        | 🟡 중간 | 어댑터 패턴            |
| 번들 크기       | 🟡 중간 | 코드 스플릿팅          |

---

## 11. 예상 효과

| 항목        | 개선 정도      |
| ----------- | -------------- |
| 개발 속도   | ↑ 30-40%       |
| UI 품질     | ↑↑ 현저히 개선 |
| 코드 재사용 | ↑ 50%          |
| 유지보수성  | ↑ 향상         |
| 사용자 경험 | ↑↑ 큰 개선     |

---

## 12. 다음 단계 (Action Items)

1. ✅ **팀 회의** - 이 분석 결과 검토 및 승인
2. ✅ **Radix UI 설치** - npm install @radix-ui/react-\*
3. ✅ **브랜치 생성** - feature/fashion-platform-integration
4. ✅ **Phase 1 시작** - UI 컴포넌트 마이그레이션
5. ✅ **병렬 진행** - 백엔드 데이터 구조 확장

---

## 결론

✅ **Fashion Platform은 Dorami에 70-80% 적용 가능**

**즉시 적용:**

- Radix UI 컴포넌트 라이브러리 (45개)
- 메인 페이지 5개 섹션 컴포넌트
- 상태 관리 패턴
- 데이터 타입

**예상 기간**: 3-4주 (2-3명 병렬)
**권장**: **지금 바로 시작!** 🚀
