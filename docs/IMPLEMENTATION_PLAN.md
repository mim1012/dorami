# 미구현 기능 구현 기획서

**작성일**: 2026-02-04
**작성자**: Claude (Dorami Project)
**기준 문서**: IMPLEMENTATION_STATUS_REPORT.md
**현재 구현률**: 79%
**목표**: MVP 배포 준비 완료 (95%+)

---

## 목차
1. [전체 개요](#1-전체-개요)
2. [Critical: FeaturedProductBar 구현](#2-critical-featuredproductbar-구현)
3. [High: 알림받기 기능 구현](#3-high-알림받기-기능-구현)
4. [High: 카카오톡 공유 기능 구현](#4-high-카카오톡-공유-기능-구현)
5. [High: 상품 필드 확장](#5-high-상품-필드-확장-isnewdiscount)
6. [구현 우선순위 및 일정](#6-구현-우선순위-및-일정)

---

## 1. 전체 개요

### 1.1 현재 상황
- **전체 구현률**: 79%
- **MVP 배포 가능 여부**: 조건부 YES
- **즉시 해결 필요**: 1개 (Critical)
- **1주 내 해결 권장**: 3개 (High)

### 1.2 미구현 기능 리스트

| 우선순위 | 기능명 | 위치 | 예상 시간 | 비즈니스 영향 |
|---------|--------|------|----------|-------------|
| Critical | FeaturedProductBar | live/[streamKey]/page.tsx:162 | 4-5시간 | 높음 |
| High | 알림받기 기능 | page.tsx:127 | 9-11시간 | 높음 |
| High | 카카오톡 공유 | order-complete/page.tsx:236 | 4시간 | 중간 |
| High | 상품 isNew/discount | page.tsx:49-50 | 4.5-5.5시간 | 중간 |

---

## 2. Critical: FeaturedProductBar 구현

### 2.1 기능 개요
**목적**: 라이브 방송 중 셀러가 강조하고 싶은 상품을 화면 하단에 표시하여 즉시 구매 유도

**현재 상태**:
- UI 컴포넌트는 존재하지만 API 연동 없음
- `live/[streamKey]/page.tsx:162` 주석 처리
- `FeaturedProductBar.tsx:22` API fetch TODO

### 2.2 UX 플로우
```
[관리자]
1. 관리자 대시보드에서 라이브 중 상품 선택
2. "강조하기" 버튼 클릭
3. 시청자 화면에 Featured Bar 표시

[시청자]
1. 라이브 시청 중 하단에 상품 바 등장
2. 바 클릭 시 ProductDetailModal 열림
3. 옵션 선택 후 장바구니 담기
```

### 2.3 백엔드 구현

#### API 엔드포인트

**1) GET /api/streaming/key/:streamKey/featured-product**
```typescript
// 현재 강조 중인 상품 조회
Response 200:
{
  "product": {
    "id": "uuid",
    "name": "상품명",
    "price": 29900,
    "imageUrl": "https://...",
    "stock": 15
  } | null
}
```

**2) POST /api/streaming/:streamKey/featured-product (Admin)**
```typescript
// 강조 상품 설정
Body: { "productId": "uuid" }
Response 200: { "success": true }
```

**3) DELETE /api/streaming/:streamKey/featured-product (Admin)**
```typescript
// 강조 해제
Response 200: { "success": true }
```

#### Redis 구조 (권장)
```
Key: stream:{streamKey}:featured-product
Value: productId
TTL: 라이브 종료 시 자동 삭제
```

#### WebSocket 이벤트
```typescript
// 강조 상품 변경 시 실시간 브로드캐스트
socket.emit('stream:featured-product:updated', {
  streamKey: string,
  product: Product | null
});
```

### 2.4 프론트엔드 구현

#### FeaturedProductBar.tsx 수정
```tsx
// 주요 변경사항
1. useEffect로 초기 데이터 fetch
2. WebSocket으로 실시간 업데이트 수신
3. product가 null이면 컴포넌트 숨김
4. 클릭 시 ProductDetailModal 열기
```

#### live/[streamKey]/page.tsx 수정
```tsx
// Line 162 주석 해제
<FeaturedProductBar
  streamKey={streamKey}
  onProductClick={handleProductClick}
/>
```

### 2.5 예상 작업 시간
- 백엔드 API: 1-2시간
- WebSocket 이벤트: 30분
- 프론트엔드 컴포넌트: 1시간
- 관리자 UI: 1시간
- 테스트: 1시간
- **총 4-5시간**

---

## 3. High: 알림받기 기능 구현

### 3.1 기능 개요
**목적**: 예정된 라이브 방송 시작 전 사용자에게 알림 전송

**현재 상태**: `alert('라이브 알림이 설정되었습니다!')` 임시 처리

### 3.2 UX 플로우
```
1. 홈 화면에서 예정된 라이브 카드의 "알림받기" 버튼 클릭
2. 브라우저 Push 권한 요청
3. 승인 시 백엔드에 구독 정보 저장
4. 라이브 시작 10분 전 Push 알림 발송
5. 알림 클릭 시 라이브 화면으로 이동
```

### 3.3 백엔드 구현

#### 데이터베이스 스키마
```prisma
model NotificationSubscription {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  liveStreamId String?  // null = 모든 라이브
  endpoint     String   // Push API endpoint
  p256dh       String   // Encryption key
  auth         String   // Auth secret
  createdAt    DateTime @default(now())

  @@unique([userId, endpoint])
}
```

#### API 엔드포인트
```typescript
POST /api/notifications/subscribe
DELETE /api/notifications/subscribe
GET /api/notifications/subscriptions
```

#### NotificationService
```typescript
// web-push 라이브러리 사용
async sendLiveStartNotification(liveStreamId: string) {
  // 1. 구독자 조회
  // 2. VAPID 키로 Push 발송
  // 3. 만료된 구독 정리
}
```

#### Cron Job
```typescript
@Cron('*/5 * * * *') // 5분마다 확인
async checkUpcomingLives() {
  // 10분 후 시작 예정 라이브 찾기
  // 알림 미발송 건만 발송
}
```

### 3.4 프론트엔드 구현

#### useNotifications Hook
```typescript
export function useNotifications() {
  const requestPermission = async () => {...}
  const subscribe = async (liveStreamId?: string) => {...}
  const unsubscribe = async () => {...}

  return { subscribe, unsubscribe, permission }
}
```

#### Service Worker (public/sw.js)
```javascript
self.addEventListener('push', (event) => {
  const data = event.data.json();
  self.registration.showNotification(data.title, {...});
});

self.addEventListener('notificationclick', (event) => {
  clients.openWindow(event.notification.data.url);
});
```

#### 환경 변수
```bash
# VAPID Keys 생성: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=BM...
VAPID_PRIVATE_KEY=...
```

### 3.5 예상 작업 시간
- 백엔드 API: 2-3시간
- NotificationService: 2시간
- Cron Scheduler: 1시간
- 프론트엔드 Hook: 1-2시간
- Service Worker: 1시간
- 테스트: 2시간
- **총 9-11시간 (1.5일)**

---

## 4. High: 카카오톡 공유 기능 구현

### 4.1 기능 개요
**목적**: 주문 완료 후 주문 정보를 카카오톡으로 간편하게 공유

**현재 상태**: `alert('카카오톡 공유 기능은 추후 구현 예정입니다')`

### 4.2 UX 플로우
```
1. 주문 완료 화면에서 "카카오톡으로 받기" 버튼 클릭
2. 카카오톡 공유 창 열림
3. 친구/채팅방 선택
4. 주문 정보 카드 형태로 전송
5. 수신자가 카드 클릭 시 주문 상세 페이지로 이동
```

### 4.3 Kakao SDK 설정

#### Kakao Developers 설정
1. https://developers.kakao.com/ 접속
2. 애플리케이션 생성/선택
3. JavaScript 키 발급
4. 플랫폼 설정 → Web 플랫폼 추가
5. 카카오 링크 활성화

#### 환경 변수
```bash
NEXT_PUBLIC_KAKAO_JS_KEY=your_javascript_key
```

### 4.4 프론트엔드 구현

#### Kakao SDK 초기화 (layout.tsx)
```tsx
<Script
  src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.0/kakao.min.js"
  onLoad={() => {
    window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY);
  }}
/>
```

#### useKakaoShare Hook
```typescript
export function useKakaoShare() {
  const shareOrder = (orderData: {...}) => {
    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: `주문 완료 - ${orderData.orderNumber}`,
        description: `상품 정보...`,
        imageUrl: 'https://...',
        link: {
          mobileWebUrl: `/order/${orderData.orderNumber}`,
          webUrl: `/order/${orderData.orderNumber}`,
        }
      },
      itemContent: {
        items: [
          { item: '총 결제 금액', itemOp: '₩...' },
          { item: '입금 계좌', itemOp: '...' },
          { item: '입금 기한', itemOp: '...' }
        ]
      }
    });
  };

  return { shareOrder };
}
```

#### order-complete/page.tsx 수정
```tsx
const { shareOrder } = useKakaoShare();

const handleKakaoShare = () => {
  shareOrder({
    orderNumber: order.orderNumber,
    products: order.items,
    totalAmount: order.totalAmount,
    ...paymentInfo
  });
};
```

### 4.5 예상 작업 시간
- Kakao SDK 설정: 30분
- useKakaoShare Hook: 1시간
- 화면 수정: 30분
- 테스트: 1시간
- **총 4시간**

---

## 5. High: 상품 필드 확장 (isNew/discount)

### 5.1 기능 개요
**목적**: 상품에 "신상품" 배지 및 할인율 표시

**현재 상태**:
- 프론트엔드에서 하드코딩: `isNew: true`, `discount: undefined`
- 백엔드 Product 모델에 필드 없음

### 5.2 UX 표시
```
┌────────────────────┐
│  [NEW] 10% OFF     │ ← Badge
│  ┌──────────────┐  │
│  │  Product Img │  │
│  └──────────────┘  │
│  상품명             │
│  ₩26,910  ₩29,900 │ ← 할인가 / 원가
└────────────────────┘
```

### 5.3 백엔드 구현

#### Prisma Schema 수정
```prisma
model Product {
  // ... existing fields

  isNew           Boolean   @default(false)
  discountRate    Decimal?  @db.Decimal(5, 2) // 0.00 ~ 100.00
  originalPrice   Decimal?  @db.Decimal(10, 2)
}
```

#### Migration
```bash
cd backend
npx prisma migrate dev --name add_product_display_fields
```

#### DTO 수정
```typescript
export class ProductResponseDto {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;  // 추가
  discountRate?: number;   // 추가
  isNew: boolean;          // 추가
  // ...
}

export class CreateProductDto {
  // ...
  @IsBoolean()
  @IsOptional()
  isNew?: boolean = false;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  discountRate?: number;

  @IsNumber()
  @IsOptional()
  originalPrice?: number;
}
```

### 5.4 프론트엔드 구현

#### 타입 정의 수정
```typescript
export interface Product {
  // ...
  originalPrice?: number;
  discountRate?: number;
  isNew: boolean;
}
```

#### ProductCard 컴포넌트 수정
```tsx
// Badges 추가
{isNew && (
  <span className="px-2 py-1 bg-hot-pink text-white text-xs font-bold rounded">
    NEW
  </span>
)}
{discountRate && discountRate > 0 && (
  <span className="px-2 py-1 bg-error text-white text-xs font-bold rounded">
    {discountRate}%
  </span>
)}

// 가격 표시
<div className="flex items-center gap-2">
  <p className="text-h2 text-hot-pink font-bold">
    ₩{price.toLocaleString()}
  </p>
  {originalPrice && originalPrice > price && (
    <p className="text-small text-gray-500 line-through">
      ₩{originalPrice.toLocaleString()}
    </p>
  )}
</div>
```

#### page.tsx TODO 제거
```tsx
// BEFORE
isNew: true, // TODO: Add isNew field to backend
discount: undefined, // TODO: Add discount field to backend

// AFTER
isNew: p.isNew,
discountRate: p.discountRate,
originalPrice: p.originalPrice,
```

### 5.5 관리자 UI 개선

#### 상품 등록 폼에 필드 추가
```tsx
<label>
  <input type="checkbox" checked={isNew} />
  신상품으로 표시
</label>

<input
  type="number"
  placeholder="할인율 (%)"
  value={discountRate}
  min="0"
  max="100"
/>

<input
  type="number"
  placeholder="원가"
  value={originalPrice}
/>
```

### 5.6 예상 작업 시간
- DB Migration: 30분
- 백엔드 DTO/Service: 1시간
- 프론트엔드 수정: 1-2시간
- 관리자 UI: 1시간
- 테스트: 1시간
- **총 4.5-5.5시간**

---

## 6. 구현 우선순위 및 일정

### 6.1 우선순위 매트릭스

| 기능 | 우선순위 | 예상 시간 | 비즈니스 영향 | 기술 복잡도 |
|------|---------|----------|-------------|-----------|
| FeaturedProductBar | Critical | 4-5시간 | 높음 | 중간 |
| 상품 필드 확장 | High | 4.5-5.5시간 | 중간 | 낮음 |
| 카카오톡 공유 | High | 4시간 | 중간 | 낮음 |
| 알림받기 기능 | High | 9-11시간 | 높음 | 높음 |

### 6.2 권장 구현 순서

#### Phase 1: 즉시 구현 (1일)
1. **FeaturedProductBar** (4-5시간) - MVP 필수
2. **상품 필드 확장** (4.5-5.5시간) - UX 개선

**결과**: 구현률 79% → 87%

#### Phase 2: 1주일 내 구현 (2-3일)
3. **카카오톡 공유** (4시간) - 공유 확산
4. **알림받기 기능** (9-11시간) - 재방문 유도

**결과**: 구현률 87% → 95%

### 6.3 전체 일정

```
Day 1-2: Phase 1 (Critical)
├─ FeaturedProductBar 구현 및 테스트
├─ 상품 필드 확장 구현 및 테스트
└─ QA 및 배포

Day 3-5: Phase 2 (High)
├─ 카카오톡 공유 구현
├─ 알림받기 기능 구현
└─ 통합 테스트

Week 2: 안정화
├─ 버그 수정
├─ 성능 최적화
└─ 사용자 피드백 반영
```

### 6.4 성공 지표 (KPI)

**Phase 1 배포 후**
- 라이브 체류 시간: +20%
- 상품 클릭률: +15%
- 장바구니 담기율: +10%

**Phase 2 배포 후**
- 알림 구독율: 30%+
- 카카오톡 공유 수: 주문의 10%+
- 공유 유입: 전체 가입의 5%+

---

## 7. 리스크 및 대응

### 7.1 기술적 리스크

**1. Push Notification 브라우저 호환성**
- 리스크: iOS Safari 미지원
- 대응: 이메일 알림 대체

**2. Kakao SDK CDN 장애**
- 리스크: 카카오 서버 다운
- 대응: 링크 복사 버튼 Fallback

**3. WebSocket 부하**
- 리스크: Featured Product 실시간 업데이트
- 대응: Redis Pub/Sub, 이벤트 Throttling

### 7.2 일정 리스크
- Phase 1만 완료해도 MVP 배포 가능
- Phase 2는 점진적 배포 가능

---

## 8. 결론

### 8.1 구현 후 예상 완성도
- Phase 1 완료: 87% (MVP 배포 가능)
- Phase 2 완료: 95% (상용 서비스 수준)

### 8.2 다음 단계
1. Phase 1부터 개발 착수
2. 중간 검토 및 사용자 피드백
3. Phase 2 개발 진행
4. 최종 배포 및 모니터링

---

**작성 완료**: 2026-02-04
