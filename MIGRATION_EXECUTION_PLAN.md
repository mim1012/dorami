# Fashion Platform → Dorami 마이그레이션 실행 계획

## 📊 전체 마이그레이션 로드맵

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Fashion Platform (Vite + React Router + Mock Data)            │
│  ↓ (79 컴포넌트, 714KB)                                         │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Phase 1: 라우팅 + 구조 변환 (2-4시간)                     │ │
│  ├─ React Router → Next.js App Router                        │ │
│  ├─ AdminLayout, Header, Sidebar 통합                        │ │
│  ├─ 미들웨어 인증 추가                                       │ │
│  └─ /admin, /, /profile 라우트 확정                          │ │
│                                                               │ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Phase 2: 컴포넌트 포팅 (3-5시간)                          │ │
│  ├─ MainPage (Header + 4섹션)                                │ │
│  ├─ AdminLayout (Sidebar + Pages)                            │ │
│  ├─ 79개 UI 컴포넌트 복사                                    │ │
│  └─ 색상 테마 변환 (#FF4D8D → #FF1493)                      │ │
│                                                               │ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Phase 3: API 연동 (2-3시간)                               │ │
│  ├─ getMainPageData 구현                                     │ │
│  ├─ useMainPageData hook 통합                                │ │
│  ├─ 필드 매핑 (discount → discountRate)                      │ │
│  └─ 응답 unwrap 로직                                         │ │
│                                                               │ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Phase 4: 실시간 기능 (1-2시간)                            │ │
│  ├─ Socket.IO 클라이언트 설정                                │ │
│  ├─ stream:started/ended 이벤트 리스너                       │ │
│  └─ TanStack Query invalidation                              │ │
│                                                               │ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Phase 5: 인증 + 보안 (1-2시간)                            │ │
│  ├─ middleware 미들웨어 보호 (/admin)                        │ │
│  ├─ useAuth() hook 통합                                      │ │
│  └─ Admin role 검증                                          │ │
│                                                               │ │
│  └─→ ✅ Dorami 기술스택 + Fashion 디자인                      │ │
│                                                               │ │
└─────────────────────────────────────────────────────────────────┘

⏱️ 총 예상 시간: 10-16시간 (1-2일)
```

---

## 📁 Phase 1: 라우팅 + 구조 변환 (2-4시간)

### 1.1 라우트 구조 재설계

**Fashion Platform (현재):**

```
/ (MainPage)
/admin (AdminLayout)
  ├─ /admin (OverviewPage)
  ├─ /admin/products
  ├─ /admin/products/:id
  ├─ /admin/orders
  ├─ /admin/customers
  ├─ /admin/analytics
  ├─ /admin/settings
  ├─ /admin/live-management
  └─ /admin/payment-settings
```

**Dorami 기반 변환:**

```
client-app/src/app/
├─ page.tsx                    ← MainPage (Fashion 디자인)
├─ login/page.tsx              ← 기존 (Kakao OAuth)
├─ admin/
│  ├─ layout.tsx               ← AdminLayout (Fashion 디자인)
│  ├─ page.tsx                 ← OverviewPage
│  ├─ products/page.tsx
│  ├─ products/[id]/page.tsx
│  ├─ orders/page.tsx
│  ├─ customers/page.tsx
│  ├─ analytics/page.tsx
│  ├─ settings/page.tsx
│  ├─ live-management/page.tsx
│  └─ payment-settings/page.tsx
├─ profile/register/page.tsx    ← 기존 (프로필 완성)
└─ middleware.ts               ← 인증 보호
```

### 1.2 중요: 미들웨어 설정

```typescript
// middleware.ts
const PROTECTED_PATHS = ['/admin', '/orders', '/checkout', '/products/:id'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

  if (!isProtected) return NextResponse.next();

  // /admin은 accessToken + ADMIN role 필수
  const accessToken = request.cookies.get('accessToken')?.value;
  if (!accessToken) {
    return redirectToLogin(request, pathname);
  }

  return NextResponse.next();
}
```

---

## 📦 Phase 2: 컴포넌트 포팅 (3-5시간)

### 2.1 핵심 컴포넌트 매핑

| Fashion 컴포넌트   | 대상 위치                                     | 변환 작업             |
| ------------------ | --------------------------------------------- | --------------------- |
| MainPage           | `/app/page.tsx`                               | 데이터 연동           |
| Header             | `/components/layout/Header.tsx`               | 로고, 테마 토글 유지  |
| LiveBanner         | `/components/mainpage/LiveHeroBanner.tsx`     | API 데이터 연동       |
| PopularProducts    | `/components/mainpage/PopularProductGrid.tsx` | 필드 리매핑           |
| LiveExclusiveDeals | `/components/mainpage/LiveExclusiveDeals.tsx` | API 데이터 연동       |
| UpcomingLives      | `/components/mainpage/UpcomingLiveSlider.tsx` | API 데이터 연동       |
| AdminLayout        | `/app/admin/layout.tsx`                       | Sidebar + Header 통합 |
| ProductsPage       | `/app/admin/products/page.tsx`                | 기존 Logic 유지       |

### 2.2 색상 테마 변환

```typescript
// tailwind.config.ts (Dorami)
// Fashion Pink: #FF4D8D
// Dorami Hot Pink: #FF1493

// 모든 Fashion 컴포넌트에서:
// text-[#FF4D8D] → text-hot-pink
// bg-[#FF4D8D] → bg-hot-pink
// border-[#FF4D8D] → border-hot-pink
```

---

## 🔗 Phase 3: API 연동 (2-3시간)

### 3.1 핵심 API 함수

```typescript
// lib/api/mainpage.ts
export async function getMainPageData(): Promise<MainPageData> {
  const [activeRes, upcomingRes, popularRes, liveDealsRes] = await Promise.all([
    apiClient.get('/streaming/active'),
    apiClient.get('/streaming/upcoming', { params: { limit: 4 } }),
    apiClient.get('/products/popular', { params: { limit: 8 } }),
    apiClient.get('/products/live-deals').catch(() => ({ data: null })),
  ]);

  // 응답 unwrap 및 타입 변환
  const activeStreams = activeRes.data ?? [];
  const liveDealsData = liveDealsRes.data;

  return {
    currentLive: activeStreams[0] ?? null,
    liveDeals: (liveDealsData?.products ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice,
      discountRate: p.discountRate, // ✅ discount → discountRate
      imageUrl: p.imageUrl, // ✅ image → imageUrl
      status: p.status,
      stock: p.stock,
    })),
    upcomingLives: (upcomingRes.data ?? []).map((s) => ({
      id: s.id,
      streamKey: s.streamKey,
      title: s.title,
      scheduledAt: s.scheduledAt,
      thumbnailUrl: s.thumbnailUrl,
      host: s.host,
    })),
    popularProducts: (popularRes.data?.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice,
      discountRate: p.discountRate, // ✅ discount → discountRate
      imageUrl: p.imageUrl, // ✅ image → imageUrl
      isNew: p.isNew,
      soldCount: p.soldCount,
    })),
  };
}
```

### 3.2 필드 매핑 스크립트

```typescript
// 필드 변환 매퍼
const fieldMapper = {
  discount: 'discountRate',
  image: 'imageUrl',
  endTime: null, // ❌ 없음 (제거)
};

