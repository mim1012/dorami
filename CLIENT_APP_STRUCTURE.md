# Dorami Client-App 구조 분석

**Last Updated:** 2026-02-28
**Status:** Complete Architecture Overview

---

## 📋 목차

1. [UI 컴포넌트 구조](#ui-컴포넌트-구조)
2. [페이지 레이아웃](#페이지-레이아웃)
3. [상태 관리 & API 클라이언트](#상태-관리--api-클라이언트)
4. [타입 정의 체계](#타입-정의-체계)
5. [Hook 아키텍처](#hook-아키텍처)
6. [디렉토리 구조](#디렉토리-구조)

---

## UI 컴포넌트 구조

### 1. Common Components (기본 UI 컴포넌트)

**위치:** `/client-app/src/components/common/`

기본 UI 빌딩 블록으로 모든 페이지에서 재사용되는 컴포넌트들:

| 컴포넌트                       | 설명                     | Props                                                                                        |
| ------------------------------ | ------------------------ | -------------------------------------------------------------------------------------------- |
| **Button.tsx**                 | 다양한 스타일의 버튼     | `variant` (primary/secondary/outline/ghost), `size` (sm/md/lg), `fullWidth`, HTML attributes |
| **Input.tsx**                  | 텍스트 입력 필드         | 표준 HTML input attributes + 커스텀 스타일                                                   |
| **Card.tsx**                   | 카드 레이아웃 컨테이너   | className, children                                                                          |
| **Modal.tsx**                  | 모달 다이얼로그          | isOpen, onClose, title, children                                                             |
| **ConfirmDialog.tsx**          | 확인 다이얼로그          | title, message, onConfirm, onCancel                                                          |
| **Select.tsx**                 | 드롭다운 선택            | options, value, onChange                                                                     |
| **Pagination.tsx**             | 페이지네이션 컨트롤      | currentPage, totalPages, onPageChange                                                        |
| **SearchBar.tsx**              | 검색 입력바              | onSearch, placeholder                                                                        |
| **Table.tsx**                  | 데이터 테이블            | columns, data, rowKey                                                                        |
| **Skeleton.tsx**               | 로딩 스켈레톤            | width, height, count                                                                         |
| **Toast.tsx**                  | 토스트 알림              | message, type (success/error/info), duration                                                 |
| **Typography.tsx**             | 텍스트 스타일            | variant (h1-h6, body, caption), children                                                     |
| **EmptyState.tsx**             | 빈 상태 표시             | title, description, icon                                                                     |
| **KakaoInAppBrowserGuard.tsx** | 카카오 인앱브라우저 가드 | 환경 감지 및 경고                                                                            |

**디자인 시스템:**

- 색상: Hot Pink (#FF1493) 액센트, 다크 테마 기본
- Tailwind CSS 4.0 + Dark Mode 클래스
- 컴포넌트별 variant 및 size 지원

---

### 2. Layout Components (레이아웃)

**위치:** `/client-app/src/components/layout/`

앱 전체 레이아웃을 구성하는 컴포넌트:

| 컴포넌트             | 설명                                  |
| -------------------- | ------------------------------------- |
| **BottomTabBar.tsx** | 하단 탭 네비게이션 (모바일 메인 네비) |
| **FloatingNav.tsx**  | 플로팅 네비게이션 컴포넌트            |
| **Footer.tsx**       | 푸터 영역                             |
| **ThemeToggle.tsx**  | 다크/라이트 테마 토글                 |

---

### 3. Feature Components (기능별 컴포넌트)

#### 홈페이지 (`/components/home/`)

- **LiveCountdownBanner.tsx** — 라이브 방송 시작까지 카운트다운 배너
- **ProductCard.tsx** — 상품 카드 (이미지, 가격, 할인율 표시)
- **SocialProof.tsx** — 소셜 증명 (구매자 수, 리뷰 등)
- **UpcomingLiveCard.tsx** — 예정된 라이브 방송 카드

#### 라이브 방송 (`/components/live/`)

- **VideoPlayer.tsx** — 비디오 플레이어 (HTTP-FLV → HLS 폴백)
- **LiveChat.tsx** — 라이브 채팅 UI
- **CartActivityFeed.tsx** — 장바구니 활동 피드
- **LiveCartSheet.tsx** — 라이브 중 장바구니 시트
- **ProductCarousel.tsx** — 상품 캐러셀
- **ProductBottomSheet.tsx** — 상품 상세 바텀시트
- **ProductListBottomSheet.tsx** — 상품 목록 바텀시트
- **ProductOptionModal.tsx** — 상품 옵션 선택 모달 (색상, 사이즈)
- **StreamProductsModal.tsx** — 현재 방송 중인 상품 목록
- **ProductQuickActionBar.tsx** — 빠른 액션 바
- **ChatOverlay.tsx** — 채팅 오버레이

#### 스트림 플레이어 (`/components/stream/`)

- **PlayerControls.tsx** — 플레이어 컨트롤
- **BufferingSpinner.tsx** — 버퍼링 로딩 스피너
- **ErrorOverlay.tsx** — 에러 오버레이
- **StreamEndedOverlay.tsx** — 방송 종료 오버레이
- **LiveBadge.tsx** — "LIVE" 배지
- **ViewerCount.tsx** — 시청자 수 표시

#### 채팅 (`/components/chat/`)

- **ChatHeader.tsx** — 채팅 헤더
- **ChatInput.tsx** — 채팅 입력 필드
- **ChatMessage.tsx** — 개별 채팅 메시지
- **ChatMessageList.tsx** — 채팅 메시지 리스트
- **ChatOverlay.tsx** — 채팅 오버레이

#### 장바구니 (`/components/cart/`)

- **CartItemCard.tsx** — 장바구니 항목 카드
- **CartSummaryCard.tsx** — 장바구니 합계 카드
- **CartTimer.tsx** — 장바구니 만료 타이머
- **CartEmptyState.tsx** — 비어있는 장바구니 상태

#### 예약 (`/components/reservation/`)

- **ReservationCard.tsx** — 예약 카드
- **ReservationList.tsx** — 예약 목록
- **CreateReservationButton.tsx** — 예약 생성 버튼

#### 상품 (`/components/product/`)

- **ProductDetailModal.tsx** — 상품 상세 모달
- **ProductList.tsx** — 상품 목록
- **FeaturedProductBar.tsx** — 특집 상품 바

#### 마이페이지 (`/components/my-page/`)

- **ProfileInfoCard.tsx** — 프로필 정보 카드
- **ShippingAddressCard.tsx** — 배송 주소 카드
- **AddressEditModal.tsx** — 주소 수정 모달
- **OrderHistoryCard.tsx** — 주문 이력 카드
- **PointsBalanceCard.tsx** — 포인트 잔액 카드
- **AdminDashboardCard.tsx** — 관리자 대시보드 카드
- **LoginRequiredModal.tsx** — 로그인 필요 모달

#### Admin (`/components/admin/`)

**Dashboard:**

- StatCard.tsx — 통계 카드

**Layout:**

- Header.tsx — 어드민 헤더
- Sidebar.tsx — 어드민 사이드바

**Broadcasts:**

- FeaturedProductManager.tsx — 특집 상품 관리
- ReStreamManager.tsx — 리스트림(재전송) 관리

**Settings:**

- NoticeManagement.tsx — 공지사항 관리
- NoticeListManagement.tsx — 공지사항 목록 관리
- PointsConfiguration.tsx — 포인트 설정
- ShippingMessages.tsx — 배송 메시지 관리
- ThumbnailCropModal.tsx — 썸네일 자르기 모달

**Users:**

- PointAdjustmentModal.tsx — 포인트 조정 모달

#### Auth & Legal (`/components/auth/`, `/components/legal/`)

- ProtectedRoute.tsx — 보호된 라우트 래퍼
- LegalModal.tsx — 약관 모달

#### Notifications & Notices

- PushNotificationBanner.tsx — 푸시 알림 배너
- NoticeModal.tsx — 공지사항 모달

#### Inquiry & Contact

- InquiryBottomSheet.tsx — 문의 바텀시트
- ContactForm.tsx — 연락처 폼

---

## 페이지 레이아웃

### App Router 구조 (`/client-app/src/app/`)

**루트 레이아웃:**

- `layout.tsx` — 전역 레이아웃 (메타데이터, 프로바이더)
- `page.tsx` — 홈페이지 (라이브 카운트다운, 상품, 예정 라이브)

**인증 (`/(auth)/`):**

- `login/page.tsx` — 카카오 로그인 페이지

**사용자 페이지:**
| 경로 | 설명 | 기능 |
|------|------|------|
| `/profile/register` | 프로필 등록 | 배송지, Instagram ID, 예금주명 등 완성 |
| `/my-page` | 마이페이지 | 프로필, 주소, 포인트, 주문 이력 조회 |
| `/my-page/points` | 포인트 관리 | 포인트 잔액, 거래 이력 |
| `/my-page/reservations` | 예약 관리 | 대기 중인 예약 목록 |

**라이브 방송:**
| 경로 | 설명 |
|------|------|
| `/live` | 라이브 목록 (모든 활성 방송) |
| `/live/[streamKey]` | 특정 라이브 방송 시청 |
| `/live/preview` | 라이브 방송 미리보기 (관리자용) |

**쇼핑:**
| 경로 | 설명 |
|------|------|
| `/shop` | 상품 전체 목록 |
| `/store` | 스토어 페이지 |
| `/products/[id]` | 상품 상세 페이지 |
| `/cart` | 장바구니 |
| `/checkout` | 결제 페이지 |

**주문:**
| 경로 | 설명 |
|------|------|
| `/orders` | 주문 목록 |
| `/orders/[orderId]` | 주문 상세 |
| `/order-complete` | 주문 완료 페이지 |

**관리자 (`/admin/`):**
| 경로 | 기능 |
|------|------|
| `/admin` | 관리자 대시보드 |
| `/admin/dashboard` | 상세 대시보드 |
| `/admin/products` | 상품 관리 |
| `/admin/broadcasts` | 방송 관리 (특집상품, 리스트림) |
| `/admin/orders` | 주문 관리 |
| `/admin/orders/[id]` | 주문 상세 |
| `/admin/orders/bulk-notify` | 일괄 배송 알림 |
| `/admin/users` | 사용자 관리 |
| `/admin/users/[id]` | 사용자 상세 |
| `/admin/settlement` | 정산 관리 |
| `/admin/settings` | 시스템 설정 |
| `/admin/settings/notifications` | 알림 템플릿 설정 |
| `/admin/audit-log` | 감사 로그 |

**기타:**
| 경로 | 설명 |
|------|------|
| `/alerts` | 알림 페이지 |
| `/design-system-demo` | 디자인 시스템 데모 |
| `/privacy` | 개인정보처리방침 |
| `/terms` | 이용약관 |

---

## 상태 관리 & API 클라이언트

### 상태 관리 체계

#### 1. Zustand Store (클라이언트 상태)

**위치:** `/client-app/src/lib/store/`

**auth.ts:**

```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist((set) => ({...}), {
    name: 'auth-storage',
    partialize: (state) => ({
      user: state.user,
      isAuthenticated: state.isAuthenticated,
    }),
  })
);
```

**역할:** 사용자 인증 상태, 지속성 (localStorage)

---

#### 2. TanStack Query (서버 상태)

**위치:** `/client-app/src/lib/hooks/queries/`

쿼리 키 및 훅 정의:

| 파일                     | Query Keys                         | 목적                   |
| ------------------------ | ---------------------------------- | ---------------------- |
| **use-products.ts**      | `products`, `product:*`            | 상품 목록, 상세 조회   |
| **use-cart.ts**          | `cart`, `cart:items`               | 장바구니 상태          |
| **use-orders.ts**        | `orders`, `orders:*`               | 주문 목록, 상세        |
| **use-streams.ts**       | `streams`, `streams:active`        | 라이브 스트림 조회     |
| **use-reservations.ts**  | `reservations`                     | 예약 목록              |
| **use-points.ts**        | `points:balance`, `points:history` | 포인트 잔액, 거래 이력 |
| **create-query-keys.ts** | Factory functions                  | 쿼리 키 생성 헬퍼      |

**기능:**

- 자동 캐싱 및 백그라운드 리페치
- Optimistic updates
- 에러 핸들링 및 재시도
- 동시성 제어

---

### API 클라이언트 구조

**위치:** `/client-app/src/lib/api/`

#### client.ts (기본 클라이언트)

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

class ApiError extends Error {
  statusCode: number;
  errorCode: string;
  details?: any;
}

// CSRF 토큰 관리
function getCsrfToken(): string | null;
async function ensureCsrfToken(): Promise<void>;

// 토큰 리프레시 (동시 요청 합치기)
async function refreshAccessToken(): Promise<boolean>;

// 베이스 fetch
async function executeFetch(
  url: string,
  options?: RequestInit & { params?: Record<string, any> },
): Promise<Response>;

// 메인 fetch (자동 401 처리, 리프레시, 재시도)
export async function apiFetch<T>(
  url: string,
  options?: RequestInit & { params?: Record<string, any> },
): Promise<T>;
```

**특징:**

- CSRF 토큰 자동 주입 (X-CSRF-Token 헤더)
- 401 응답 자동 처리 → 토큰 리프레시 → 재시도
- 동시 리프레시 요청 합치기 (Race condition 방지)
- FormData 자동 감지 (Content-Type 자동 설정)

---

#### 도메인별 API 함수

| 파일                     | 주요 함수                                                              | 설명               |
| ------------------------ | ---------------------------------------------------------------------- | ------------------ |
| **products.ts**          | `getProducts()`, `getProduct()`, `getFeaturedProducts()`               | 상품 조회          |
| **orders.ts**            | `createOrder()`, `getOrder()`, `getOrders()`, `updateShippingStatus()` | 주문 관리          |
| **cart.ts**              | `addToCart()`, `removeFromCart()`, `getCart()`                         | 장바구니 관리      |
| **streaming.ts**         | `getUpcomingStreams()`, `getLiveStreams()`                             | 라이브 스트림 조회 |
| **reservations.ts**      | `createReservation()`, `getReservations()`                             | 예약 관리          |
| **points.ts**            | `getPointBalance()`, `getPointHistory()`                               | 포인트 조회        |
| **notifications.ts**     | `subscribe()`, `unsubscribe()`                                         | 푸시 알림 구독     |
| **notices.ts**           | `getNotices()`, `getNotice()`                                          | 공지사항 조회      |
| **featured-products.ts** | `getFeaturedProducts()`, `updateFeaturedProducts()`                    | 특집상품 관리      |
| **restream.ts**          | `getRestreamTargets()`, `updateRestream()`                             | 리스트림 관리      |

---

## 타입 정의 체계

### 공유 타입 (`packages/shared-types/src/index.ts`)

#### Enums

```typescript
// 역할
enum Role {
  USER,
  ADMIN,
}

// 사용자 상태
enum UserStatus {
  ACTIVE,
  INACTIVE,
  SUSPENDED,
}

// 스트림 상태
enum StreamStatus {
  PENDING,
  LIVE,
  OFFLINE,
}

// 상품 상태
enum ProductStatus {
  AVAILABLE,
  SOLD_OUT,
}

// 장바구니 상태
enum CartStatus {
  ACTIVE,
  EXPIRED,
  COMPLETED,
}

// 예약 상태
enum ReservationStatus {
  WAITING,
  PROMOTED,
  COMPLETED,
  CANCELLED,
  EXPIRED,
}

// 주문 상태
enum OrderStatus {
  PENDING_PAYMENT,
  PAYMENT_CONFIRMED,
  SHIPPED,
  DELIVERED,
  CANCELLED,
}

// 포인트 거래 유형
enum PointTransactionType {
  EARNED_ORDER,
  USED_ORDER,
  REFUND_CANCELLED,
  MANUAL_ADD,
  MANUAL_SUBTRACT,
  EXPIRED,
}
```

#### 주요 인터페이스

**User:**

```typescript
interface User {
  id: string;
  email: string;
  kakaoId: string;
  name: string;
  role: Role;
  status: UserStatus;
  depositorName?: string;
  instagramId?: string;
  shippingAddress?: ShippingAddress;
  createdAt: string;
  lastLoginAt?: string;
  updatedAt: string;
}
```

**Product:**

```typescript
interface Product {
  id: string;
  streamKey: string;
  name: string;
  price: number;
  stock: number;
  colorOptions: string[];
  sizeOptions: string[];
  shippingFee: number;
  timerEnabled: boolean;
  timerDuration: number;
  imageUrl?: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}
```

**Cart:**

```typescript
interface Cart {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  color?: string;
  size?: string;
  status: CartStatus;
  expiresAt?: string;
  createdAt: string;
}
```

**Order:**

```typescript
interface Order {
  id: string; // ORD-YYYYMMDD-XXXXX format
  userId: string;
  userEmail: string;
  depositorName: string;
  shippingAddress: ShippingAddress;
  total: string; // Decimal as string
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shippingStatus: ShippingStatus;
  orderItems: OrderItem[];
  createdAt: string;
}
```

### 프론트엔드 타입 확장 (`/client-app/src/lib/types/`)

**user.ts:**

- User 인터페이스 (공유 타입 재내보내기 + 확장)
- CompleteProfileData — 프로필 등록 DTO

**product.ts:**

- Product 인터페이스 (숫자형 가격)
- ProductListItem — 리스트 아이템
- AddToCartRequest — 장바구니 추가 요청

**order.ts:**

- Order 인터페이스 확장
- OrderCreateRequest — 주문 생성 DTO

**reservation.ts:**

- Reservation 인터페이스

**index.ts:**

- 모든 타입 일괄 내보내기

---

## Hook 아키텍처

### 위치 1: `/client-app/src/lib/hooks/` (라이브러리 훅)

#### 인증 & 상태

**use-auth.ts:**

```typescript
export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, logout } = useAuthStore();
  // - Kakao OAuth 리다이렉트 처리
  // - JWT 검증
  // - 토큰 리프레시
  // - 로그아웃
  return { user, isAuthenticated, isLoading, login, logout };
}
```

#### 라이브 & 실시간

**use-stream-viewer.ts:**

- 시청자 카운트 추적

**use-product-stock.ts:**

- 상품 재고 실시간 업데이트 (WebSocket)

#### 채팅

**use-chat.ts:**

```typescript
export function useChat(streamKey: string) {
  // Socket.IO `/chat` 네임스페이스 연결
  // - 메시지 송수신
  // - 채팅방 상태 관리
  return { sendMessage, deleteMessage, isConnected };
}
```

**use-chat-messages.ts:**

```typescript
export function useChatMessages(streamKey: string) {
  // 채팅 메시지 누적 (배열)
  // - 20개 최근 메시지
  // - 메시지 추가/삭제 이벤트 처리
  return { messages, addMessage, removeMessage };
}
```

#### UI & 유틸리티

**use-debounce.ts:**

- 디바운스 훅 (검색 등에 사용)

**use-modal-behavior.ts:**

- 모달 열기/닫기 상태 관리

**use-profile-guard.ts:**

- 프로필 완성 여부 확인 및 리다이렉트

**use-push-notification.ts:**

- Web Push 구독 관리
- VAPID 공개키로 구독 (서버에 저장)

**use-instagram-check.ts:**

- Instagram ID 유효성 검증

#### 환경 감지

**use-is-mobile.ts:**

- 모바일 환경 감지

**use-orientation.ts:**

- 기기 방향 감지 (portrait/landscape)

**use-kakao-share.ts:**

- 카카오 공유 기능

---

### 위치 2: `/client-app/src/hooks/` (기능 훅)

#### 라이브 레이아웃 상태 머신

**useLiveLayoutMachine.ts:**

```typescript
export type LiveEvent =
  | { type: 'STREAM_STARTED' }
  | { type: 'STREAM_ENDED' }
  | { type: 'STREAM_ERROR' }
  | { type: 'USER_TYPING' }
  | { type: 'USER_IDLE' }
  | { type: 'RETRY_FAILED' }
  | { type: 'CONNECTION_RESTORED' };

export enum LiveSnapshot {
  LIVE_NORMAL = 'LIVE_NORMAL',
  LIVE_TYPING = 'LIVE_TYPING',
  RETRYING = 'RETRYING',
  NO_STREAM = 'NO_STREAM',
  ENDED = 'ENDED',
}

export interface LiveLayout {
  snapshot: LiveSnapshot;
  showChat: boolean;
  showProducts: boolean;
  showVideo: boolean;
  overlayMode: 'normal' | 'fullscreen' | 'hidden';
}

export function useLiveLayoutMachine() {
  // 상태 머신 관리
  // - 스트림 연결/종료
  // - 타이핑 상태
  // - 에러/재시도
  // - 레이아웃 유도
  return {
    snapshot: LiveSnapshot;
    layout: LiveLayout;
    dispatch: (event: LiveEvent) => void;
  };
}
```

**역할:**

- 라이브 페이지의 UI 상태를 일관되게 관리
- `deriveSnapshot()` — 상태 로직 (테스트 가능)
- `computeLayout()` — 레이아웃 계산 (테스트 가능)

**테스트:** `__tests__/useLiveLayoutMachine.test.ts`

---

#### 장바구니 활동 피드

**useCartActivity.ts:**

- 다른 사용자의 장바구니 추가 이벤트 수신
- "OOO님이 상품을 장바구니에 추가했습니다" 메시지 표시

---

### 위치 3: `/client-app/src/lib/hooks/queries/` (TanStack Query 훅)

**쿼리 함수 + 훅 일괄 제공:**

```typescript
// use-products.ts
export function useProducts(options?: UseQueryOptions) {
  return useQuery({
    queryKey: queryKeys.products.all,
    queryFn: () => apiFetch('/products'),
    ...options,
  });
}

export function useProduct(productId: string) {
  return useQuery({
    queryKey: queryKeys.products.detail(productId),
    queryFn: () => apiFetch(`/products/${productId}`),
  });
}

export function useFeaturedProducts() {
  return useQuery({
    queryKey: queryKeys.products.featured,
    queryFn: () => apiFetch('/products/featured'),
    staleTime: 5 * 60 * 1000, // 5분
  });
}

// 뮤테이션
export function useCreateOrder() {
  return useMutation({
    mutationFn: (data: CreateOrderRequest) =>
      apiFetch('/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });
}
```

---

## 디렉토리 구조

```
client-app/
├── src/
│   ├── app/                              # Next.js App Router pages
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── admin/                        # 관리자 페이지
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/
│   │   │   ├── products/
│   │   │   ├── broadcasts/
│   │   │   ├── orders/
│   │   │   ├── users/
│   │   │   ├── settings/
│   │   │   └── audit-log/
│   │   ├── my-page/                      # 사용자 마이페이지
│   │   │   ├── page.tsx
│   │   │   ├── points/
│   │   │   └── reservations/
│   │   ├── live/                         # 라이브 페이지
│   │   │   ├── page.tsx
│   │   │   ├── [streamKey]/page.tsx
│   │   │   └── preview/page.tsx
│   │   ├── profile/register/             # 프로필 등록
│   │   ├── cart/page.tsx
│   │   ├── checkout/page.tsx
│   │   ├── orders/
│   │   ├── products/[id]/
│   │   ├── shop/page.tsx
│   │   ├── store/page.tsx
│   │   ├── alerts/page.tsx
│   │   ├── privacy/page.tsx
│   │   ├── terms/page.tsx
│   │   ├── order-complete/page.tsx
│   │   ├── design-system-demo/page.tsx
│   │   ├── layout.tsx                    # 루트 레이아웃
│   │   └── page.tsx                      # 홈페이지
│   │
│   ├── components/                       # 재사용 가능한 컴포넌트
│   │   ├── common/                       # 기본 UI 컴포넌트
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── ... (14개 컴포넌트)
│   │   ├── layout/                       # 레이아웃
│   │   │   ├── BottomTabBar.tsx
│   │   │   ├── FloatingNav.tsx
│   │   │   └── Footer.tsx
│   │   ├── home/                         # 홈페이지 컴포넌트
│   │   │   ├── LiveCountdownBanner.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   └── UpcomingLiveCard.tsx
│   │   ├── live/                         # 라이브 방송 UI
│   │   │   ├── VideoPlayer.tsx
│   │   │   ├── LiveChat.tsx
│   │   │   ├── ProductCarousel.tsx
│   │   │   └── ... (11개 컴포넌트)
│   │   ├── stream/                       # 스트림 플레이어
│   │   │   ├── VideoPlayer.tsx
│   │   │   ├── ErrorOverlay.tsx
│   │   │   └── ... (7개 컴포넌트)
│   │   ├── chat/                         # 채팅
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   └── ChatOverlay.tsx
│   │   ├── cart/                         # 장바구니
│   │   │   ├── CartItemCard.tsx
│   │   │   └── CartTimer.tsx
│   │   ├── product/                      # 상품
│   │   ├── reservation/                  # 예약
│   │   ├── my-page/                      # 마이페이지
│   │   ├── admin/                        # 관리자 페이지 컴포넌트
│   │   │   ├── dashboard/
│   │   │   ├── broadcasts/
│   │   │   ├── settings/
│   │   │   ├── users/
│   │   │   └── layout/
│   │   ├── auth/                         # 인증
│   │   ├── notifications/                # 알림
│   │   ├── legal/                        # 약관
│   │   ├── inquiry/                      # 문의
│   │   └── contact/                      # 연락처
│   │
│   ├── lib/
│   │   ├── api/                          # API 클라이언트
│   │   │   ├── client.ts                 # 베이스 fetch + CSRF + 토큰 리프레시
│   │   │   ├── products.ts
│   │   │   ├── orders.ts
│   │   │   ├── cart.ts
│   │   │   ├── streaming.ts
│   │   │   ├── reservations.ts
│   │   │   ├── points.ts
│   │   │   ├── notifications.ts
│   │   │   ├── notices.ts
│   │   │   ├── featured-products.ts
│   │   │   └── restream.ts
│   │   ├── hooks/                        # 라이브러리 훅
│   │   │   ├── use-auth.ts
│   │   │   ├── use-chat.ts
│   │   │   ├── use-push-notification.ts
│   │   │   ├── use-profile-guard.ts
│   │   │   ├── use-modal-behavior.ts
│   │   │   └── ... (더 많은 훅)
│   │   │
│   │   ├── hooks/queries/                # TanStack Query 훅
│   │   │   ├── create-query-keys.ts
│   │   │   ├── use-products.ts
│   │   │   ├── use-orders.ts
│   │   │   ├── use-cart.ts
│   │   │   ├── use-streams.ts
│   │   │   └── ... (더 많은 쿼리 훅)
│   │   ├── store/                        # Zustand stores
│   │   │   └── auth.ts                   # 인증 상태
│   │   ├── types/                        # 프론트엔드 타입 확장
│   │   │   ├── user.ts
│   │   │   ├── product.ts
│   │   │   ├── order.ts
│   │   │   └── reservation.ts
│   │   ├── socket/                       # WebSocket 관련
│   │   ├── analytics/                    # 분석
│   │   ├── auth/                         # 인증 유틸리티
│   │   ├── contexts/                     # React Context
│   │   ├── constants/                    # 상수
│   │   ├── monitoring/                   # 모니터링
│   │   ├── providers/                    # 프로바이더 설정
│   │   ├── theme/                        # 테마 설정
│   │   └── utils/                        # 유틸리티 함수
│   │
│   ├── hooks/                            # 커스텀 기능 훅
│   │   ├── useLiveLayoutMachine.ts        # 라이브 페이지 상태 머신
│   │   ├── useCartActivity.ts
│   │   ├── useChatConnection.ts
│   │   ├── useChatMessages.ts
│   │   ├── useIsMobile.ts
│   │   ├── useOrientation.ts
│   │   └── __tests__/
│   │
│   └── types/                            # 전역 타입 (deprecated, lib/types 사용 권장)
│
├── public/                               # 정적 자산
├── .env.local                            # 환경 변수
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 주요 통합 지점

### 1. 라이브 페이지 아키텍처

**경로:** `/live/[streamKey]/page.tsx`

```
VideoPlayer (HTTP-FLV → HLS)
  ├── PlayerControls
  ├── BufferingSpinner
  ├── ErrorOverlay
  └── StreamEndedOverlay

Layout (useLiveLayoutMachine)
  ├── Chat (useChatConnection + useChatMessages)
  ├── Product Carousel (useProductStock → WebSocket 업데이트)
  ├── Cart Activity Feed (useCartActivity)
  └── Quick Action Bar

State:
  - useLiveLayoutMachine → snapshot + layout
  - Socket.IO `/` → product:stock:update
  - Socket.IO `/chat` → chat:message
  - TanStack Query → useProducts()
```

---

### 2. 홈페이지 아키텍처

**경로:** `/page.tsx`

```
Hero Section
  ├── SearchBar
  ├── ThemeToggle
  └── FloatingNav

Live Section
  ├── LiveCountdownBanner (useAuth + Socket.IO)
  └── UpcomingLiveCard[] (useStreams query)

Featured Products
  ├── ProductCard[] (useFeaturedProducts query)
  └── Product Image Gallery

Upcoming Lives
  └── UpcomingLiveCard[] (getUpcomingStreams)

Social Proof
Footer
BottomTabBar (모바일)
PushNotificationBanner
```

---

### 3. 마이페이지 아키텍처

**경로:** `/my-page/page.tsx`

```
Login Guard (useProfileGuard)

Profile Info
  └── ProfileInfoCard (useAuthStore.user)

Shipping Address
  └── ShippingAddressCard + AddressEditModal

Points Balance
  └── PointsBalanceCard (usePointBalance query)

Order History
  └── OrderHistoryCard (useOrders query)

Admin Access
  └── AdminDashboardCard (if role === ADMIN)

Sections:
  - /my-page/points → Points transaction history
  - /my-page/reservations → Active reservations
```

---

## 컴포넌트 시스템 특징

### 1. Variant Pattern

모든 기본 컴포넌트가 `variant` 및 `size` props를 지원:

```typescript
<Button variant="primary" size="lg" fullWidth>
  주문하기
</Button>

<Button variant="outline" size="md">
  취소
</Button>
```

### 2. Dark Mode Support

Tailwind CSS 4.0 dark mode classes:

```css
.dark {
  @apply bg-primary-black text-primary-text;
}
```

### 3. Theme Colors

- **Primary:** Hot Pink (#FF1493) — 액센트, CTA
- **Background:** Primary Black (#0a0a0a) — 다크 모드
- **Text:** Primary Text (흰색 계열)
- **Border:** Border Color (회색 계열)

---

## 타입 안전성

### 공유 타입 사용 규칙

✅ **공유 타입에서 import:**

```typescript
import { Product, ProductStatus, Order } from '@live-commerce/shared-types';
```

✅ **프론트엔드 확장 타입:**

```typescript
import { Product } from '@/lib/types/product';
```

✅ **API 응답 변환:**

```typescript
// 백엔드: price: "1000" (Decimal string)
// 프론트엔드: price: 1000 (number)
const product = await apiFetch<Product>('/products/123');
```

---

## 성능 최적화

### 1. Query StaleTime

```typescript
useQuery({
  queryKey: ['products'],
  queryFn: () => apiFetch('/products'),
  staleTime: 5 * 60 * 1000, // 5분 동안 fresh
});
```

### 2. Image Optimization

`next/image` 사용 — 자동 최적화

### 3. Code Splitting

페이지별 자동 분할 (Next.js App Router)

---

## 통신 프로토콜

### HTTP (REST)

- 기본 CRUD 작업
- CSRF 토큰 자동 주입
- 401 → 토큰 리프레시 → 재시도

### WebSocket (Socket.IO)

- `/` — 스트림 참여, 상품 재고 업데이트
- `/chat` — 실시간 채팅
- `/streaming` — 시청자 카운트

---

## 에러 처리

### API Error

```typescript
class ApiError extends Error {
  statusCode: number;
  errorCode: string; // business.exception.ts 에러 코드
  details?: any;
}
```

### 컴포넌트 에러 바운더리

```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
  <LazyComponent />
</ErrorBoundary>
```

### 404 / 에러 페이지

- `app/not-found.tsx`
- `app/error.tsx`

---

## 앞으로의 확장

1. **컴포넌트 라이브러리 분리** — npm 패키지로 공개
2. **Storybook** — 컴포넌트 카탈로그
3. **E2E 테스트 확대** — Playwright
4. **성능 모니터링** — Web Vitals
5. **국제화 (i18n)** — 다언어 지원
