# Dorami 메인페이지 리디자인 — 최종 통합 실행 계획

**작성일**: 2026-02-28
**버전**: 1.0 (통합 완료)
**기반**: 디자인 분석(Task #1) + DB/API 분석(Task #2) + Prisma 분석(Task #3)
**목표**: 4개 섹션 메인페이지 + 디자인 시스템 통합

---

## 목차

- [A. 메인페이지 섹션](#section-a-메인페이지-섹션)
  - [A.1 API 엔드포인트 최종 스펙](#a1-api-엔드포인트-최종-스펙)
  - [A.2 Prisma Schema 변경사항](#a2-prisma-schema-변경사항)
  - [A.3 데이터 흐름](#a3-데이터-흐름)
  - [A.4 컴포넌트 스펙 (7개)](#a4-컴포넌트-스펙-7개)
  - [A.5 Frontend 파일 구조](#a5-frontend-파일-구조)
- [B. Admin 대시보드](#section-b-admin-대시보드)
- [C. 5단계 로드맵](#section-c-5단계-로드맵)
- [D. 리스크 평가](#section-d-리스크-평가)

---

## Section A. 메인페이지 섹션

### 현황 요약

| 섹션               | 현재 상태                           | 필요 작업                    |
| ------------------ | ----------------------------------- | ---------------------------- |
| 라이브 히어로 배너 | `LiveCountdownBanner.tsx` 부분 구현 | 실제 라이브 데이터 표시 추가 |
| 방송특가           | 미구현                              | 신규 API + 컴포넌트          |
| 곧 시작하는 라이브 | `UpcomingLiveCard.tsx` 구현 완료    | host 정보 Props 추가         |
| 라이브 인기상품    | 미구현 (featured만 있음)            | 판매순 정렬 API + 컴포넌트   |

---

### A.1 API 엔드포인트 최종 스펙

#### 엔드포인트 1: 현재 라이브 조회 (기존 확장)

```
GET /api/streaming/active
```

**현재 상태**: 구현됨 (`streaming.service.ts:getActiveStreams`)
**필요 변경**: 응답에 `host` 필드 추가 (viewerCount는 이미 포함됨)

**현재 응답**:

```typescript
{
  data: {
    items: [{
      id: string
      streamKey: string
      title: string
      status: 'LIVE'
      startedAt: string
      thumbnailUrl: string | null
      viewerCount: number        // ✅ 이미 Redis에서 조회
      scheduledAt: Date | null   // ✅ DTO에 이미 있음
    }],
    total: number
  }
}
```

**추가 필요 필드**:

```typescript
host: {
  id: string;
  name: string;
}
```

**구현 위치**: `backend/src/modules/streaming/streaming.service.ts`의 `getActiveStreams()` → Prisma include `user: { select: { id, name } }` 추가

---

#### 엔드포인트 2: 예정 라이브 조회 (기존 확장)

```
GET /api/streaming/upcoming?limit=4
```

**현재 상태**: 구현됨
**필요 변경**: 응답에 `host`, `description` 추가

**현재 DTO** (`streaming.dto.ts:17`): `description?: string` 이미 선언됨
**DB 상태**: `LiveStream.description` 필드 **미존재** → Prisma 마이그레이션 필요

**추가 필요 필드**:

```typescript
description: string | null; // DB 마이그레이션 필요
host: {
  id: string;
  name: string;
}
durationUntilStart: number; // 계산값 (초): scheduledAt - now
```

---

#### 엔드포인트 3: 방송특가 상품 조회 (신규)

```
GET /api/products/live-deals
```

**현재 상태**: 미구현
**구현 위치**: `backend/src/modules/products/products.controller.ts` + `products.service.ts`

**응답 스펙**:

```typescript
{
  data: {
    products: ProductResponseDto[]  // 현재 LIVE 스트림 연결 상품
    streamTitle: string             // 연결된 라이브 제목
    streamKey: string               // 라이브 스트림 키
  }
}
```

**쿼리 로직**:

```sql
SELECT products.*
FROM products
INNER JOIN live_streams ON products.stream_key = live_streams.stream_key
WHERE live_streams.status = 'LIVE'
  AND products.status = 'AVAILABLE'
ORDER BY products.sort_order ASC, products.created_at ASC
LIMIT 8
```

**Prisma 코드**:

```typescript
async getLiveDeals(): Promise<{ products: ProductResponseDto[]; streamTitle: string; streamKey: string } | null> {
  const activeLive = await this.prisma.liveStream.findFirst({
    where: { status: StreamStatus.LIVE },
    include: {
      products: {
        where: { status: ProductStatus.AVAILABLE },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        take: 8,
      },
    },
  });

  if (!activeLive || activeLive.products.length === 0) return null;

  return {
    products: activeLive.products.map(toProductResponseDto),
    streamTitle: activeLive.title,
    streamKey: activeLive.streamKey,
  };
}
```

**라이브 없을 때**: `null` 반환 → 프론트엔드에서 섹션 숨김

---

#### 엔드포인트 4: 인기상품 조회 (신규)

```
GET /api/products/popular?limit=8&page=0
```

**현재 상태**: 미구현 (기존 `GET /api/products/featured`는 최신순 정렬)
**구현 위치**: `products.controller.ts` + `products.service.ts`

**응답 스펙**:

```typescript
{
  data: {
    products: (ProductResponseDto & { soldCount: number })[]
    meta: { total: number; page: number; totalPages: number }
  }
}
```

**쿼리 로직**:

```sql
SELECT p.*, COALESCE(SUM(oi.quantity), 0) as sold_count
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN orders o ON o.id = oi.order_id
  AND o.status IN ('PAYMENT_CONFIRMED', 'SHIPPED', 'DELIVERED')
WHERE p.status = 'AVAILABLE'
GROUP BY p.id
ORDER BY sold_count DESC, p.created_at DESC
LIMIT 8 OFFSET 0
```

**Prisma raw query** (집계 필요):

```typescript
async getPopularProducts(limit = 8, page = 0): Promise<{ products: any[]; meta: any }> {
  const offset = page * limit;

  const products = await this.prisma.$queryRaw`
    SELECT p.*,
           COALESCE(SUM(CASE WHEN o.status IN ('PAYMENT_CONFIRMED','SHIPPED','DELIVERED')
                              THEN oi.quantity ELSE 0 END), 0)::int as sold_count
    FROM products p
    LEFT JOIN order_items oi ON oi.product_id = p.id
    LEFT JOIN orders o ON o.id = oi.order_id
    WHERE p.status = 'AVAILABLE'
    GROUP BY p.id
    ORDER BY sold_count DESC, p.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const total = await this.prisma.product.count({ where: { status: 'AVAILABLE' } });

  return {
    products,
    meta: { total, page, totalPages: Math.ceil(total / limit) },
  };
}
```

**DB 인덱스 추가 필요** (성능):

```sql
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_orders_status ON orders(status);
```

---

### A.2 Prisma Schema 변경사항

#### 변경 1: LiveStream.description 추가

```prisma
// backend/prisma/schema.prisma
model LiveStream {
  // ... 기존 필드들
  title         String       @default("Live Stream")
  description   String?      // ← 신규 추가 (nullable)
  status        StreamStatus @default(PENDING)
  // ...
}
```

**마이그레이션 명령**:

```bash
cd backend
npx prisma migrate dev --name add_livestream_description
```

**영향 범위**: 기존 기능에 영향 없음 (nullable 필드)

#### 변경 2: OrderItem 인덱스 추가

```prisma
model OrderItem {
  // ... 기존 필드들

  @@index([productId])          // ← 신규 (인기상품 집계 성능)
  @@index([orderId])            // ← 신규 (JOIN 성능)
  @@map("order_items")
}
```

**마이그레이션 명령**:

```bash
npx prisma migrate dev --name add_order_item_indexes
```

#### 변경 요약

| 변경                            | 타입            | 이유                  | 영향             |
| ------------------------------- | --------------- | --------------------- | ---------------- |
| `LiveStream.description` 추가   | nullable String | 예정 라이브 설명 표시 | 없음 (nullable)  |
| `order_items.product_id` 인덱스 | 성능            | 인기상품 집계 쿼리    | 쓰기 약간 느려짐 |
| `order_items.order_id` 인덱스   | 성능            | JOIN 최적화           | 쓰기 약간 느려짐 |

---

### A.3 데이터 흐름

#### 메인페이지 로딩 시퀀스

```
사용자 → GET /api/streaming/active     → LiveHeroBanner (라이브 or 카운트다운)
       → GET /api/products/live-deals  → LiveExclusiveDeals (라이브 있으면 표시)
       → GET /api/streaming/upcoming   → UpcomingLiveCard × N
       → GET /api/products/popular     → PopularProductsSection

갱신 주기 (TanStack Query):
  streaming/active:   30초 (실시간성 중요)
  products/live-deals: 30초 (라이브 상품 변동)
  streaming/upcoming: 60초 (예정 라이브 변동 느림)
  products/popular:   5분  (판매 집계 무거움)

WebSocket 보완:
  'stream:started' → activeLive 쿼리 즉시 무효화
  'stream:ended'   → activeLive, liveDeals 쿼리 즉시 무효화
  'upcoming:updated' → upcomingLives 쿼리 즉시 무효화
```

#### 상태 분기 로직

```
라이브 배너:
  activeLive.items.length > 0  → LiveHeroBanner (라이브 중)
  activeLive.items.length == 0 → LiveCountdownBanner (다음 예정 라이브)
  upcoming 없음                → 프로모션 정적 배너

방송특가:
  liveDeals != null → LiveExclusiveDeals 표시
  liveDeals == null → 섹션 숨김 (return null)

곧 시작하는 라이브:
  upcoming.items.length > 0  → UpcomingLiveCard × N
  upcoming.items.length == 0 → EmptyState ("예정된 라이브가 없습니다")

인기상품:
  popular.products.length > 0 → PopularProductsSection (2열 그리드)
  popular.products.length == 0 → EmptyState ("등록된 상품이 없습니다")
```

---

### A.4 컴포넌트 스펙 (7개)

#### 컴포넌트 1: `SectionHeader.tsx` (공통)

```typescript
// client-app/src/components/home/SectionHeader.tsx
interface SectionHeaderProps {
  title: string;
  count?: number;
  badge?: {
    label: string;
    variant: 'live' | 'pink' | 'purple';
  };
  barVariant?: 'pink-purple' | 'purple-orange';
  onViewMore?: () => void;
  viewMoreLabel?: string;
}
```

**디자인 패턴**:

```
[수직 바] [제목]  [뱃지]              [더보기 →]

수직 바 색상:
  pink-purple:   from-hot-pink to-[#7928CA]
  purple-orange: from-[#7928CA] to-[#FF4500]

뱃지 색상:
  live:   bg-[#FF3B30] text-white (LIVE 뱃지)
  pink:   bg-hot-pink/15 text-hot-pink border-hot-pink/20
  purple: bg-[#7928CA]/15 text-[#7928CA] border-[#7928CA]/20
```

---

#### 컴포넌트 2: `LiveHeroBanner.tsx` (신규)

```typescript
// client-app/src/components/home/LiveHeroBanner.tsx
interface LiveHeroBannerProps {
  activeLive?: {
    streamKey: string;
    title: string;
    viewerCount: number;
    thumbnailUrl: string | null;
    host: { id: string; name: string };
    startedAt: string;
  };
  nextLive?: {
    title: string;
    scheduledAt: string;
    streamId: string;
  };
  onLiveClick: (streamKey: string) => void;
}
```

**상태 분기**:

- `activeLive` 있음 → 라이브 배너 (16:9 aspect, 썸네일 + 오버레이)
- `activeLive` 없고 `nextLive` 있음 → 기존 `LiveCountdownBanner` 로직
- 둘 다 없음 → `null`

**핵심 클래스**:

```
래퍼:          relative w-full aspect-video mx-4 rounded-3xl overflow-hidden cursor-pointer group
썸네일:        absolute inset-0 object-cover transition-transform group-hover:scale-105
오버레이:      absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent
LIVE 뱃지:     animate-pulse-live bg-[#FF3B30]
시청자수:      bg-black/50 backdrop-blur-sm rounded-full text-xs font-mono
제목:          text-2xl font-black text-white drop-shadow-lg
CTA:           bg-hot-pink px-8 py-3.5 rounded-full font-bold hover:opacity-90
```

**기존 `LiveCountdownBanner.tsx` 처리**:
`LiveHeroBanner` 내부에서 카운트다운 로직 통합, 기존 파일은 점진적으로 deprecated

---

#### 컴포넌트 3: `LiveDealProductCard.tsx` (신규)

```typescript
// client-app/src/components/home/LiveDealProductCard.tsx
// 방송특가 전용 compact 카드 (기존 ProductCard보다 좁음)
interface LiveDealProductCardProps {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  discountRate?: number;
  isNew?: boolean;
  onClick: () => void;
}
```

**레이아웃**: `min-w-[160px] max-w-[180px]` + `aspect-[3/4]` 이미지

---

#### 컴포넌트 4: `LiveExclusiveDeals.tsx` (신규)

```typescript
// client-app/src/components/home/LiveExclusiveDeals.tsx
interface LiveExclusiveDealsProps {
  products: LiveDealProduct[];
  streamTitle: string;
  streamKey: string;
  isLoading?: boolean;
  onProductClick: (productId: string) => void;
  onLiveClick: (streamKey: string) => void;
}
```

**레이아웃**:

```
SectionHeader title="방송특가" badge={live} barVariant="pink-purple"
  [서브텍스트: "{streamTitle}에서 판매 중"]
  [수평 스크롤 컨테이너]
    LiveDealProductCard × N (최대 8개)
  [라이브 보러가기 → ] 버튼
```

**라이브 없을 때**: `return null` (섹션 자체 미표시)
**로딩 시**: Skeleton 3개 (animate-shimmer)

---

#### 컴포넌트 5: `UpcomingLiveCard.tsx` (기존 확장)

```typescript
// 기존 Props에 추가
interface UpcomingLiveCardProps {
  // ... 기존
  host?: { id: string; name: string }; // ← 신규 추가
  description?: string; // ← 신규 추가 (선택적 표시)
}
```

**변경 최소화**: 기존 구현 95% 유지, host 이름 표시만 추가

---

#### 컴포넌트 6: `PopularProductsSection.tsx` (신규)

```typescript
// client-app/src/components/home/PopularProductsSection.tsx
interface PopularProductsSectionProps {
  products: PopularProduct[];
  isLoading?: boolean;
  onViewMore?: () => void;
  onProductClick: (productId: string) => void;
}

interface PopularProduct {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  discountRate?: number;
  isNew?: boolean;
  soldCount?: number; // 판매수 (선택적 표시)
}
```

**레이아웃**:

```
SectionHeader title="라이브 인기상품" badge={purple} barVariant="purple-orange" onViewMore
  [2열 그리드]
    첫 번째: grid-column 1/-1 (전체 너비, ProductCard size="normal")
    나머지:  2열 (ProductCard size="small")
```

**기존 `ProductCard` 재사용**: 100% 재사용 (변경 없음)

---

#### 컴포넌트 7: `useMainPageData.ts` (신규 훅)

```typescript
// client-app/src/lib/hooks/queries/useMainPageData.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io } from 'socket.io-client';

export function useMainPageData() {
  const queryClient = useQueryClient();

  // 1. 현재 라이브
  const activeLive = useQuery({
    queryKey: ['streaming', 'active'],
    queryFn: async () => {
      const res = await fetch('/api/streaming/active', { credentials: 'include' });
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // 2. 방송특가 (라이브 있을 때만)
  const liveDeals = useQuery({
    queryKey: ['products', 'live-deals'],
    queryFn: async () => {
      const res = await fetch('/api/products/live-deals', { credentials: 'include' });
      const json = await res.json();
      return json.data; // null이면 섹션 숨김
    },
    enabled: (activeLive.data?.items?.length ?? 0) > 0,
    refetchInterval: 30_000,
  });

  // 3. 예정 라이브
  const upcomingLives = useQuery({
    queryKey: ['streaming', 'upcoming'],
    queryFn: async () => {
      const res = await fetch('/api/streaming/upcoming?limit=4', { credentials: 'include' });
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // 4. 인기상품
  const popularProducts = useQuery({
    queryKey: ['products', 'popular'],
    queryFn: async () => {
      const res = await fetch('/api/products/popular?limit=8', { credentials: 'include' });
      const json = await res.json();
      return json.data;
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  // WebSocket 실시간 갱신
  useEffect(() => {
    const ws = io(process.env.NEXT_PUBLIC_WS_URL ?? '', { withCredentials: true });

    ws.on('stream:started', () => {
      queryClient.invalidateQueries({ queryKey: ['streaming', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['products', 'live-deals'] });
    });

    ws.on('stream:ended', () => {
      queryClient.invalidateQueries({ queryKey: ['streaming', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['products', 'live-deals'] });
    });

    ws.on('upcoming:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['streaming', 'upcoming'] });
    });

    return () => {
      ws.disconnect();
    };
  }, [queryClient]);

  return { activeLive, liveDeals, upcomingLives, popularProducts };
}
```

---

### A.5 Frontend 파일 구조

#### 신규 생성 파일

```
client-app/src/
├── components/
│   └── home/
│       ├── SectionHeader.tsx          ← 신규 (공통 섹션 헤더)
│       ├── LiveHeroBanner.tsx         ← 신규 (라이브 히어로 배너)
│       ├── LiveDealProductCard.tsx    ← 신규 (방송특가 카드)
│       ├── LiveExclusiveDeals.tsx     ← 신규 (방송특가 섹션)
│       ├── PopularProductsSection.tsx ← 신규 (인기상품 섹션)
│       ├── ProductCard.tsx            ← 기존 (변경 없음)
│       ├── UpcomingLiveCard.tsx       ← 기존 (host Props 추가)
│       ├── LiveCountdownBanner.tsx    ← 기존 (LiveHeroBanner로 통합 후 deprecated)
│       └── SocialProof.tsx            ← 기존 (변경 없음)
└── lib/
    └── hooks/
        └── queries/
            └── useMainPageData.ts     ← 신규 (통합 데이터 훅)
```

#### 수정 파일

```
client-app/src/app/page.tsx           ← 기존 (섹션 구조 업데이트)
backend/src/modules/products/
  ├── products.service.ts             ← getLiveDeals(), getPopularProducts() 추가
  ├── products.controller.ts          ← /live-deals, /popular 라우트 추가
  └── dto/product.dto.ts              ← 응답 DTO 확장
backend/src/modules/streaming/
  └── streaming.service.ts            ← host 정보 include 추가
backend/prisma/schema.prisma          ← description 필드, 인덱스 추가
```

#### 업데이트된 `app/page.tsx` 구조

```tsx
// 기존 useEffect + fetch → useMainPageData() 훅으로 교체
export default function Home() {
  const { activeLive, liveDeals, upcomingLives, popularProducts } = useMainPageData();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-primary-black text-primary-text pb-bottom-nav">
      {/* 1. Hero 헤더 (기존 유지) */}
      <header>...</header>

      {/* 2. 라이브 히어로 배너 (신규) */}
      <LiveHeroBanner
        activeLive={activeLive.data?.items?.[0]}
        nextLive={upcomingLives.data?.items?.[0]}
        onLiveClick={(key) => router.push(`/live/${key}`)}
      />

      {/* 3. SocialProof (기존 유지) */}
      <SocialProof followerCount={6161} />

      {/* 4. 방송특가 (신규, 라이브 없으면 null) */}
      {liveDeals.data && (
        <LiveExclusiveDeals
          products={liveDeals.data.products}
          streamTitle={liveDeals.data.streamTitle}
          streamKey={liveDeals.data.streamKey}
          isLoading={liveDeals.isLoading}
          onProductClick={(id) => router.push(`/products/${id}`)}
          onLiveClick={(key) => router.push(`/live/${key}`)}
        />
      )}

      {/* 5. 곧 시작하는 라이브 (기존 + host 추가) */}
      <section className="px-4 mb-8">
        <SectionHeader
          title="예정된 라이브"
          count={upcomingLives.data?.items?.length}
          barVariant="pink-purple"
        />
        <div className="flex gap-4 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4 snap-x snap-mandatory">
          {upcomingLives.data?.items?.map((live, i) => (
            <UpcomingLiveCard key={live.id} {...live} host={live.host} />
          ))}
        </div>
      </section>

      {/* 6. Weekly Pick 배너 (기존 유지) */}
      <section className="px-4 mb-8">...</section>

      {/* 7. 라이브 인기상품 (신규) */}
      <PopularProductsSection
        products={popularProducts.data?.products ?? []}
        isLoading={popularProducts.isLoading}
        onViewMore={() => router.push('/shop')}
        onProductClick={(id) => router.push(`/products/${id}`)}
      />

      {/* 8. Push 알림, Footer, Nav (기존 유지) */}
      <PushNotificationBanner />
      <Footer />
      <FloatingNav />
      <BottomTabBar />
    </div>
  );
}
```

---

## Section B. Admin 대시보드

**이번 범위에서 제외** (리디자인 미포함)

현재 Admin 페이지 현황:

- `admin/dashboard/page.tsx` — 기본 대시보드 구현됨
- `admin/orders/page.tsx` — 주문 관리
- `admin/products/page.tsx` — 상품 관리
- `admin/users/page.tsx` — 사용자 관리
- `admin/broadcasts/page.tsx` — 방송 관리
- `admin/settlement/page.tsx` — 정산
- `admin/audit-log/page.tsx` — 감사 로그

**다음 단계**: Admin 페이지 개선은 메인페이지 구현 완료 후 별도 이슈로 진행

---

## Section C. 5단계 로드맵

### Phase 1: DB 마이그레이션 (1-2일)

```
담당: 백엔드 개발자
작업:
  [ ] LiveStream.description 필드 추가
      prisma migrate dev --name add_livestream_description
  [ ] OrderItem 인덱스 추가
      prisma migrate dev --name add_order_item_indexes
  [ ] prisma generate 실행
  [ ] 마이그레이션 검증 (prisma studio)

완료 기준:
  - 마이그레이션 파일 생성 확인
  - staging DB 적용 확인
  - 기존 테스트 통과
```

### Phase 2: 백엔드 API 구현 (3-5일)

```
담당: 백엔드 개발자
작업:
  [ ] GET /api/streaming/active → host 필드 추가
      streaming.service.ts: include user 추가
  [ ] GET /api/streaming/upcoming → host, description, durationUntilStart 추가
  [ ] GET /api/products/live-deals → 신규 구현
      products.service.ts: getLiveDeals()
      products.controller.ts: @Get('live-deals')
  [ ] GET /api/products/popular → 신규 구현
      products.service.ts: getPopularProducts()
      products.controller.ts: @Get('popular')
  [ ] DTO 업데이트 (product.dto.ts, streaming.dto.ts)
  [ ] Swagger 문서 업데이트
  [ ] 단위 테스트 작성 (products.service.spec.ts)

완료 기준:
  - 모든 4개 엔드포인트 Swagger에서 테스트 가능
  - 라이브 없을 때 live-deals = null 반환 확인
  - 판매순 정렬 확인 (popular)
  - 기존 테스트 모두 통과
```

### Phase 3: 프론트엔드 컴포넌트 구현 (5-7일)

```
담당: 프론트엔드 개발자
작업:
  [ ] SectionHeader.tsx — 공통 섹션 헤더
  [ ] useMainPageData.ts — TanStack Query 통합 훅
  [ ] LiveHeroBanner.tsx — 라이브 히어로 배너
  [ ] LiveDealProductCard.tsx — 방송특가 카드
  [ ] LiveExclusiveDeals.tsx — 방송특가 섹션
  [ ] PopularProductsSection.tsx — 인기상품 섹션
  [ ] UpcomingLiveCard.tsx — host Props 추가
  [ ] app/page.tsx — 전체 리팩토링

CSS 추가 (globals.css):
  [ ] --color-live-red: #FF3B30
  [ ] --color-purple-accent: #7928CA
  [ ] --color-orange-accent: #FF4500

완료 기준:
  - 4개 섹션 모두 렌더링 확인
  - 라이브 없을 때 방송특가 섹션 숨김 확인
  - 로딩/에러/빈 상태 UI 확인
  - 다크모드 정상 동작 확인
  - 모바일 (375px, 430px) 레이아웃 확인
```

### Phase 4: WebSocket 실시간 연동 (2-3일)

```
담당: 프론트엔드 + 백엔드
작업:
  [ ] stream:started 이벤트 → activeLive, liveDeals 쿼리 무효화
  [ ] stream:ended 이벤트 → activeLive, liveDeals 쿼리 무효화
  [ ] upcoming:updated 이벤트 → upcomingLives 쿼리 무효화
  [ ] useMainPageData 훅의 WebSocket 연동 검증
  [ ] 연결 실패 시 폴링 fallback 확인 (refetchInterval)

완료 기준:
  - OBS로 라이브 시작 시 배너 자동 갱신 확인
  - 라이브 종료 시 방송특가 섹션 자동 숨김 확인
```

### Phase 5: QA 및 배포 (2-3일)

```
담당: 전체
작업:
  [ ] E2E 테스트 작성 (Playwright)
      - 메인페이지 4개 섹션 렌더링
      - 라이브 시작/종료 시나리오
      - 상품 클릭 → 상세 페이지 이동
  [ ] 성능 테스트
      - 메인페이지 첫 로딩 < 2초 (LCP)
      - popular 쿼리 응답 < 500ms
  [ ] staging 배포 및 검증
  [ ] production 배포

총 소요: 13-20일 (약 3주)
```

---

## Section D. 리스크 평가

### 리스크 1: popular 쿼리 성능 (중간)

```
문제: $queryRaw 집계 쿼리는 상품/주문 증가에 따라 느려질 수 있음
영향: 메인페이지 로딩 지연

완화 방안:
  1. OrderItem 인덱스 추가 (Phase 1에서 적용)
  2. 5분 staleTime (TanStack Query 캐싱)
  3. 필요시 Redis 캐시 추가 (popular:products TTL 5min)
  4. 상품 수 소규모인 MVP 단계에서는 문제 없음

모니터링: 응답 시간 500ms 초과 시 캐싱 추가
```

### 리스크 2: 기존 page.tsx 리팩토링 (낮음)

```
문제: 기존 useEffect + fetch 패턴을 useMainPageData로 교체 시 회귀 가능성
영향: 기존 기능 (WebSocket 업데이트, 폴링) 중단

완화 방안:
  1. useMainPageData에 기존 WebSocket 로직 통합 확인
  2. 컴포넌트별 단위 테스트
  3. staging에서 충분한 검증 후 production 배포
```

### 리스크 3: LiveStream.description 마이그레이션 (낮음)

```
문제: 마이그레이션 실패 또는 기존 데이터 영향
영향: 서비스 다운타임

완화 방안:
  1. nullable 필드 추가 (기존 레코드 영향 없음)
  2. staging 먼저 적용 후 production 적용
  3. 롤백 마이그레이션 준비
```

### 리스크 4: Radix UI / MUI 미도입 결정 (없음)

```
결정: Fashion Platform의 Radix UI + MUI 미도입
이유:
  - Dorami 자체 UI 체계 완성 (Button, Modal, Table 등)
  - 번들 사이즈 증가 방지 (~150KB gzip 절약)
  - React 19 호환성 미검증
  - 기존 Tailwind 패턴과 충분히 호환

필요시: 개별 Radix 패키지만 점진적 추가
```

---

## 실행 준비 체크리스트

### 병렬 실행 가능 작업

```
Phase 1 (DB) + Phase 2 (API) 순차 실행 필요
Phase 2 완료 후 Phase 3 (Frontend) 시작 가능
Phase 3 + Phase 4 일부 병렬 가능

권장 병렬 구성:
  에이전트 A (executor): Phase 1 → Phase 2 (백엔드)
  에이전트 B (executor): Phase 3 (프론트엔드 컴포넌트, Mock API 사용)
  → Phase 2 완료 후 실제 API로 연결
```

### 사전 확인 사항

```
[ ] backend/.env에 DATABASE_URL, REDIS_URL 설정 확인
[ ] docker-compose up (PostgreSQL, Redis, SRS) 실행 확인
[ ] npm run prisma:studio로 현재 DB 상태 확인
[ ] OBS 또는 FFmpeg로 RTMP 테스트 환경 준비
```

---

**문서 완료**: 2026-02-28
**다음 액션**: executor 에이전트 → Phase 1 (DB 마이그레이션) 시작
