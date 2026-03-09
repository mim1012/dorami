# Live Commerce Fashion Platform → Doremi 정확한 병합 전략

**작성일**: 2026-02-28
**기반**: Doremi 코드베이스 완전 분석 + Live Commerce 설계 문서 분석
**대상 조직**: Doremi 개발팀

---

## 목차

1. [현황 분석](#현황-분석)
2. [병합 전략 개요](#병합-전략-개요)
3. [Phase 1: UI 컴포넌트 시스템](#phase-1-ui-컴포넌트-시스템)
4. [Phase 2: 홈페이지 컴포넌트](#phase-2-홈페이지-컴포넌트)
5. [Phase 3: API & 타입 통합](#phase-3-api--타입-통합)
6. [Phase 4: 상태관리 & 훅](#phase-4-상태관리--훅)
7. [Phase 5: Admin 페이지 (선택)](#phase-5-admin-페이지-선택)
8. [리스크 & 완화](#리스크--완화)
9. [검증 계획](#검증-계획)
10. [일정 & 리소스](#일정--리소스)

---

## 현황 분석

### Doremi 프론트엔드 현황

**위치**: `client-app/`

| 항목                   | 현황    | 분석                                                                 |
| ---------------------- | ------- | -------------------------------------------------------------------- |
| **UI 컴포넌트 시스템** | ❌ 없음 | Button, Input, Modal 등 기본 컴포넌트가 없어서 개발 속도 저하        |
| **홈페이지**           | ⚠️ 기본 | LiveCountdownBanner만 있고, 특가상품, 예정라이브, 인기상품 섹션 부재 |
| **페이지 수**          | ✅ 36개 | 구조는 잘 정의됨 (/, /live, /my-page, /admin, /shop 등)              |
| **상태관리**           | ✅ 좋음 | Zustand (useAuthStore) + TanStack Query v5 (7개 도메인 훅)           |
| **API 클라이언트**     | ✅ 좋음 | CSRF 자동 주입, 401 자동 처리, 토큰 리프레시 구현                    |
| **타입 안전성**        | ✅ 좋음 | shared-types 중앙화 + lib/types 확장                                 |
| **라우팅**             | ✅ 좋음 | Next.js App Router (page.tsx 패턴)                                   |

**결론**: UI 컴포넌트와 홈페이지 섹션만 추가하면 개발 속도 대폭 향상 가능

### Doremi 백엔드 현황

**위치**: `backend/src/`

| 항목              | 현황      | 분석                                                               |
| ----------------- | --------- | ------------------------------------------------------------------ |
| **Streaming API** | ✅ 완성   | GET /api/streaming/active, /upcoming, POST /start, /go-live, /stop |
| **Products API**  | ✅ 완성   | GET /products, /featured, /store, /products/:id                    |
| **Cart/Orders**   | ✅ 완성   | POST /cart, GET /orders, PATCH /orders/:id/cancel                  |
| **WebSocket**     | ✅ 구현됨 | main.ts에 3개 네임스페이스 직접 구현 (/, /chat, /streaming)        |
| **API 응답 형식** | ✅ 통일   | {data, success, timestamp} 래핑 (TransformInterceptor)             |
| **Prisma 스키마** | ✅ 상세   | User, LiveStream, Product, Cart, Order, Reservation 모델 완성      |

**문제점**:

- `GET /api/streaming/active` vs Live Commerce `GET /api/live/current` 경로 불일치
- Live Commerce의 `/api/live/deals`, `/api/products/popular` 엔드포인트 부재
- `/api/live/notifications` 알림 API 부재

---

## 병합 전략 개요

### 5단계 로드맵

```
Phase 1: UI 컴포넌트 (2-3주)
  ↓
Phase 2: 홈페이지 (1-2주)
  ↓
Phase 3: API 통일 (1주)
  ↓
Phase 4: 상태관리 (1주)
  ↓
Phase 5: Admin UI (2-3주, 선택)
```

**우선순위**: Phase 1 > Phase 2 > Phase 3 = Phase 4 > Phase 5

---

## Phase 1: UI 컴포넌트 시스템

### What: Radix UI 50+ 컴포넌트

Live Commerce의 완성된 UI 컴포넌트 세트를 그대로 복사합니다.

**컴포넌트 목록**:

```
Accordion, AlertDialog, Avatar, Badge, Button, Calendar,
Card, Carousel, Checkbox, Collapsible, Command, ContextMenu,
Dialog, Drawer, DropdownMenu, Form, HoverCard, Input,
InputOTP, Label, Menubar, NavigationMenu, Pagination, Popover,
Progress, RadioGroup, Resizable, ScrollArea, Select, Separator,
Sheet, Sidebar, Skeleton, Slider, Switch, Table, Tabs,
Textarea, Toggle, ToggleGroup, Tooltip, utils, use-mobile
```

### Where From → Where To

```
Live Commerce:
  src/app/components/ui/*.tsx

Doremi:
  client-app/src/components/ui/*.tsx (신규 폴더)
```

### How: 구현 단계

#### 1️⃣ 의존성 확인 & 추가

```bash
# 현재 package.json 확인
cd client-app
npm ls @radix-ui/react-core  # 이미 있는지 확인

# 필요한 패키지 확인
npm ls @emotion/react @emotion/styled
npm ls lucide-react
```

**Doremi package.json에 추가할 의존성** (Live Commerce를 참고하되, 호환성 확인):

```json
{
  "dependencies": {
    "@radix-ui/react-accordion": "^1.2.x",
    "@radix-ui/react-alert-dialog": "^1.1.x",
    "@radix-ui/react-avatar": "^1.1.x",
    "@radix-ui/react-badge": "^1.1.x",
    "@radix-ui/react-button": "^1.1.x",
    "@radix-ui/react-calendar": "^1.1.x",
    "@radix-ui/react-card": "^1.1.x",
    "@radix-ui/react-carousel": "^1.1.x",
    "@radix-ui/react-checkbox": "^1.1.x",
    "@radix-ui/react-collapsible": "^1.1.x",
    "@radix-ui/react-command": "^1.1.x",
    "@radix-ui/react-context-menu": "^2.2.x",
    "@radix-ui/react-dialog": "^1.1.x",
    "@radix-ui/react-drawer": "^1.1.x",
    "@radix-ui/react-dropdown-menu": "^2.1.x",
    "@radix-ui/react-hover-card": "^1.1.x",
    "@radix-ui/react-label": "^2.1.x",
    "@radix-ui/react-menubar": "^1.1.x",
    "@radix-ui/react-navigation-menu": "^1.2.x",
    "@radix-ui/react-pagination": "^1.1.x",
    "@radix-ui/react-popover": "^1.1.x",
    "@radix-ui/react-progress": "^1.1.x",
    "@radix-ui/react-radio-group": "^1.2.x",
    "@radix-ui/react-scroll-area": "^1.2.x",
    "@radix-ui/react-select": "^2.1.x",
    "@radix-ui/react-separator": "^1.1.x",
    "@radix-ui/react-slider": "^1.2.x",
    "@radix-ui/react-slot": "^1.1.x",
    "@radix-ui/react-switch": "^1.1.x",
    "@radix-ui/react-tabs": "^1.1.x",
    "@radix-ui/react-toggle": "^1.1.x",
    "@radix-ui/react-toggle-group": "^1.1.x",
    "@radix-ui/react-tooltip": "^1.1.x",
    "class-variance-authority": "^0.7.x",
    "clsx": "^2.1.x",
    "lucide-react": "^0.487.x"
  }
}
```

#### 2️⃣ 호환성 테스트

```bash
# 1. 의존성 설치
npm install

# 2. 빌드 테스트
npm run build

# 3. 번들 사이즈 확인
npm run analyze  # (next-bundle-analyzer 설정 필요)

# 4. 런타임 테스트
npm run dev
# 브라우저에서 컴포넌트 페이지 열기
```

**호환성 체크 항목**:

- ✅ React 19 + Radix UI 최신 호환 여부
- ✅ TailwindCSS 4.0과 스타일 호환
- ✅ TypeScript 빌드 에러 없음
- ✅ 번들 사이즈 증가 <50KB (gzip)

#### 3️⃣ 컴포넌트 복사

```bash
# Live Commerce의 ui 폴더 전체 복사
cp -r "/path/to/Live Commerce/src/app/components/ui/*" \
      "client-app/src/components/ui/"

# 확인
ls client-app/src/components/ui/
# 50+ 파일이 보여야 함
```

#### 4️⃣ 스타일 통일

```bash
# Tailwind CSS 설정 확인
cat client-app/tailwind.config.ts

# Live Commerce와 동일한 색상/테마 적용 확인
# client-app/src/styles/globals.css에 필요시 추가
```

**Doremi 컬러 확인**:

- Primary: Hot Pink (#FF1493) ✅ (이미 설정됨)
- Background: Dark (#0a0a0a) ✅
- Text: White/Gray ✅

→ 충돌 없음!

#### 5️⃣ 검증

```typescript
// client-app/src/components/ui-demo.tsx (임시)
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';

export default function UIDemo() {
  return (
    <div className="space-y-4 p-8">
      <Button>Primary Button</Button>
      <Card>Card Component</Card>
      <Dialog>Dialog Component</Dialog>
      {/* 모든 컴포넌트 테스트 */}
    </div>
  );
}
```

### Effort & Timeline

| 작업          | 시간        |
| ------------- | ----------- |
| 의존성 추가   | 30분        |
| 호환성 테스트 | 1시간       |
| 컴포넌트 복사 | 30분        |
| 스타일 통일   | 1시간       |
| 검증 & 테스트 | 2-3시간     |
| **합계**      | **5-6시간** |

**예상 완료**: 1일 (또는 1주의 절반)

### Risk & Mitigation

| 위험                 | 확률 | 영향 | 완화 방법                                   |
| -------------------- | ---- | ---- | ------------------------------------------- |
| npm 호환성 충돌      | 중간 | 높음 | CI에서 먼저 테스트, npm ci 사용             |
| 번들 사이즈 폭증     | 낮음 | 중간 | Tree-shaking 설정, 필요한 컴포넌트만 import |
| Tailwind 스타일 충돌 | 낮음 | 중간 | Tailwind config 통일, 프리플릭스 사용       |
| TypeScript 에러      | 낮음 | 낮음 | 타입 수정 후 빌드                           |

---

## Phase 2: 홈페이지 컴포넌트

### What: 9개 홈페이지 섹션 컴포넌트

Live Commerce의 홈페이지 컴포넌트를 Doremi의 Next.js 구조에 맞게 변환합니다.

**컴포넌트**:

1. `Header.tsx` — 공통 헤더 (검색, 알림, 마이페이지)
2. `Footer.tsx` — 공통 푸터
3. `LiveBanner.tsx` — 현재 라이브 배너 (Hero section)
4. `LiveExclusiveDeals.tsx` — 라이브 특가 상품 (3개)
5. `UpcomingLives.tsx` — 예정된 라이브 (캐러셀)
6. `PopularProducts.tsx` — 인기 상품 (8개)
7. `ProductDetailModal.tsx` — 상품 상세 모달
8. `HostCuration.tsx` — 호스트 큐레이션 (선택)
9. `EventBanner.tsx` — 이벤트 배너 (선택)

### Where From → Where To

```
Live Commerce:
  src/app/components/*.tsx (9개 파일)

Doremi:
  client-app/src/components/home/*.tsx (신규 폴더)
  client-app/src/app/page.tsx 에 통합
```

### How: 구현 단계

#### 1️⃣ Header.tsx 변환

**Live Commerce 원본**:

```typescript
import { useNavigate } from 'react-router';
// React Router 기반 라우팅
```

**Doremi 변환**:

```typescript
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function Header() {
  const router = useRouter();

  // 링크 변환
  // navigate('/search') → router.push('/search')
  // <Link to="/my-page"> → <Link href="/my-page">

  return (
    <header className="fixed top-0 z-50 w-full bg-black border-b border-white/10">
      {/* Doremi 기존 Header 구조 유지 */}
      {/* Logo, Search, Notifications, MyPage */}
    </header>
  );
}
```

**주의**:

- Doremi의 기존 Header가 있는지 확인 (`client-app/src/components/Header.tsx`)
- 있으면: Live Commerce의 UI 컴포넌트만 가져와서 기존 로직에 적용
- 없으면: Live Commerce 버전 전체 복사 후 라우팅만 수정

#### 2️⃣ LiveBanner.tsx 변환

**Live Commerce 원본**:

```typescript
interface LiveBannerProps {
  liveStream?: LiveStream | null;
  onJoinLive?: (liveId: number) => void;
}

export function LiveBanner({ liveStream, onJoinLive }: LiveBannerProps) {
  const navigate = useNavigate();

  return (
    <div>
      {liveStream ? (
        <>Live 진행 중</>
      ) : (
        <>진행 중인 라이브 없음</>
      )}
    </div>
  );
}
```

**Doremi 변환**:

```typescript
'use client';

import Link from 'next/link';
import { useCurrentLive } from '@/lib/hooks/queries/use-streams';  // TanStack Query 훅

export function LiveBanner() {
  const { data: currentLive, isLoading } = useCurrentLive();

  if (isLoading) return <LiveBannerSkeleton />;

  return (
    <div className="relative w-full h-96 bg-gradient-to-r from-pink-500 to-pink-600">
      {currentLive ? (
        <>
          <div className="absolute inset-0 bg-black/30"></div>
          <div className="flex flex-col justify-center items-center h-full text-white">
            <h1 className="text-4xl font-bold mb-4">{currentLive.title}</h1>
            <p className="text-lg mb-6">{currentLive.viewers} 명 시청 중</p>
            <Link
              href={`/live/${currentLive.streamKey}`}
              className="px-8 py-3 bg-pink-500 rounded-lg font-bold hover:bg-pink-600"
            >
              지금 입장하기
            </Link>
          </div>
        </>
      ) : (
        <div className="flex flex-col justify-center items-center h-full text-white text-center">
          <h2 className="text-2xl font-bold mb-4">진행 중인 라이브가 없습니다</h2>
          <p className="text-gray-400 mb-6">예정된 라이브를 확인해보세요</p>
          <button
            onClick={() => document.getElementById('upcoming-lives')?.scrollIntoView()}
            className="px-6 py-2 border border-white rounded-lg hover:bg-white/10"
          >
            예정 라이브 보기
          </button>
        </div>
      )}
    </div>
  );
}
```

**주요 변환**:

- `navigate()` → `router.push()` 또는 `<Link href={}>`
- Props 제거: TanStack Query 훅에서 데이터 직접 가져옴
- API 경로: `GET /api/live/current` → `GET /api/streaming/active` (다음 Phase에서 통일)

#### 3️⃣ LiveExclusiveDeals.tsx 변환

**구조**:

```typescript
export function LiveExclusiveDeals() {
  const { data: liveDeals, isLoading } = useLiveDeals();  // 신규 훅 필요
  const { modals, openModal } = useMainPageStore();

  return (
    <section className="py-12 px-4 bg-black">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold mb-8">방송 한정 특가</h2>

        {/* 카운트다운 타이머 */}
        <LiveTimer dealEndTime={liveDeals[0]?.dealEndTime} />

        {/* 상품 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {liveDeals?.map(deal => (
            <ProductCard
              key={deal.id}
              product={deal}
              onClick={() => openModal('productDetail', deal)}
            />
          ))}
        </div>

        {/* 모달 */}
        {modals.productDetail && (
          <ProductDetailModal
            product={selectedProduct}
            onClose={() => closeModal('productDetail')}
          />
        )}
      </div>
    </section>
  );
}
```

**필요한 것**:

- `useLiveDeals()` 훅 (Phase 4에서 구현)
- `useMainPageStore()` Zustand (Phase 4에서 구현)
- `ProductDetailModal` 컴포넌트

#### 4️⃣ UpcomingLives.tsx 변환

**구조**: 캐러셀 (Embla Carousel 사용, 이미 Doremi에서 사용 중)

```typescript
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';

export function UpcomingLives() {
  const { data: upcomingLives } = useUpcomingLives();  // 신규 훅

  return (
    <section className="py-12 bg-black">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-3xl font-bold mb-8">예정된 라이브</h2>

        <Carousel>
          <CarouselContent>
            {upcomingLives?.map(live => (
              <CarouselItem key={live.id} className="md:basis-1/3">
                <UpcomingLiveCard
                  live={live}
                  onNotificationToggle={handleNotificationToggle}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </section>
  );
}

function UpcomingLiveCard({ live, onNotificationToggle }) {
  const [isSettingNotification, setIsSettingNotification] = useState(false);

  const handleNotification = async () => {
    setIsSettingNotification(true);
    // POST /api/live/notifications/{liveId}
    // (Phase 3에서 백엔드 구현)
    setIsSettingNotification(false);
  };

  return (
    <Card className="bg-white/5 border-white/10 hover:border-pink-500">
      <CardContent className="p-4">
        <img src={live.thumbnail} className="w-full h-48 object-cover rounded" />
        <h3 className="mt-4 font-bold">{live.title}</h3>
        <p className="text-sm text-gray-400 mt-2">
          {new Date(live.scheduledAt).toLocaleString()}
        </p>
        <Button
          variant="outline"
          onClick={handleNotification}
          disabled={isSettingNotification}
          className="w-full mt-4"
        >
          {isSettingNotification ? '설정 중...' : '알림 받기'}
        </Button>
      </CardContent>
    </Card>
  );
}
```

#### 5️⃣ PopularProducts.tsx 변환

```typescript
export function PopularProducts() {
  const { data: popularProducts } = usePopularProducts();  // 신규 훅

  return (
    <section className="py-12 bg-black">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-3xl font-bold mb-8">인기 상품</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {popularProducts?.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onClick={() => openProductDetail(product)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductCard({ product, onClick }) {
  const [isLiking, setIsLiking] = useState(false);

  const handleLike = async (e) => {
    e.stopPropagation();
    setIsLiking(true);
    // POST /api/products/{productId}/like
    setIsLiking(false);
  };

  return (
    <div
      onClick={onClick}
      className="cursor-pointer group"
    >
      <div className="relative aspect-square overflow-hidden rounded">
        <img
          src={product.image}
          className="w-full h-full object-cover group-hover:scale-110 transition"
        />
        <button
          onClick={handleLike}
          disabled={isLiking}
          className="absolute top-2 right-2 p-2 bg-black/50 rounded-full"
        >
          {product.isLiked ? '♥️' : '🤍'}
        </button>
      </div>
      <h3 className="mt-2 font-bold truncate">{product.name}</h3>
      <p className="text-sm text-red-500">
        {product.discount}% <span className="line-through text-gray-400">₩{product.originalPrice}</span>
      </p>
      <p className="text-lg font-bold">₩{product.price}</p>
    </div>
  );
}
```

#### 6️⃣ ProductDetailModal.tsx 변환

Live Commerce의 모달을 그대로 사용하되, 다음만 수정:

```typescript
export function ProductDetailModal({ product, onClose }) {
  const [selectedOptions, setSelectedOptions] = useState({
    size: null,
    color: null,
    quantity: 1,
  });

  const handleAddToCart = async () => {
    // POST /api/cart
    // productId, quantity, size?, color?
    const response = await api.post('/api/cart', {
      productId: product.id,
      quantity: selectedOptions.quantity,
      size: selectedOptions.size,
      color: selectedOptions.color,
    });

    toast.success('장바구니에 추가되었습니다');
    onClose();
  };

  const handleLike = async () => {
    // POST /api/products/{productId}/like
    await api.post(`/api/products/${product.id}/like`, {
      isLiked: !product.isLiked,
    });
  };

  return (
    <Dialog open={!!product} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        {/* 이미지 갤러리 */}
        <div className="grid grid-cols-2 gap-4">
          {/* 왼쪽: 이미지 */}
          {/* 오른쪽: 정보 */}
          <div>
            <h2 className="text-2xl font-bold mb-2">{product.name}</h2>
            <p className="text-red-500 text-lg mb-4">
              {product.discount}% OFF
            </p>

            {/* 사이즈/컬러 선택 */}
            <div className="space-y-4">
              {product.sizes && (
                <div>
                  <label>사이즈</label>
                  <div className="flex gap-2">
                    {product.sizes.map(size => (
                      <button
                        key={size.size}
                        className={`px-4 py-2 border rounded ${
                          selectedOptions.size === size.size
                            ? 'border-pink-500 bg-pink-500/10'
                            : 'border-white/20'
                        }`}
                        onClick={() => setSelectedOptions({...selectedOptions, size: size.size})}
                      >
                        {size.size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {product.colors && (
                <div>
                  <label>컬러</label>
                  <div className="flex gap-2">
                    {product.colors.map(color => (
                      <button
                        key={color.color}
                        className={`px-4 py-2 border rounded ${
                          selectedOptions.color === color.color
                            ? 'border-pink-500 bg-pink-500/10'
                            : 'border-white/20'
                        }`}
                        onClick={() => setSelectedOptions({...selectedOptions, color: color.color})}
                      >
                        {color.color}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 수량 */}
              <div>
                <label>수량</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={selectedOptions.quantity}
                  onChange={(e) => setSelectedOptions({...selectedOptions, quantity: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded"
                />
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={handleLike}
                className="flex-1"
              >
                {product.isLiked ? '❤️ 찜됨' : '🤍 찜하기'}
              </Button>
              <Button
                onClick={handleAddToCart}
                className="flex-1 bg-pink-500 hover:bg-pink-600"
              >
                장바구니 추가
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

#### 7️⃣ 홈페이지 통합 (page.tsx)

```typescript
// client-app/src/app/page.tsx

'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { LiveBanner } from '@/components/home/LiveBanner';
import { LiveExclusiveDeals } from '@/components/home/LiveExclusiveDeals';
import { UpcomingLives } from '@/components/home/UpcomingLives';
import { PopularProducts } from '@/components/home/PopularProducts';

export default function HomePage() {
  return (
    <>
      <Header />

      <main className="min-h-screen bg-black">
        {/* 1. 라이브 배너 */}
        <LiveBanner />

        {/* 2. 라이브 특가 상품 */}
        <LiveExclusiveDeals />

        {/* 3. 예정된 라이브 */}
        <section id="upcoming-lives">
          <UpcomingLives />
        </section>

        {/* 4. 인기 상품 */}
        <PopularProducts />
      </main>

      <Footer />
    </>
  );
}
```

### Effort & Timeline

| 작업                    | 시간          |
| ----------------------- | ------------- |
| Header 변환             | 1-2시간       |
| LiveBanner 변환         | 2시간         |
| LiveExclusiveDeals 변환 | 3시간         |
| UpcomingLives 변환      | 2시간         |
| PopularProducts 변환    | 2시간         |
| ProductDetailModal 변환 | 3시간         |
| 통합 & 테스트           | 3-4시간       |
| **합계**                | **16-19시간** |

**예상 완료**: 2-3일

### Risk & Mitigation

| 위험                 | 확률 | 영향 | 완화                                      |
| -------------------- | ---- | ---- | ----------------------------------------- |
| API 응답 구조 불일치 | 높음 | 높음 | Phase 3에서 먼저 API 통합                 |
| 스타일 차이          | 중간 | 중간 | Live Commerce 스타일 참고 + Tailwind 수정 |
| 라우팅 오류          | 낮음 | 낮음 | E2E 테스트로 모든 링크 확인               |
| 성능 저하            | 낮음 | 중간 | 이미지 최적화, 코드 스플리팅              |

---

## Phase 3: API & 타입 통합

### What: API 경로 통일 + 타입 확장

Live Commerce의 API 스펙을 Doremi 백엔드에 구현하고, 타입을 공유 타입으로 정의합니다.

### 현재 Doremi API vs Live Commerce API

| 기능        | Doremi 현재                   | Live Commerce                          | 통일 후 권장                             |
| ----------- | ----------------------------- | -------------------------------------- | ---------------------------------------- |
| 현재 라이브 | `GET /api/streaming/active`   | `GET /api/live/current`                | `/api/live/current` (신규)               |
| 라이브 특가 | ❌ 없음                       | `GET /api/live/deals?liveId=`          | `/api/live/deals` (신규)                 |
| 예정 라이브 | `GET /api/streaming/upcoming` | `GET /api/live/upcoming?limit=`        | `/api/live/upcoming` (동명 추가)         |
| 인기 상품   | `GET /api/products/featured`  | `GET /api/products/popular`            | `/api/products/popular` (신규)           |
| 상품 상세   | `GET /api/products/:id`       | `GET /api/products/:id`                | ✅ 이미 동일                             |
| 알림 설정   | ❌ 없음                       | `POST /api/live/notifications/:liveId` | `/api/live/notifications/:liveId` (신규) |
| 찜하기      | ❌ 없음                       | `POST /api/products/:id/like`          | `/api/products/:id/like` (신규)          |

### Backend 구현 (NestJS)

#### 1️⃣ Live 컨트롤러 신규 생성

```typescript
// backend/src/modules/live/live.controller.ts

import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { LiveService } from './live.service';

@ApiTags('Live')
@Controller('live')
export class LiveController {
  constructor(private readonly liveService: LiveService) {}

  @Get('current')
  @Public()
  @ApiOperation({ summary: '현재 진행 중인 라이브 조회' })
  @ApiResponse({ status: 200, description: 'LiveStream | null' })
  async getCurrentLive() {
    // streaming.service.ts의 현재 LIVE 스트림 조회
    return this.liveService.getCurrentLive();
  }

  @Get('deals')
  @Public()
  @ApiOperation({ summary: '라이브 특가 상품 조회' })
  @ApiResponse({ status: 200, description: 'LiveDeal[]' })
  async getLiveDeals(@Query('liveId') liveId?: string, @Query('limit') limit: number = 10) {
    // 현재 LIVE 스트림의 상품 조회
    // 또는 특정 liveId의 상품 조회
    return this.liveService.getLiveDeals(liveId, limit);
  }

  @Get('upcoming')
  @Public()
  @ApiOperation({ summary: '예정된 라이브 조회' })
  @ApiResponse({ status: 200, description: 'LiveStream[]' })
  async getUpcomingLives(@Query('limit') limit: number = 6, @Query('offset') offset: number = 0) {
    // streaming.service.ts의 PENDING 스트림 조회 + 정렬
    return this.liveService.getUpcomingLives(limit, offset);
  }

  @Post('notifications/:liveId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '라이브 알림 설정' })
  async setLiveNotification(
    @Param('liveId') liveId: string,
    @Body() { enabled, notifyBefore }: { enabled: boolean; notifyBefore?: number },
    @CurrentUser('id') userId: string,
  ) {
    // LiveNotification 테이블에 저장 (Prisma에 추가 필요)
    return this.liveService.setLiveNotification(userId, liveId, enabled, notifyBefore);
  }
}
```

**필요한 추가 DB 모델**:

```prisma
// backend/prisma/schema.prisma에 추가

model LiveNotification {
  id          String   @id @default(cuid())
  userId      String
  liveId      String
  enabled     Boolean  @default(true)
  notifyBefore Int    @default(30)  // 분
  scheduledTime DateTime
  notificationTime DateTime

  user    User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  live    LiveStream @relation(fields: [liveId], references: [id], onDelete: Cascade)

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([userId, liveId])
}

// 기존 LiveStream 모델에 추가
model LiveStream {
  // ... 기존 필드
  notifications LiveNotification[]
}

// 기존 User 모델에 추가
model User {
  // ... 기존 필드
  liveNotifications LiveNotification[]
}
```

#### 2️⃣ Products 컨트롤러 확장

```typescript
// backend/src/modules/products/products.controller.ts에 추가

@Get('popular')
@Public()
@ApiOperation({ summary: '인기 상품 조회' })
@ApiResponse({ status: 200, description: 'Product[]' })
async getPopularProducts(
  @Query('limit') limit: number = 8,
  @Query('period') period: 'week' | 'month' | 'all' = 'week',
) {
  // OrderItem의 판매 수량 기반으로 정렬
  // 또는 해당 기간의 주문에서 가장 많이 팔린 상품 조회
  return this.productsService.getPopularProducts(limit, period);
}
```

#### 3️⃣ Products 컨트롤러에 찜하기 추가

```typescript
// backend/src/modules/products/products.controller.ts에 추가

@Post(':id/like')
@UseGuards(JwtAuthGuard)
@ApiOperation({ summary: '상품 찜하기 / 찜 해제' })
async toggleProductLike(
  @Param('id') productId: string,
  @Body() { isLiked }: { isLiked: boolean },
  @CurrentUser('id') userId: string,
) {
  // UserLikedProduct 테이블 생성 필요
  return this.productsService.toggleProductLike(userId, productId, isLiked);
}

@Get(':id')
@Public()
@ApiOperation({ summary: '상품 상세 조회' })
async getProduct(@Param('id') productId: string) {
  // 응답에 isLiked 필드 추가 (현재 사용자가 찜했는지)
  // @CurrentUser('id') userId?: string 로 선택적으로 처리
  return this.productsService.getProduct(productId);
}
```

**필요한 추가 DB 모델**:

```prisma
model UserLikedProduct {
  id        String   @id @default(cuid())
  userId    String
  productId String

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([userId, productId])
}

// 기존 User 모델에 추가
model User {
  // ... 기존 필드
  likedProducts UserLikedProduct[]
}

// 기존 Product 모델에 추가
model Product {
  // ... 기존 필드
  likedByUsers UserLikedProduct[]
}
```

#### 4️⃣ Prisma 마이그레이션

```bash
cd backend

# 스키마 변경 후 마이그레이션 생성
npx prisma migrate dev --name add_live_notifications_and_likes

# 또는 프로덕션 환경
npx prisma migrate deploy
```

### Frontend: 타입 확장

#### 1️⃣ shared-types 확장

```typescript
// packages/shared-types/src/index.ts에 추가

// Enums
export enum LiveStatus {
  PENDING = 'pending',
  LIVE = 'live',
  OFFLINE = 'offline',
}

// Types
export interface LiveStream {
  id: string;
  streamKey: string;
  title: string;
  description?: string;
  status: LiveStatus;
  thumbnail?: string;
  hostId: string;
  hostName: string;
  hostProfile?: string;
  startTime?: string;
  endTime?: string;
  scheduledAt?: string;
  viewers: number;
  peakViewers: number;
  streamUrl?: string;
  chatEnabled: boolean;
  isNotificationSet?: boolean; // 알림 설정 여부
}

export interface LiveDeal extends Product {
  livePrice: number;
  dealEndTime?: string;
}

export interface Host {
  id: string;
  name: string;
  profileImage?: string;
  bio?: string;
  followerCount: number;
  totalLives: number;
  rating: number;
  specialties?: string[];
  isFollowing?: boolean;
}

export interface LiveNotification {
  liveId: string;
  notificationEnabled: boolean;
  notifyBefore: number;
  scheduledTime: string;
  notificationTime: string;
}

// API DTOs
export interface GetCurrentLiveResponse extends ApiResponse<LiveStream | null> {}

export interface GetLiveDealsResponse extends ApiResponse<{
  liveId: string;
  liveTitle: string;
  deals: LiveDeal[];
  totalCount: number;
}> {}

export interface GetUpcomingLivesResponse extends ApiResponse<{
  lives: LiveStream[];
  totalCount: number;
  hasMore: boolean;
}> {}

export interface GetPopularProductsResponse extends ApiResponse<{
  products: Product[];
  totalCount: number;
}> {}

export interface SetLiveNotificationRequest {
  enabled: boolean;
  notifyBefore?: number;
}

export interface SetLiveNotificationResponse extends ApiResponse<LiveNotification> {}

export interface ToggleLikeRequest {
  isLiked: boolean;
}

export interface ToggleLikeResponse extends ApiResponse<{
  productId: string;
  isLiked: boolean;
  totalLikes: number;
}> {}
```

#### 2️⃣ Frontend 타입 확장

```typescript
// client-app/src/lib/types/home.ts (신규)

import { LiveStream, LiveDeal, Product, Host } from '@live-commerce/shared-types';

export interface HomePageState {
  // 라이브
  currentLive: {
    data: LiveStream | null;
    isLoading: boolean;
    error: string | null;
  };

  // 특가 상품
  liveDeals: {
    data: LiveDeal[];
    isLoading: boolean;
    error: string | null;
    dealEndTime?: string;
  };

  // 예정 라이브
  upcomingLives: {
    data: LiveStream[];
    isLoading: boolean;
    error: string | null;
    totalCount: number;
    hasMore: boolean;
  };

  // 인기 상품
  popularProducts: {
    data: Product[];
    isLoading: boolean;
    error: string | null;
    totalCount: number;
  };

  // UI 상태
  selectedProduct: Product | null;
  modals: {
    productDetail: boolean;
    viewAllDeals: boolean;
    viewAllUpcoming: boolean;
    viewAllPopular: boolean;
  };

  // 사용자 상호작용
  likedProducts: Set<string>;
  notifiedLives: Set<string>;

  // 타이머
  dealTimer: {
    hours: number;
    minutes: number;
    seconds: number;
    isActive: boolean;
  };
}
```

### Effort & Timeline

| 작업                  | 시간         |
| --------------------- | ------------ |
| Live 컨트롤러 구현    | 2-3시간      |
| Products 확장         | 1-2시간      |
| DB 마이그레이션       | 1시간        |
| shared-types 업데이트 | 1시간        |
| Frontend 타입 추가    | 1시간        |
| 통합 테스트           | 2시간        |
| **합계**              | **8-10시간** |

**예상 완료**: 1주 (백엔드 1-2일 + 프론트엔드 1일 + 통합 2-3일)

---

## Phase 4: 상태관리 & 훅

### What: Zustand store + TanStack Query 훅

Live Commerce의 상태 설계를 Doremi의 패턴으로 구현합니다.

### How: 구현 단계

#### 1️⃣ Zustand Store (UI 상태)

```typescript
// client-app/src/lib/store/home.ts (신규)

import { create } from 'zustand';
import { HomePageState } from '@/lib/types/home';

export const useHomeStore = create<HomePageState & HomePageActions>((set) => ({
  // 초기 상태
  currentLive: { data: null, isLoading: false, error: null },
  liveDeals: { data: [], isLoading: false, error: null },
  upcomingLives: { data: [], isLoading: false, error: null, totalCount: 0, hasMore: false },
  popularProducts: { data: [], isLoading: false, error: null, totalCount: 0 },

  selectedProduct: null,
  modals: {
    productDetail: false,
    viewAllDeals: false,
    viewAllUpcoming: false,
    viewAllPopular: false,
  },

  likedProducts: new Set(),
  notifiedLives: new Set(),

  dealTimer: {
    hours: 0,
    minutes: 0,
    seconds: 0,
    isActive: false,
  },

  // 액션
  openModal: (modal: string, product?: Product) =>
    set((state) => ({
      ...state,
      modals: { ...state.modals, [modal]: true },
      selectedProduct: product || state.selectedProduct,
    })),

  closeModal: (modal: string) =>
    set((state) => ({
      ...state,
      modals: { ...state.modals, [modal]: false },
      selectedProduct: modal === 'productDetail' ? null : state.selectedProduct,
    })),

  setCurrentLive: (live) =>
    set((state) => ({
      ...state,
      currentLive: { data: live, isLoading: false, error: null },
    })),

  setLiveDeals: (deals) =>
    set((state) => ({
      ...state,
      liveDeals: { data: deals, isLoading: false, error: null },
    })),

  setUpcomingLives: (lives, totalCount, hasMore) =>
    set((state) => ({
      ...state,
      upcomingLives: { data: lives, isLoading: false, error: null, totalCount, hasMore },
    })),

  setPopularProducts: (products, totalCount) =>
    set((state) => ({
      ...state,
      popularProducts: { data: products, isLoading: false, error: null, totalCount },
    })),

  toggleLikedProduct: (productId: string) =>
    set((state) => {
      const newLiked = new Set(state.likedProducts);
      if (newLiked.has(productId)) {
        newLiked.delete(productId);
      } else {
        newLiked.add(productId);
      }
      return { likedProducts: newLiked };
    }),

  toggleNotifiedLive: (liveId: string) =>
    set((state) => {
      const newNotified = new Set(state.notifiedLives);
      if (newNotified.has(liveId)) {
        newNotified.delete(liveId);
      } else {
        newNotified.add(liveId);
      }
      return { notifiedLives: newNotified };
    }),

  updateDealTimer: (hours, minutes, seconds) =>
    set((state) => ({
      dealTimer: { hours, minutes, seconds, isActive: hours > 0 || minutes > 0 || seconds > 0 },
    })),
}));

interface HomePageActions {
  openModal: (modal: string, product?: Product) => void;
  closeModal: (modal: string) => void;
  setCurrentLive: (live: LiveStream | null) => void;
  setLiveDeals: (deals: LiveDeal[]) => void;
  setUpcomingLives: (lives: LiveStream[], totalCount: number, hasMore: boolean) => void;
  setPopularProducts: (products: Product[], totalCount: number) => void;
  toggleLikedProduct: (productId: string) => void;
  toggleNotifiedLive: (liveId: string) => void;
  updateDealTimer: (hours: number, minutes: number, seconds: number) => void;
}
```

#### 2️⃣ TanStack Query 훅

```typescript
// client-app/src/lib/hooks/queries/use-live.ts (신규)

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { LiveStream, LiveDeal } from '@live-commerce/shared-types';

// Query Keys
export const liveQueryKeys = {
  all: ['live'] as const,
  current: () => [...liveQueryKeys.all, 'current'] as const,
  deals: (liveId?: string) => [...liveQueryKeys.all, 'deals', liveId] as const,
  upcoming: (limit?: number) => [...liveQueryKeys.all, 'upcoming', limit] as const,
  popular: (limit?: number) => [...liveQueryKeys.all, 'popular', limit] as const,
};

// Queries
export function useCurrentLive() {
  return useQuery({
    queryKey: liveQueryKeys.current(),
    queryFn: async () => {
      const { data } = await api.get<LiveStream | null>('/api/live/current');
      return data;
    },
    staleTime: 60 * 1000, // 1분
    refetchInterval: 30 * 1000, // 30초마다 자동 갱신
  });
}

export function useLiveDeals(liveId?: string) {
  return useQuery({
    queryKey: liveQueryKeys.deals(liveId),
    queryFn: async () => {
      const { data } = await api.get<{ deals: LiveDeal[] }>('/api/live/deals', {
        params: { liveId, limit: 10 },
      });
      return data.deals;
    },
    staleTime: 30 * 1000, // 30초
    refetchInterval: 30 * 1000,
  });
}

export function useUpcomingLives(limit = 6) {
  return useQuery({
    queryKey: liveQueryKeys.upcoming(limit),
    queryFn: async () => {
      const { data } = await api.get('/api/live/upcoming', {
        params: { limit },
      });
      return data.lives;
    },
    staleTime: 5 * 60 * 1000, // 5분
  });
}

export function usePopularProducts(limit = 8) {
  return useQuery({
    queryKey: liveQueryKeys.popular(limit),
    queryFn: async () => {
      const { data } = await api.get('/api/products/popular', {
        params: { limit },
      });
      return data.products;
    },
    staleTime: 10 * 60 * 1000, // 10분
  });
}

// Mutations
export function useSetLiveNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      liveId,
      enabled,
      notifyBefore,
    }: {
      liveId: string;
      enabled: boolean;
      notifyBefore?: number;
    }) => {
      const { data } = await api.post(`/api/live/notifications/${liveId}`, {
        enabled,
        notifyBefore,
      });
      return data;
    },
    onSuccess: (data, variables) => {
      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: liveQueryKeys.upcoming(),
      });
    },
  });
}

export function useToggleProductLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, isLiked }: { productId: string; isLiked: boolean }) => {
      const { data } = await api.post(`/api/products/${productId}/like`, {
        isLiked,
      });
      return data;
    },
    onSuccess: () => {
      // 모든 상품 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: liveQueryKeys.popular(),
      });
      queryClient.invalidateQueries({
        queryKey: liveQueryKeys.deals(),
      });
    },
  });
}
```

#### 3️⃣ 컴포넌트에서 사용

```typescript
// client-app/src/components/home/LiveExclusiveDeals.tsx

