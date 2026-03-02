# Live Commerce vs Dorami — 백엔드 & 데이터베이스 상세 비교 분석

**분석 날짜**: 2026-02-28
**분석 대상**: 데이터베이스 스키마, API 응답 구조, 백엔드 아키텍처
**결론**: ⚠️ **완전히 다른 구조 — 통합 불가능, 마이그레이션 필요**

---

## 목차

1. [개요](#개요)
2. [데이터베이스 스키마 비교](#데이터베이스-스키마-비교)
3. [API 응답 구조 비교](#api-응답-구조-비교)
4. [백엔드 모듈 구조 비교](#백엔드-모듈-구조-비교)
5. [주요 차이점 & 영향도](#주요-차이점--영향도)
6. [통합 전략](#통합-전략)
7. [마이그레이션 계획](#마이그레이션-계획)

---

## 개요

### Live Commerce

- **DB**: 미제공 (문서만 있음)
- **백엔드**: React 18 기반 문서 설계 (구현 없음)
- **데이터 구조**: 프론트엔드 중심 인터페이스 정의

### Dorami

- **DB**: PostgreSQL 16 + Prisma ORM
- **백엔드**: NestJS 11 (완전 구현됨)
- **데이터 구조**: Prisma 스키마 기반 (실제 구현)

---

## 데이터베이스 스키마 비교

### 1️⃣ 라이브 방송 (LiveStream)

**Live Commerce (예상)**:

```typescript
interface LiveStream {
  id: number; // 숫자 ID
  title: string;
  description: string;
  status: 'live' | 'scheduled' | 'ended';
  thumbnail: string;
  hostId: number;
  hostName: string;
  hostProfile: string;
  startTime: string; // ISO 8601
  endTime?: string;
  viewers: number;
  peakViewers: number;
  streamUrl?: string;
  chatEnabled: boolean;
  expectedViewers?: number;
}
```

**Dorami (실제 구현)**:

```prisma
model LiveStream {
  id            String       @id @default(uuid())           // UUID
  streamKey     String       @unique                         // OBS 키
  userId        String       @map("user_id")
  title         String
  status        StreamStatus  // PENDING | LIVE | OFFLINE
  startedAt     DateTime?
  endedAt       DateTime?
  totalDuration Int?          // 초 단위
  peakViewers   Int           // 정수
  freeShippingEnabled Boolean
  scheduledAt   DateTime?
  thumbnailUrl  String?
  expiresAt     DateTime
  createdAt     DateTime
}
```

**주요 차이점**:
| 항목 | Live Commerce | Dorami |
|------|---------------|--------|
| **ID 타입** | number | UUID string |
| **상태값** | 'live'\|'scheduled'\|'ended' | PENDING\|LIVE\|OFFLINE |
| **호스트 정보** | 직접 저장 (hostId, hostName) | User 관계 참조 |
| **시간 필드** | ISO string | DateTime |
| **추가 필드** | description, expectedViewers | streamKey, freeShippingEnabled, expiresAt |
| **배송 정보** | 없음 | freeShippingEnabled (스트림 레벨) |

**호환성**: ❌ **불가능**

- ID 타입 호환 불가 (number vs UUID)
- 상태값 완전 다름
- streamKey는 Live Commerce에 없음 (OBS 연동용)
- 배송 정책이 다름 (Dorami는 스트림 레벨, Live Commerce는 상품 레벨)

---

### 2️⃣ 상품 (Product)

**Live Commerce (예상)**:

```typescript
interface Product {
  id: number;
  name: string;
  description?: string;
  originalPrice: number; // 정가
  currentPrice: number; // 현재가
  livePrice?: number; // 라이브 특가
  discount: number; // 할인율 %
  image: string;
  images?: string[];
  stock: number;
  sold: number; // 판매된 수량
  soldCount?: number; // 누적
  isAvailable: boolean;
  rating?: number;
  reviewCount?: number;
  isLiked: boolean; // 사용자별
  tags?: string[];
  sizes?: ProductSize[];
  colors?: ProductColor[];
  material?: string;
  care?: string;
  deliveryInfo?: DeliveryInfo; // 상품별 배송비
}
```

**Dorami (실제 구현, 일부)**:

```prisma
model Product {
  id              String       @id @default(uuid())
  streamKey       String?      @map("stream_key")
  liveStream      LiveStream?  @relation(...)
  name            String
  price           Decimal      @db.Decimal(10, 2)
  quantity        Int          // 재고
  colorOptions    String[]     @default([])       // 배열
  sizeOptions     String[]     @default([])       // 배열
  shippingFee     Decimal      @default(0)
  freeShippingMessage String?
  timerEnabled    Boolean      @default(false)
  timerDuration   Int          @default(10)
  imageUrl        String?
  images          String[]     @default([])
  sortOrder       Int          @default(0)
  status          ProductStatus // AVAILABLE | SOLD_OUT
  // ... (계속)
}
```

**주요 차이점**:
| 항목 | Live Commerce | Dorami |
|------|---------------|--------|
| **가격 필드** | originalPrice, currentPrice, livePrice | price만 (Decimal 정확도) |
| **할인율** | 계산된 필드 (discount %) | 없음 |
| **재고** | quantity, sold, soldCount | quantity만 (정수) |
| **평점/리뷰** | rating, reviewCount | 없음 |
| **찜하기** | Product에 포함 (isLiked) | 별도 테이블 (UserLike) |
| **옵션** | 배열 객체 (ProductSize[]) | 문자열 배열 (colorOptions[]) |
| **배송비** | 상품별 (deliveryInfo) | 상품별 (shippingFee) ✓ 유사 |
| **태그** | tags[] | 없음 |
| **상태** | isAvailable | ProductStatus enum |

**호환성**: ⚠️ **부분 호환 (큰 수정 필요)**

- 가격 모델 완전히 다름 (Live Commerce는 복수 가격, Dorami는 단일 가격)
- 평점/리뷰 기능 없음
- 찜하기는 별도 구조 필요
- 옵션 저장 방식 다름 (객체 배열 vs 문자열 배열)

---

### 3️⃣ 장바구니 (Cart)

**Live Commerce (예상)**: 문서에 없음

**Dorami (실제)**:

```prisma
model Cart {
  id          String     @id @default(uuid())
  userId      String
  user        User       @relation(...)
  items       CartItem[]
  status      CartStatus // ACTIVE | EXPIRED | COMPLETED
  expiresAt   DateTime   @map("expires_at")
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}

model CartItem {
  id        String  @id @default(uuid())
  cartId    String
  cart      Cart    @relation(...)
  productId String
  product   Product @relation(...)
  quantity  Int
  size      String?
  color     String?
  createdAt DateTime @default(now())
}
```

**주요 특징**:

- 장바구니 **10분 TTL** (자동 만료)
- CartItem으로 옵션 저장 (size, color)
- 상태 관리 (ACTIVE/EXPIRED/COMPLETED)

**호환성**: ❌ **불가능**

- Live Commerce는 장바구니 구조 정의 없음
- Dorami의 TTL 기반 설계는 라이브 커머스 특화 (Live Commerce는 고려 안 함)

---

### 4️⃣ 주문 (Order)

**Live Commerce (예상)**: 문서에 없음

**Dorami (실제)**:

```prisma
model Order {
  id              String        @id @default(uuid())
  orderId         String        @unique            // ORD-YYYYMMDD-XXXXX
  userId          String
  user            User          @relation(...)
  items           OrderItem[]
  shippingAddress Json          // 암호화됨
  totalAmount     Decimal       @db.Decimal(12, 2)
  shippingFee     Decimal       @db.Decimal(10, 2)
  pointsUsed      Decimal       @default(0)
  status          OrderStatus   // PENDING_PAYMENT 등
  shippingStatus  ShippingStatus
  paymentStatus   PaymentStatus
  // ... 배송, 결제 정보
}
```

**호환성**: ❌ **불가능**

- Live Commerce에 정의 없음
- Dorami는 복잡한 주문 상태 관리 필요
- 배송지 주소 암호화 (AES-256-GCM)

---

### 5️⃣ 알림 & 팔로우 (미구현 기능)

**Live Commerce (예상)**:

- 라이브 알림 (NotificationSet)
- 상품 찜 (Like)

**Dorami (실제)**:

- NotificationSubscription (Web Push VAPID)
- UserLike (구현 미확인)
- ModerationLog (관리자 채팅 관리)
- AuditLog (관리자 감시)

**호환성**: ❌ **완전 다름**

- 알림 방식: 라이브 입장 알림 vs Web Push 구독
- Dorami에는 관리자 감시 시스템 있음

---

## API 응답 구조 비교

### Live Commerce API Response

```json
{
  "success": true,
  "data": {
    "id": 123,
    "title": "윈터 코트 특집",
    "status": "live",
    "viewers": 2453
  }
}
```

### Dorami API Response

```json
{
  "data": {
    "id": "abc-123-uuid",
    "streamKey": "live_xyz",
    "status": "LIVE",
    "peakViewers": 3120
  },
  "success": true,
  "timestamp": "2026-02-28T12:00:00Z"
}
```

**차이점**:
| 항목 | Live Commerce | Dorami |
|------|---------------|--------|
| **성공 응답** | `{ success, data }` | `{ data, success, timestamp }` |
| **에러 응답** | `{ success: false, error, message, details }` | `{ statusCode, message, error }` |
| **ID 타입** | number | UUID string |
| **상태값** | 소문자 ('live') | 대문자 ('LIVE') |
| **시간 형식** | ISO string (내포) | timestamp 필드 |

**호환성**: ⚠️ **부분 호환 (어댑터 필요)**

- 프론트엔드 API 클라이언트 수정 필요
- ID 타입 변환 필요
- 상태값 대문자 변환 필요

---

## 백엔드 모듈 구조 비교

### Dorami 모듈 구조

```
backend/src/modules/
├── admin/              ✅ 관리자 전용
├── auth/               ✅ Kakao OAuth + JWT
├── cart/               ✅ 장바구니 (10분 TTL)
├── chat/               ✅ 실시간 채팅 (WebSocket)
├── health/             ✅ 헬스 체크
├── notices/            ✅ 공지사항
├── notifications/      ✅ Web Push 알림
├── orders/             ✅ 주문 관리
├── points/             ✅ 포인트 시스템
├── products/           ✅ 상품 관리
├── reservation/        ✅ 대기열 → 장바구니 승격
├── restream/           ✅ FFmpeg 멀티 타겟 (YouTube 등)
├── settlement/         ✅ 정산
├── store/              ✅ 스토어 (종료 라이브 상품)
├── streaming/          ✅ 라이브 스트리밍 (SRS)
├── upload/             ✅ 파일 업로드
├── users/              ✅ 사용자 프로필
└── websocket/          ✅ 실시간 통신
```

**총 17개 모듈** (완전 구현)

### Live Commerce 백엔드

- **제공되지 않음** (프론트엔드만 있음)
- 문서상 예상되는 기능:
  - 라이브 방송 관리
  - 상품 관리
  - 주문/결제
  - 알림
  - 찜하기/팔로우

**호환성**: ❌ **불가능**

- Live Commerce는 구현된 백엔드가 없음
- Dorami의 복잡한 모듈 구조는 직접 적용 불가능

---

## 주요 차이점 & 영향도

### 1️⃣ 데이터 타입 (ID)

| 항목             | Live Commerce  | Dorami         | 영향도    |
| ---------------- | -------------- | -------------- | --------- |
| **ID 타입**      | number         | UUID           | 🔴 치명적 |
| **마이그레이션** | DB 변환 불가능 | 새로 설계 필요 |           |

**영향**:

- 모든 관계 (Relations) 다시 설정 필요
- 프론트엔드 코드 수정
- 기존 데이터 유실

### 2️⃣ 가격 모델

| 항목          | Live Commerce                          | Dorami      | 영향도    |
| ------------- | -------------------------------------- | ----------- | --------- |
| **가격 필드** | originalPrice, currentPrice, livePrice | price       | 🔴 치명적 |
| **할인율**    | 계산 필드                              | 없음        |           |
| **배송비**    | 상품별 deliveryInfo                    | shippingFee | ✅ 유사   |

**영향**:

- 라이브 특가 시스템 재설계 필요
- 가격 히스토리 없음 (Dorami)
- 할인율 계산 로직 추가 필요

### 3️⃣ 상태 관리

| 기능            | Live Commerce                | Dorami                      | 호환성 |
| --------------- | ---------------------------- | --------------------------- | ------ |
| **라이브 상태** | 'live'\|'scheduled'\|'ended' | PENDING\|LIVE\|OFFLINE      | ❌     |
| **상품 상태**   | isAvailable                  | AVAILABLE\|SOLD_OUT         | ❌     |
| **주문 상태**   | ❌ 없음                      | PENDING_PAYMENT 등 (복합)   | ❌     |
| **배송 상태**   | ❌ 없음                      | PENDING\|SHIPPED\|DELIVERED | ❌     |

**영향**:

- 상태 머신 완전 재설계 필요
- 주문/배송 관리는 Live Commerce에 없음 (추가 구현)

### 4️⃣ 평점/리뷰

| 항목        | Live Commerce | Dorami  | 호환성 |
| ----------- | ------------- | ------- | ------ |
| **평점**    | rating        | ❌ 없음 | ❌     |
| **리뷰 수** | reviewCount   | ❌ 없음 | ❌     |

**영향**:

- 평점/리뷰 시스템 구현 필요 (또는 제거)

### 5️⃣ 찜하기

| 항목     | Live Commerce            | Dorami           | 호합성 |
| -------- | ------------------------ | ---------------- | ------ |
| **위치** | Product에 포함 (isLiked) | 별도 테이블 필요 | ⚠️     |
| **구현** | 프론트엔드 상태          | DB 영속          | ⚠️     |

**영향**:

- UserLike 테이블 필요
- API 엔드포인트 추가 필요

---

## 통합 전략

### ❌ Option 1: Live Commerce 스키마 그대로 적용

**불가능한 이유**:

1. Live Commerce는 구현된 백엔드가 없음
2. Dorami의 기존 데이터를 모두 마이그레이션해야 함
3. 이미 프로덕션 운영 중인 시스템에 적용 불가

### ⚠️ Option 2: Hybrid (권장하지 않음)

Live Commerce 데이터 구조 + Dorami 구현 혼합:

- 복잡도 극대화
- 버그 증가
- 유지보수 어려움

### ✅ Option 3: Dorami 중심 (권장)

**전략**:

1. Dorami의 기존 스키마 유지
2. Live Commerce의 **논리와 UX 개념만** 참고
3. 필요한 필드만 추가 (예: discount %, rating)
4. 필요한 기능만 구현 (찜하기, 알림 등)

**구현 순서**:

1. 평점/리뷰 기능 추가 (ProductRating 테이블)
2. 찜하기 기능 추가 (UserLike 테이블)
3. 라이브 특가 시스템 개선 (livePrice 필드 추가)
4. 알림 설정 기능 개선
5. UI/UX 개선 (Live Commerce 컴포넌트 참고)

---

## 마이그레이션 계획

### Phase 1: 분석 & 설계 (1주)

- [ ] Dorami 기존 스키마 상세 분석
- [ ] 필요한 새 필드 식별
  - `rating`, `ratingCount` (Product)
  - `livePrice` (Product - 라이브 특가)
  - `discount` (계산 필드)
- [ ] 필요한 새 테이블 설계
  - ProductRating
  - UserLike
  - LiveNotificationPreference
- [ ] 마이그레이션 스크립트 검토

### Phase 2: 스키마 확장 (1-2주)

- [ ] Prisma 스키마 업데이트

  ```prisma
  // Product 필드 추가
  livePrice Decimal? @db.Decimal(10, 2)

  // 새 테이블
  model ProductRating {
    id String @id @default(uuid())
    productId String
    userId String
    rating Int (1-5)
    reviewText String?
    createdAt DateTime @default(now())
  }
  ```

- [ ] 데이터베이스 마이그레이션
- [ ] 시드 데이터 작성
- [ ] 테스트 데이터 생성

### Phase 3: 백엔드 API 확장 (2-3주)

**새 엔드포인트**:

- `POST /api/products/{id}/ratings` — 평점 작성
- `POST /api/products/{id}/like` — 찜하기
- `DELETE /api/products/{id}/like` — 찜하기 취소
- `POST /api/streaming/{id}/notifications` — 라이브 알림 설정
- `GET /api/products/featured` 개선 — 평점 포함

**수정 엔드포인트**:

- `GET /api/products/{id}` — rating 필드 추가
- `GET /api/streaming/active` — 시청자 수, 최대 시청자 수 포함

### Phase 4: 프론트엔드 연동 (2주)

- [ ] ProductRating 컴포넌트 구현
- [ ] Like 기능 구현
- [ ] 알림 설정 UI 개선
- [ ] Live Commerce UI 컴포넌트 적응

### Phase 5: 테스트 & 배포 (1주)

- [ ] 단위 테스트
- [ ] E2E 테스트
- [ ] 통합 테스트
- [ ] 스테이징 배포
- [ ] 프로덕션 배포

**총 기간**: 7-9주

---

## 실행 순서 (우선순위)

### 🔴 필수

1. **찜하기 기능** (UserLike 테이블)
   - Live Commerce 핵심 기능
   - API 엔드포인트: `POST /api/products/{id}/like`

2. **라이브 특가** (livePrice 필드)
   - 라이브 커머스 핵심
   - 가격 모델 수정 필요

3. **평점 & 리뷰** (ProductRating 테이블)
   - 사용자 신뢰도
   - 권장사항 기반 상품 추천

### 🟡 중요

4. **라이브 알림** (LiveNotificationPreference)
   - 예정 라이브 알림 기능
   - Web Push 연동

5. **Admin 대시보드** 개선
   - 평점/리뷰 관리
   - 라이브 분석

### 🟢 선택사항

6. **팔로우 기능** (UserFollow)
   - 호스트별 팔로우
   - 하단 우선순위

---

## 리스크 & 주의사항

### ⚠️ High Risk

1. **기존 데이터 호환성**
   - 기존 Product 데이터는 그대로 유지
   - 새 필드는 NULL 허용 또는 기본값 설정

2. **API 호환성**
   - 기존 API 응답 구조 변경 주의
   - 버전 관리 또는 신규 엔드포인트 추가

3. **상태 관리**
   - 라이브 상태 (PENDING → LIVE → OFFLINE)
   - 주문 상태 (PENDING_PAYMENT → PAYMENT_CONFIRMED 등)

### 🟡 Medium Risk

4. **성능**
   - ProductRating 테이블 인덱싱 필수
   - UserLike 테이블 쿼리 최적화

5. **배포**
   - 스테이징에서 충분한 테스트
   - 롤백 계획 수립

---

## 결론

| 항목             | 평가           | 비고                    |
| ---------------- | -------------- | ----------------------- |
| **직접 통합**    | ❌ 불가능      | Live Commerce 구현 없음 |
| **마이그레이션** | ❌ 과도한 비용 | 기존 Dorami 데이터 유실 |
| **Hybrid 접근**  | ✅ 권장        | Dorami 유지 + 기능 추가 |
| **기간**         | 7-9주          | 추정 작업량 포함        |
| **위험도**       | 중간           | 기존 데이터 보호 필요   |

**최종 권장**: **Dorami 기존 스키마 유지하면서, Live Commerce의 핵심 기능(찜하기, 라이브 특가, 평점)을 Dorami에 맞게 추가 구현**

---

**작성자**: Claude Code
**상태**: ✅ 분석 완료
**다음 단계**: Phase 1 설계 시작