// 사용 예
const transformedProduct = {
  ...product,
  discountRate: product.discount,
  imageUrl: product.image,
  // endTime 제거
};
```

---

## ⚡ Phase 4: 실시간 기능 (1-2시간)

### 4.1 WebSocket 통합

```typescript
// lib/hooks/queries/use-mainpage.ts
export function useMainPageData() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? '';
    if (!wsUrl) return;

    let ws: any;
    try {
      ws = io(wsUrl, {
        withCredentials: true,
        reconnectionAttempts: 3,
      });
    } catch (error) {
      console.error('WebSocket 연결 오류:', error);
      return;
    }

    // 세 가지 주요 이벤트
    ws.on('stream:started', () => {
      queryClient.invalidateQueries({ queryKey: mainpageKeys.data() });
    });

    ws.on('stream:ended', () => {
      queryClient.invalidateQueries({ queryKey: mainpageKeys.data() });
    });

    ws.on('upcoming:updated', () => {
      queryClient.invalidateQueries({ queryKey: mainpageKeys.data() });
    });

    return () => ws.disconnect();
  }, [queryClient]);

  // TanStack Query
  return useQuery({
    queryKey: mainpageKeys.data(),
    queryFn: getMainPageData,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}
```

---

## 🔐 Phase 5: 인증 + 보안 (1-2시간)

### 5.1 Admin 라우트 보호

```typescript
// app/admin/layout.tsx
'use client';

import { useAuth } from '@/lib/hooks/use-auth';
import { Navigate } from 'next/navigation';

export default function AdminLayout({ children }) {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;

  // 1️⃣ 인증 필수
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // 2️⃣ Admin role 필수
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" />;
  }

  return <AdminLayoutUI>{children}</AdminLayoutUI>;
}
```

### 5.2 JWT 자동 갱신 (기존 코드 그대로)

```typescript
// lib/api/client.ts (Dorami 기존)
// - accessToken 쿠키 자동 포함
// - 401 시 refreshToken으로 자동 갱신
// - 모든 API 호출에서 투명하게 동작
```

---

## ✅ 마이그레이션 체크리스트

```
Phase 1: 라우팅 변환
- [ ] Next.js 앱 폴더 구조 생성
- [ ] middleware.ts 작성
- [ ] 라우트 매핑 완료