'use client';

import { useEffect } from 'react';
import { useLiveDeals, useToggleProductLike } from '@/lib/hooks/queries/use-live';
import { useHomeStore } from '@/lib/store/home';

export function LiveExclusiveDeals() {
  const { data: deals, isLoading } = useLiveDeals();
  const { openModal, likedProducts } = useHomeStore();
  const { mutate: toggleLike } = useToggleProductLike();

  // 타이머 설정
  useEffect(() => {
    if (!deals || deals.length === 0) return;

    const interval = setInterval(() => {
      const endTime = new Date(deals[0].dealEndTime).getTime();
      const now = Date.now();
      const diff = endTime - now;

      if (diff <= 0) {
        clearInterval(interval);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      useHomeStore.setState((state) => ({
        dealTimer: { hours, minutes, seconds, isActive: true },
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [deals]);

  if (isLoading) return <LiveBannerSkeleton />;

  return (
    <section className="py-12 bg-black">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-3xl font-bold mb-8">방송 한정 특가</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {deals?.map((deal) => (
            <div
              key={deal.id}
              className="bg-white/5 border border-white/10 rounded-lg overflow-hidden cursor-pointer hover:border-pink-500 transition"
              onClick={() => openModal('productDetail', deal)}
            >
              <img
                src={deal.image}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h3 className="font-bold mb-2">{deal.name}</h3>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-red-500 font-bold">{deal.discount}%</span>
                  <span className="line-through text-gray-400 text-sm">
                    ₩{deal.originalPrice}
                  </span>
                </div>
                <p className="text-lg font-bold mb-4">₩{deal.price}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike({ productId: deal.id, isLiked: !likedProducts.has(deal.id) });
                  }}
                  className="w-full py-2 border border-white/20 rounded hover:border-pink-500"
                >
                  {likedProducts.has(deal.id) ? '❤️ 찜됨' : '🤍 찜하기'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

### Effort & Timeline

| 작업                   | 시간      |
| ---------------------- | --------- |
| Zustand Store 구현     | 2시간     |
| TanStack Query 훅 작성 | 3시간     |
| 컴포넌트 통합          | 2시간     |
| 테스트                 | 1시간     |
| **합계**               | **8시간** |

**예상 완료**: 1-2일

---

## Phase 5: Admin 페이지 (선택)

### What: Admin UI 개선

Live Commerce의 Admin 레이아웃을 참고하여 Doremi Admin 페이지를 개선합니다.

**작업 영역**:

- Admin Sidebar 및 Header 디자인
- Dashboard 통계 차트
- 테이블 UI 개선 (Product, Order, User)
- 필터 & 검색 UI

**예상 작업량**: 2-3주 (선택사항이므로 Phase 1-4 완료 후)

---

## 리스크 & 완화

### 1. 의존성 호환성

| 위험                        | 확률 | 완화                        |
| --------------------------- | ---- | --------------------------- |
| React 19 + Radix UI 호환    | 중간 | 테스트 빌드 먼저, 버전 명시 |
| TailwindCSS 4.0 스타일 충돌 | 낮음 | Tailwind config 통일        |
| npm 중복 설치               | 낮음 | npm dedupe                  |

**해결 방법**:

```bash
npm install  # 자동 호환성 해결
npm ls       # 중복 확인
npm dedupe   # 최적화
npm audit    # 보안 검토
```

### 2. API 경로 혼동

| 위험                          | 확률 | 완화                            |
| ----------------------------- | ---- | ------------------------------- |
| 프론트엔드가 잘못된 경로 호출 | 높음 | API 문서 먼저, 백엔드 구현 먼저 |
| 기존 코드와 충돌              | 중간 | 새 경로 추가, 기존은 유지       |

**해결 방법**:

```typescript
// 경로 일관성 확인
console.log('API 경로 맵:');
console.log('GET /api/live/current →', getCurrentLive());
console.log('GET /api/live/deals →', getLiveDeals());
```

### 3. 성능 저하

| 위험             | 확률 | 완화                         |
| ---------------- | ---- | ---------------------------- |
| 번들 사이즈 증가 | 중간 | Tree-shaking, 동적 import    |
| 초기 로딩 속도   | 중간 | 코드 스플리팅, 이미지 최적화 |

**확인 방법**:

```bash
npm run build

# Next.js 분석
npm install --save-dev @next/bundle-analyzer

# 크기 확인
npx next-bundle-analyzer
```

### 4. 라우팅 오류

| 위험            | 확률 | 완화          |
| --------------- | ---- | ------------- |
| 깨진 링크       | 낮음 | E2E 테스트    |
| 네비게이션 오류 | 낮음 | 라우팅 테스트 |

**테스트**:

```typescript
// test/home.spec.ts
describe('홈페이지 라우팅', () => {
  it('라이브 배너의 "입장" 버튼 클릭 → /live/:streamKey로 이동', async () => {
    // ...
  });

  it('상품 카드 클릭 → ProductDetailModal 열림', async () => {
    // ...
  });
});
```

---

## 검증 계획

### Phase별 검증

**Phase 1 후**:

- ✅ `npm run build` 성공
- ✅ 번들 사이즈: `client-app/.next` < 5MB (gzip)
- ✅ 브라우저 콘솔 에러 없음
- ✅ Storybook 또는 테스트 페이지에서 컴포넌트 렌더링 확인

**Phase 2 후**:

- ✅ 홈페이지 `GET /` 렌더링 성공
- ✅ 모든 섹션 표시됨
- ✅ 반응형 디자인 (모바일/태블릿/데스크톱)
- ✅ E2E 테스트: 링크 클릭 동작
- ✅ 라이트하우스 성능 스코어 > 80

**Phase 3 후**:

- ✅ API 호출 성공
- ✅ 응답 데이터 타입 일치
- ✅ 에러 처리 (404, 500 등)
- ✅ TypeScript 컴파일 에러 0건

**Phase 4 후**:

- ✅ 상태 변화 추적 (Redux DevTools)
- ✅ 캐싱 정상 작동 (staleTime 확인)
- ✅ 낙관적 업데이트 동작
- ✅ 에러 시 롤백

**Phase 5 후**:

- ✅ Admin 페이지 로드 성공
- ✅ 대시보드 차트 렌더링
- ✅ 테이블 정렬/필터 동작

### 테스트 체크리스트

```markdown
## 초기 로딩

- [ ] `npm run dev` 실행 성공
- [ ] `http://localhost:3000` 접속 성공
- [ ] 콘솔 에러 없음

## 홈페이지 렌더링

- [ ] Header 표시
- [ ] LiveBanner 표시
- [ ] LiveExclusiveDeals 섹션 표시
- [ ] UpcomingLives 캐러셀 표시
- [ ] PopularProducts 그리드 표시
- [ ] Footer 표시

## 상호작용

- [ ] 상품 카드 클릭 → ProductDetailModal 열림
- [ ] 모달의 "찜하기" 버튼 → 상태 변경 + 아이콘 색상 변경
- [ ] "알림 받기" 버튼 → API 호출 + 토스트 메시지
- [ ] 모달 닫기 → 모달 사라짐

## 성능

- [ ] 초기 로딩 < 3초
- [ ] 상호작용 반응 < 500ms
- [ ] 번들 사이즈 < 5MB (gzip)
- [ ] 라이트하우스 > 80 점

## 반응형

- [ ] 모바일 (320px)
- [ ] 태블릿 (768px)
- [ ] 데스크톱 (1024px)

## API

- [ ] `GET /api/live/current` 응답 확인
- [ ] `GET /api/live/deals` 응답 확인
- [ ] `POST /api/live/notifications/:id` 동작 확인
- [ ] `POST /api/products/:id/like` 동작 확인

## 타입

- [ ] TypeScript 컴파일 에러 0건
- [ ] API 응답 타입 검증 통과
```

---

## 일정 & 리소스

### 예상 일정

| Phase           | 작업         | 시간          | 일정              |
| --------------- | ------------ | ------------- | ----------------- |
| 1               | UI 컴포넌트  | 5-6시간       | 1일               |
| 2               | 홈페이지     | 16-19시간     | 2-3일             |
| 3               | API 통합     | 8-10시간      | 1주 (백엔드 협의) |
| 4               | 상태관리     | 8시간         | 1-2일             |
| **합계 (P1-4)** |              | **37-43시간** | **2-3주**         |
| 5               | Admin (선택) | 60-80시간     | 2-3주             |

**총 예상**:

- **핵심 (Phase 1-4)**: 2-3주 (1.5명 풀타임)
- **확장 (Phase 5 포함)**: 5-6주

### 필요 리소스

| 역할           | 기간  | 작업                 |
| -------------- | ----- | -------------------- |
| **프론트엔드** | 3주   | Phase 1-4 구현       |
| **백엔드**     | 1주   | Phase 3: API 구현    |
| **디자인**     | 2-3일 | Phase 2: 스타일 검토 |
| **QA**         | 1주   | E2E 테스트           |

### 마일스톤

```
Week 1:
  - Phase 1: UI 컴포넌트 완료 ✅
  - Phase 2 시작: 홈페이지 컴포넌트 복사 및 변환

Week 2:
  - Phase 2: 홈페이지 통합 완료 ✅
  - Phase 3 시작: 백엔드 API 구현

Week 3:
  - Phase 3: API 통합 완료 ✅
  - Phase 4: 상태관리 & 훅 완료 ✅
  - 전체 통합 테스트

Week 4+:
  - Phase 5 (선택): Admin 페이지 개선
```

---

## 요약

### ✅ 권장 병합

1. **Phase 1: UI 컴포넌트** (필수)
   - 50+ Radix UI 컴포넌트
   - 개발 속도 30-40% 향상
   - 리스크: 낮음
   - 작업량: 1일

2. **Phase 2: 홈페이지** (필수)
   - 9개 섹션 컴포넌트
   - 사용자 경험 대폭 개선
   - 리스크: 중간 (라우팅 변환)
   - 작업량: 2-3일

3. **Phase 3: API 통합** (필수)
   - 7개 새 엔드포인트
   - 백엔드와 협의 필요
   - 리스크: 중간 (경로 충돌)
   - 작업량: 1주

4. **Phase 4: 상태관리** (필수)
   - Zustand + TanStack Query
   - 기존 패턴 유지
   - 리스크: 낮음
   - 작업량: 1-2일

5. **Phase 5: Admin** (선택)
   - UI 개선
   - 낮은 우선순위
   - 리스크: 낮음
   - 작업량: 2-3주

---

**문서 작성 완료**
**대상**: Doremi 개발팀
**적용 가능성**: 100% (코드베이스 분석 기반)
**예상 효과**: 개발 속도 40% 향상, 사용자 경험 대폭 개선