Phase 2: 컴포넌트 포팅
- [ ] MainPage 컴포넌트 복사
- [ ] AdminLayout 통합
- [ ] 79개 UI 컴포넌트 이동
- [ ] 색상 테마 변환 완료

Phase 3: API 연동
- [ ] getMainPageData 구현
- [ ] 필드 매핑 확인
- [ ] 응답 타입 정의
- [ ] API 호출 테스트

Phase 4: WebSocket
- [ ] Socket.IO 클라이언트 설정
- [ ] 이벤트 리스너 등록
- [ ] TanStack Query invalidation 테스트

Phase 5: 인증
- [ ] Admin 라우트 미들웨어 보호
- [ ] useAuth() 통합
- [ ] Admin role 검증 테스트

Phase 6: 최종 테스트
- [ ] MainPage: 데이터 로드 확인
- [ ] Admin: 로그인 → 진입 (인증 확인)
- [ ] WebSocket: 실시간 업데이트
- [ ] 응답성 + 성능 테스트
```

---

## 📈 기대 효과

| 항목     | Before              | After                              |
| -------- | ------------------- | ---------------------------------- |
| 기술스택 | Vite + React Router | Next.js + TanStack Query           |
| 디자인   | Dorami 다크테마     | **Fashion Platform 라이트테마** ✨ |
| 데이터   | Mock 배열           | **Dorami API** ✅                  |
| 인증     | 없음                | **Kakao OAuth + JWT** 🔐           |
| 실시간   | 없음                | **WebSocket 업데이트** ⚡          |
| Admin    | 보호 없음           | **미들웨어 보호** 🔒               |

---

## ⚠️ 핵심 주의사항

1. **API 응답 구조**: `{ data: { data: [...], meta: {...} } }` 형식 철저히 확인
2. **필드 이름**: `discount` → `discountRate`, `image` → `imageUrl` 모두 리매핑
3. **JWT 쿠키**: apiClient가 자동으로 처리 (추가 작업 불필요)
4. **Admin 보호**: middleware + 컴포넌트 레벨 이중 검증
5. **색상**: 모든 Fashion의 `#FF4D8D` → Dorami의 `#FF1493` 변환

---

**다음 단계: UI 목업 확인 후 Phase 1 착수** 🚀
