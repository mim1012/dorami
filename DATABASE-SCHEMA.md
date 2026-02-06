# Database Schema Documentation

**프로젝트**: Dorami Live Commerce
**데이터베이스**: PostgreSQL 16
**ORM**: Prisma 6.x
**작성일**: 2026-02-05

---

## 📋 목차

1. [개요](#개요)
2. [ER Diagram](#er-diagram)
3. [테이블 상세](#테이블-상세)
4. [관계 (Relationships)](#관계-relationships)
5. [인덱스 전략](#인덱스-전략)
6. [Enum 타입](#enum-타입)
7. [데이터 무결성](#데이터-무결성)

---

## 🏗️ 개요

### 통계

- **총 테이블 수**: 15개
- **Core 테이블**: 10개 (Users, LiveStreams, Products, Orders, etc.)
- **Support 테이블**: 5개 (Notifications, Audit, System Config, etc.)
- **Enum 타입**: 10개
- **총 인덱스**: 35+개

### 주요 특징

- **UUID 기반 ID**: 모든 테이블에서 UUID 사용 (Orders는 커스텀 포맷)
- **Soft Delete 지원**: ChatMessage (isDeleted 플래그)
- **타임스탬프**: createdAt, updatedAt 자동 관리
- **데이터 정규화**: 일부 필드는 의도적으로 denormalized (이력 보존)
- **암호화 지원**: shippingAddress (JSON 필드, 애플리케이션 레벨 암호화)

---

## 📊 ER Diagram

```
┌──────────────┐
│     User     │
└───────┬──────┘
        │
        ├──────── LiveStream ──────── Product ──────┬──── Cart
        │                                           │
        ├──────── ChatMessage                       ├──── Reservation
        │                                           │
        ├──────── Reservation                       └──── OrderItem ──┐
        │                                                              │
        ├──────── Order ───────────── OrderItem ◄──────────────────────┘
        │
        ├──────── ModerationLog
        │
        ├──────── AuditLog
        │
        └──────── NotificationSubscription ──────── LiveStream


독립 테이블 (Relations 없음):
  - NotificationTemplate
  - SystemConfig
  - Settlement
  - Notice
```

### 관계 요약

```
User (1) ──→ (N) LiveStream
User (1) ──→ (N) ChatMessage
User (1) ──→ (N) Cart
User (1) ──→ (N) Reservation
User (1) ──→ (N) Order
User (1) ──→ (N) ModerationLog (as admin)
User (1) ──→ (N) AuditLog (as admin)
User (1) ──→ (N) NotificationSubscription

LiveStream (1) ──→ (N) ChatMessage
LiveStream (1) ──→ (N) Product
LiveStream (1) ──→ (N) NotificationSubscription

Product (1) ──→ (N) Cart
Product (1) ──→ (N) Reservation
Product (1) ──→ (N) OrderItem

Order (1) ──→ (N) OrderItem
```

---

## 📝 테이블 상세

### 1. User (사용자)

**목적**: 시스템 사용자 (일반 사용자 + 관리자)

| 컬럼                 | 타입       | Nullable | 기본값 | 설명                             |
| -------------------- | ---------- | -------- | ------ | -------------------------------- |
| `id`                 | UUID       | NO       | uuid() | 기본키                           |
| `email`              | String     | YES      | -      | 이메일 (UNIQUE)                  |
| `kakaoId`            | String     | NO       | -      | 카카오 ID (UNIQUE)               |
| `name`               | String     | NO       | -      | 사용자 이름                      |
| `role`               | Role       | NO       | USER   | 역할 (USER/ADMIN)                |
| `status`             | UserStatus | NO       | ACTIVE | 상태 (ACTIVE/INACTIVE/SUSPENDED) |
| `depositorName`      | String     | YES      | -      | 입금자명 (무통장 입금 매칭용)    |
| `instagramId`        | String     | YES      | -      | 인스타그램 ID (UNIQUE)           |
| `shippingAddress`    | JSON       | YES      | -      | 배송지 (암호화, 미국 주소 형식)  |
| `profileCompletedAt` | DateTime   | YES      | -      | 프로필 완료 시각                 |
| `suspendedAt`        | DateTime   | YES      | -      | 정지 시각                        |
| `suspensionReason`   | String     | YES      | -      | 정지 사유                        |
| `createdAt`          | DateTime   | NO       | now()  | 생성 시각                        |
| `lastLoginAt`        | DateTime   | YES      | -      | 최근 로그인 시각                 |
| `updatedAt`          | DateTime   | NO       | -      | 수정 시각 (자동)                 |

**인덱스**:

- `users_email_key` (UNIQUE)
- `users_kakaoId_key` (UNIQUE)
- `users_instagramId_key` (UNIQUE)
- `users_email_idx`
- `users_kakaoId_idx`

**Relations**:

- `liveStreams` (1:N)
- `chatMessages` (1:N)
- `carts` (1:N)
- `reservations` (1:N)
- `orders` (1:N)
- `moderationLogs` (1:N) - as admin
- `auditLogs` (1:N) - as admin
- `notificationSubscriptions` (1:N)

---

### 2. LiveStream (라이브 방송)

**목적**: 라이브 스트리밍 세션 관리

| 컬럼            | 타입         | Nullable | 기본값        | 설명                        |
| --------------- | ------------ | -------- | ------------- | --------------------------- |
| `id`            | UUID         | NO       | uuid()        | 기본키                      |
| `streamKey`     | String       | NO       | -             | 스트림 키 (UNIQUE)          |
| `userId`        | UUID         | NO       | -             | 방송 생성자 (FK → users)    |
| `title`         | String       | NO       | "Live Stream" | 방송 제목                   |
| `status`        | StreamStatus | NO       | PENDING       | 상태 (PENDING/LIVE/OFFLINE) |
| `startedAt`     | DateTime     | YES      | -             | 방송 시작 시각              |
| `endedAt`       | DateTime     | YES      | -             | 방송 종료 시각              |
| `totalDuration` | Int          | YES      | -             | 총 방송 시간 (초)           |
| `peakViewers`   | Int          | NO       | 0             | 최대 시청자 수              |
| `expiresAt`     | DateTime     | NO       | -             | 스트림 키 만료 시각         |
| `createdAt`     | DateTime     | NO       | now()         | 생성 시각                   |

**인덱스**:

- `live_streams_streamKey_key` (UNIQUE)
- `live_streams_streamKey_idx`
- `live_streams_userId_idx`
- `live_streams_status_idx`

**Relations**:

- `user` (N:1)
- `chatMessages` (1:N)
- `products` (1:N)
- `notificationSubscriptions` (1:N)

---

### 3. ChatMessage (채팅 메시지)

**목적**: 라이브 방송 중 실시간 채팅

| 컬럼        | 타입     | Nullable | 기본값 | 설명                          |
| ----------- | -------- | -------- | ------ | ----------------------------- |
| `id`        | UUID     | NO       | uuid() | 기본키                        |
| `streamKey` | String   | NO       | -      | 스트림 키 (FK → live_streams) |
| `userId`    | UUID     | NO       | -      | 작성자 (FK → users)           |
| `content`   | Text     | NO       | -      | 메시지 내용                   |
| `timestamp` | DateTime | NO       | now()  | 작성 시각                     |
| `isDeleted` | Boolean  | NO       | false  | 삭제 여부 (Soft Delete)       |

**인덱스**:

- `chat_messages_streamKey_timestamp_idx` (복합)

**Relations**:

- `liveStream` (N:1)
- `user` (N:1)

---

### 4. ModerationLog (관리 로그)

**목적**: 채팅 관리 이력 추적

| 컬럼        | 타입             | Nullable | 기본값 | 설명                           |
| ----------- | ---------------- | -------- | ------ | ------------------------------ |
| `id`        | UUID             | NO       | uuid() | 기본키                         |
| `adminId`   | UUID             | NO       | -      | 관리자 (FK → users)            |
| `action`    | ModerationAction | NO       | -      | 조치 (DELETE_MESSAGE/MUTE/BAN) |
| `targetId`  | UUID             | NO       | -      | 대상 (ChatMessage ID)          |
| `reason`    | String           | YES      | -      | 조치 사유                      |
| `createdAt` | DateTime         | NO       | now()  | 생성 시각                      |

**인덱스**:

- `moderation_logs_adminId_idx`
- `moderation_logs_targetId_idx`

**Relations**:

- `admin` (N:1 → User)

---

### 5. Product (상품)

**목적**: 라이브 방송에서 판매하는 상품

| 컬럼                  | 타입          | Nullable | 기본값    | 설명                          |
| --------------------- | ------------- | -------- | --------- | ----------------------------- |
| `id`                  | UUID          | NO       | uuid()    | 기본키                        |
| `streamKey`           | String        | NO       | -         | 스트림 키 (FK → live_streams) |
| `name`                | String        | NO       | -         | 상품명                        |
| `price`               | Decimal(10,2) | NO       | -         | 가격                          |
| `quantity`            | Int           | NO       | -         | 재고 수량                     |
| `colorOptions`        | String[]      | NO       | -         | 색상 옵션 배열                |
| `sizeOptions`         | String[]      | NO       | -         | 사이즈 옵션 배열              |
| `shippingFee`         | Decimal(10,2) | NO       | 0         | 배송비                        |
| `freeShippingMessage` | String        | YES      | -         | 무료 배송 메시지              |
| `timerEnabled`        | Boolean       | NO       | false     | 타이머 활성화 여부            |
| `timerDuration`       | Int           | NO       | 10        | 타이머 시간 (분)              |
| `imageUrl`            | String        | YES      | -         | 이미지 URL                    |
| `isNew`               | Boolean       | NO       | false     | NEW 뱃지 표시                 |
| `discountRate`        | Decimal(5,2)  | YES      | -         | 할인율 (0.00~100.00)          |
| `originalPrice`       | Decimal(10,2) | YES      | -         | 할인 전 가격                  |
| `status`              | ProductStatus | NO       | AVAILABLE | 상태 (AVAILABLE/SOLD_OUT)     |
| `createdAt`           | DateTime      | NO       | now()     | 생성 시각                     |
| `updatedAt`           | DateTime      | NO       | -         | 수정 시각 (자동)              |

**인덱스**:

- `products_streamKey_idx`
- `products_streamKey_status_idx` (복합) - 스트림별 상품 필터링
- `products_status_idx`
- `products_status_createdAt_idx` (복합) - 스토어 상품 목록

**Relations**:

- `liveStream` (N:1)
- `carts` (1:N)
- `reservations` (1:N)
- `orderItems` (1:N)

---

### 6. Cart (장바구니)

**목적**: 사용자 장바구니 (타이머 포함)

| 컬럼           | 타입          | Nullable | 기본값 | 설명                            |
| -------------- | ------------- | -------- | ------ | ------------------------------- |
| `id`           | UUID          | NO       | uuid() | 기본키                          |
| `userId`       | UUID          | NO       | -      | 사용자 (FK → users)             |
| `productId`    | UUID          | NO       | -      | 상품 (FK → products)            |
| `productName`  | String        | NO       | -      | 상품명 (Denormalized, 이력용)   |
| `price`        | Decimal(10,2) | NO       | -      | 가격 (Denormalized)             |
| `quantity`     | Int           | NO       | -      | 수량                            |
| `color`        | String        | YES      | -      | 선택 색상                       |
| `size`         | String        | YES      | -      | 선택 사이즈                     |
| `shippingFee`  | Decimal(10,2) | NO       | 0      | 배송비                          |
| `timerEnabled` | Boolean       | NO       | false  | 타이머 활성화 여부              |
| `expiresAt`    | DateTime      | YES      | -      | 만료 시각                       |
| `status`       | CartStatus    | NO       | ACTIVE | 상태 (ACTIVE/EXPIRED/COMPLETED) |
| `createdAt`    | DateTime      | NO       | now()  | 생성 시각                       |
| `updatedAt`    | DateTime      | NO       | -      | 수정 시각 (자동)                |

**인덱스**:

- `carts_userId_status_idx` (복합) - 사용자별 장바구니 조회
- `carts_productId_status_idx` (복합) - 예약 수량 계산 (N+1 최적화)
- `carts_expiresAt_idx`
- `carts_status_timerEnabled_expiresAt_idx` (복합) - Cron: 만료 처리

**Relations**:

- `user` (N:1)
- `product` (N:1)

---

### 7. Reservation (예약 대기열)

**목적**: 품절 상품 예약 대기 시스템

| 컬럼                | 타입              | Nullable | 기본값  | 설명                                                |
| ------------------- | ----------------- | -------- | ------- | --------------------------------------------------- |
| `id`                | UUID              | NO       | uuid()  | 기본키                                              |
| `userId`            | UUID              | NO       | -       | 사용자 (FK → users)                                 |
| `productId`         | UUID              | NO       | -       | 상품 (FK → products)                                |
| `productName`       | String            | NO       | -       | 상품명 (Denormalized)                               |
| `quantity`          | Int               | NO       | -       | 예약 수량                                           |
| `reservationNumber` | Int               | NO       | -       | 순번 (상품별로 순차 증가)                           |
| `status`            | ReservationStatus | NO       | WAITING | 상태 (WAITING/PROMOTED/COMPLETED/CANCELLED/EXPIRED) |
| `promotedAt`        | DateTime          | YES      | -       | 승격 시각 (WAITING → PROMOTED)                      |
| `expiresAt`         | DateTime          | YES      | -       | 만료 시각 (승격 시 설정)                            |
| `createdAt`         | DateTime          | NO       | now()   | 생성 시각                                           |

**Unique Constraint**:

- `(productId, reservationNumber)` - 상품별 순번 유일성

**인덱스**:

- `reservations_productId_reservationNumber_key` (UNIQUE)
- `reservations_productId_reservationNumber_idx`
- `reservations_userId_status_idx` (복합)
- `reservations_status_expiresAt_idx` (복합) - Cron: 승격된 예약 만료

**Relations**:

- `user` (N:1)
- `product` (N:1)

---

### 8. Order (주문)

**목적**: 사용자 주문 정보

| 컬럼              | 타입           | Nullable | 기본값          | 설명                                                                      |
| ----------------- | -------------- | -------- | --------------- | ------------------------------------------------------------------------- |
| `id`              | String         | NO       | -               | 주문 번호 (ORD-YYYYMMDD-XXXXX)                                            |
| `userId`          | UUID           | NO       | -               | 사용자 (FK → users)                                                       |
| `userEmail`       | String         | NO       | -               | 이메일 (Denormalized)                                                     |
| `depositorName`   | String         | NO       | -               | 입금자명                                                                  |
| `shippingAddress` | JSON           | NO       | -               | 배송지 (복호화된 미국 주소)                                               |
| `instagramId`     | String         | NO       | -               | 인스타그램 ID                                                             |
| `subtotal`        | Decimal(10,2)  | NO       | -               | 상품 금액 합계                                                            |
| `shippingFee`     | Decimal(10,2)  | NO       | -               | 배송비                                                                    |
| `total`           | Decimal(10,2)  | NO       | -               | 총 금액                                                                   |
| `paymentMethod`   | PaymentMethod  | NO       | BANK_TRANSFER   | 결제 수단                                                                 |
| `paymentStatus`   | PaymentStatus  | NO       | PENDING         | 결제 상태 (PENDING/CONFIRMED/FAILED)                                      |
| `shippingStatus`  | ShippingStatus | NO       | PENDING         | 배송 상태 (PENDING/SHIPPED/DELIVERED)                                     |
| `status`          | OrderStatus    | NO       | PENDING_PAYMENT | 주문 상태 (PENDING_PAYMENT/PAYMENT_CONFIRMED/SHIPPED/DELIVERED/CANCELLED) |
| `paidAt`          | DateTime       | YES      | -               | 결제 확인 시각                                                            |
| `shippedAt`       | DateTime       | YES      | -               | 배송 시작 시각                                                            |
| `deliveredAt`     | DateTime       | YES      | -               | 배송 완료 시각                                                            |
| `createdAt`       | DateTime       | NO       | now()           | 생성 시각                                                                 |
| `updatedAt`       | DateTime       | NO       | -               | 수정 시각 (자동)                                                          |

**인덱스**:

- `orders_userId_idx`
- `orders_userId_createdAt_idx` (복합) - 사용자별 주문 이력
- `orders_paymentStatus_idx`
- `orders_status_idx`
- `orders_status_createdAt_idx` (복합) - Cron: 만료된 주문 취소
- `orders_paymentStatus_paidAt_idx` (복합)

**Relations**:

- `user` (N:1)
- `orderItems` (1:N)

---

### 9. OrderItem (주문 상품)

**목적**: 주문에 포함된 상품 목록

| 컬럼          | 타입          | Nullable | 기본값 | 설명                    |
| ------------- | ------------- | -------- | ------ | ----------------------- |
| `id`          | UUID          | NO       | uuid() | 기본키                  |
| `orderId`     | String        | NO       | -      | 주문 ID (FK → orders)   |
| `productId`   | UUID          | NO       | -      | 상품 ID (FK → products) |
| `productName` | String        | NO       | -      | 상품명 (Denormalized)   |
| `price`       | Decimal(10,2) | NO       | -      | 단가 (구매 시점 가격)   |
| `quantity`    | Int           | NO       | -      | 수량                    |
| `color`       | String        | YES      | -      | 색상                    |
| `size`        | String        | YES      | -      | 사이즈                  |
| `shippingFee` | Decimal(10,2) | NO       | -      | 배송비                  |

**인덱스**:

- `order_items_orderId_idx`

**Relations**:

- `order` (N:1)
- `product` (N:1)

---

### 10. NotificationTemplate (알림 템플릿)

**목적**: 자동 알림 메시지 템플릿 관리

| 컬럼        | 타입     | Nullable | 기본값 | 설명                                              |
| ----------- | -------- | -------- | ------ | ------------------------------------------------- |
| `id`        | UUID     | NO       | uuid() | 기본키                                            |
| `name`      | String   | NO       | -      | 템플릿 이름 (UNIQUE)                              |
| `type`      | String   | NO       | -      | 타입 (ORDER_CONFIRMATION, PAYMENT_REMINDER, etc.) |
| `template`  | Text     | NO       | -      | 템플릿 내용                                       |
| `createdAt` | DateTime | NO       | now()  | 생성 시각                                         |
| `updatedAt` | DateTime | NO       | -      | 수정 시각 (자동)                                  |

**인덱스**:

- `notification_templates_name_key` (UNIQUE)

---

### 11. NotificationSubscription (알림 구독)

**목적**: Web Push Notification 구독 관리

| 컬럼           | 타입     | Nullable | 기본값 | 설명                                                     |
| -------------- | -------- | -------- | ------ | -------------------------------------------------------- |
| `id`           | UUID     | NO       | uuid() | 기본키                                                   |
| `userId`       | UUID     | NO       | -      | 사용자 (FK → users, CASCADE)                             |
| `liveStreamId` | UUID     | YES      | -      | 스트림 ID (FK → live_streams, CASCADE), null = 전체 구독 |
| `endpoint`     | Text     | NO       | -      | Push API 엔드포인트 URL                                  |
| `p256dh`       | Text     | NO       | -      | 암호화 키 (base64)                                       |
| `auth`         | Text     | NO       | -      | Auth secret (base64)                                     |
| `createdAt`    | DateTime | NO       | now()  | 생성 시각                                                |

**Unique Constraint**:

- `(userId, endpoint)` - 사용자별 엔드포인트 유일성

**인덱스**:

- `notification_subscriptions_userId_endpoint_key` (UNIQUE)
- `notification_subscriptions_userId_idx`
- `notification_subscriptions_liveStreamId_idx`

**Relations**:

- `user` (N:1, onDelete: CASCADE)
- `liveStream` (N:1, onDelete: CASCADE)

---

### 12. SystemConfig (시스템 설정)

**목적**: 전역 시스템 설정 (싱글톤)

| 컬럼               | 타입     | Nullable | 기본값       | 설명                         |
| ------------------ | -------- | -------- | ------------ | ---------------------------- |
| `id`               | UUID     | NO       | uuid()       | 기본키                       |
| `noticeText`       | Text     | YES      | -            | 공지사항 텍스트              |
| `noticeFontSize`   | Int      | NO       | 14           | 공지사항 폰트 크기 (10-24px) |
| `noticeFontFamily` | String   | NO       | "Pretendard" | 공지사항 폰트 패밀리         |
| `createdAt`        | DateTime | NO       | now()        | 생성 시각                    |
| `updatedAt`        | DateTime | NO       | -            | 수정 시각 (자동)             |

**사용법**: 단일 레코드로 운영 (SELECT \* FROM system_config LIMIT 1)

---

### 13. AuditLog (감사 로그)

**목적**: 관리자 작업 이력 추적

| 컬럼        | 타입     | Nullable | 기본값 | 설명                                     |
| ----------- | -------- | -------- | ------ | ---------------------------------------- |
| `id`        | UUID     | NO       | uuid() | 기본키                                   |
| `adminId`   | UUID     | NO       | -      | 관리자 (FK → users)                      |
| `action`    | String   | NO       | -      | 작업 (CREATE, UPDATE, DELETE, etc.)      |
| `entity`    | String   | NO       | -      | 대상 엔티티 (User, Product, Order, etc.) |
| `entityId`  | UUID     | NO       | -      | 대상 ID                                  |
| `changes`   | JSON     | NO       | -      | 변경 내용 (Before/After)                 |
| `createdAt` | DateTime | NO       | now()  | 생성 시각                                |

**인덱스**:

- `audit_logs_adminId_idx`
- `audit_logs_entity_entityId_idx` (복합)

**Relations**:

- `admin` (N:1 → User, name: "AdminAuditLogs")

---

### 14. Settlement (정산)

**목적**: 판매자 정산 관리

| 컬럼               | 타입             | Nullable | 기본값  | 설명                         |
| ------------------ | ---------------- | -------- | ------- | ---------------------------- |
| `id`               | UUID             | NO       | uuid()  | 기본키                       |
| `sellerId`         | UUID             | NO       | -       | 판매자 ID                    |
| `periodStart`      | DateTime         | NO       | -       | 정산 기간 시작               |
| `periodEnd`        | DateTime         | NO       | -       | 정산 기간 종료               |
| `totalSales`       | Decimal(10,2)    | NO       | -       | 총 매출                      |
| `commission`       | Decimal(10,2)    | NO       | -       | 플랫폼 수수료                |
| `settlementAmount` | Decimal(10,2)    | NO       | -       | 정산 금액                    |
| `status`           | SettlementStatus | NO       | PENDING | 상태 (PENDING/APPROVED/PAID) |
| `createdAt`        | DateTime         | NO       | now()   | 생성 시각                    |
| `updatedAt`        | DateTime         | NO       | -       | 수정 시각 (자동)             |

---

### 15. Notice (공지사항)

**목적**: 플랫폼 공지사항 관리

| 컬럼        | 타입     | Nullable | 기본값 | 설명             |
| ----------- | -------- | -------- | ------ | ---------------- |
| `id`        | UUID     | NO       | uuid() | 기본키           |
| `title`     | String   | NO       | -      | 제목             |
| `content`   | Text     | NO       | -      | 내용             |
| `isActive`  | Boolean  | NO       | true   | 활성화 여부      |
| `createdAt` | DateTime | NO       | now()  | 생성 시각        |
| `updatedAt` | DateTime | NO       | -      | 수정 시각 (자동) |

---

## 🔗 관계 (Relationships)

### User 중심 관계

```
User
  ├─→ LiveStream (1:N)
  │     └─→ ChatMessage (1:N)
  │     └─→ Product (1:N)
  │           └─→ Cart (1:N)
  │           └─→ Reservation (1:N)
  │           └─→ OrderItem (1:N)
  ├─→ ChatMessage (1:N)
  ├─→ Cart (1:N)
  ├─→ Reservation (1:N)
  ├─→ Order (1:N)
  │     └─→ OrderItem (1:N)
  ├─→ ModerationLog (1:N, as admin)
  ├─→ AuditLog (1:N, as admin)
  └─→ NotificationSubscription (1:N)
```

### Cascade 삭제 정책

| Parent     | Child                    | onDelete |
| ---------- | ------------------------ | -------- |
| User       | NotificationSubscription | CASCADE  |
| LiveStream | NotificationSubscription | CASCADE  |

**주의**: 다른 관계는 기본적으로 `RESTRICT` (참조 무결성 보호)

---

## 📊 인덱스 전략

### 1. 단일 컬럼 인덱스

**고유 식별자**:

- `users.email` (UNIQUE)
- `users.kakaoId` (UNIQUE)
- `users.instagramId` (UNIQUE)
- `live_streams.streamKey` (UNIQUE)
- `notification_templates.name` (UNIQUE)

**빈번한 조회**:

- `users.email`
- `users.kakaoId`
- `live_streams.streamKey`
- `live_streams.userId`
- `live_streams.status`
- `products.streamKey`
- `products.status`
- `orders.userId`
- `orders.paymentStatus`
- `orders.status`

### 2. 복합 인덱스 (Composite Index)

**성능 최적화**:

| 테이블                       | 인덱스                              | 용도                             |
| ---------------------------- | ----------------------------------- | -------------------------------- |
| `chat_messages`              | `(streamKey, timestamp)`            | 스트림별 채팅 이력 조회          |
| `products`                   | `(streamKey, status)`               | 스트림별 판매 가능 상품 조회     |
| `products`                   | `(status, createdAt)`               | 스토어 상품 목록 (최신순)        |
| `carts`                      | `(userId, status)`                  | 사용자 장바구니 조회             |
| `carts`                      | `(productId, status)`               | 상품별 예약 수량 계산 (N+1 방지) |
| `carts`                      | `(status, timerEnabled, expiresAt)` | Cron: 만료된 장바구니 처리       |
| `reservations`               | `(productId, reservationNumber)`    | 예약 순번 조회 (UNIQUE)          |
| `reservations`               | `(userId, status)`                  | 사용자 예약 목록                 |
| `reservations`               | `(status, expiresAt)`               | Cron: 승격된 예약 만료 처리      |
| `orders`                     | `(userId, createdAt)`               | 사용자 주문 이력 (최신순)        |
| `orders`                     | `(status, createdAt)`               | Cron: 만료된 주문 취소           |
| `orders`                     | `(paymentStatus, paidAt)`           | 결제 상태별 정렬                 |
| `audit_logs`                 | `(entity, entityId)`                | 특정 엔티티 변경 이력 조회       |
| `notification_subscriptions` | `(userId, endpoint)`                | 중복 구독 방지 (UNIQUE)          |

### 3. Cron Job 최적화 인덱스

**정기 배치 작업**:

```sql
-- 만료된 장바구니 처리 (매 1분)
SELECT * FROM carts
WHERE status = 'ACTIVE'
  AND timerEnabled = true
  AND expiresAt < NOW();
-- Index: carts_status_timerEnabled_expiresAt_idx

-- 승격된 예약 만료 처리 (매 5분)
SELECT * FROM reservations
WHERE status = 'PROMOTED'
  AND expiresAt < NOW();
-- Index: reservations_status_expiresAt_idx

-- 미결제 주문 취소 (매 1시간)
SELECT * FROM orders
WHERE status = 'PENDING_PAYMENT'
  AND createdAt < NOW() - INTERVAL '24 hours';
-- Index: orders_status_createdAt_idx
```

---

## 🏷️ Enum 타입

### 1. Role (사용자 역할)

```typescript
enum Role {
  USER    // 일반 사용자
  ADMIN   // 관리자
}
```

### 2. UserStatus (사용자 상태)

```typescript
enum UserStatus {
  ACTIVE      // 활성
  INACTIVE    // 비활성
  SUSPENDED   // 정지
}
```

### 3. StreamStatus (방송 상태)

```typescript
enum StreamStatus {
  PENDING   // 대기 (스트림 키 생성됨, 방송 시작 전)
  LIVE      // 라이브 중
  OFFLINE   // 종료
}
```

### 4. ProductStatus (상품 상태)

```typescript
enum ProductStatus {
  AVAILABLE   // 판매 가능
  SOLD_OUT    // 품절
}
```

### 5. CartStatus (장바구니 상태)

```typescript
enum CartStatus {
  ACTIVE      // 활성 (장바구니에 담김)
  EXPIRED     // 만료 (타이머 시간 초과)
  COMPLETED   // 완료 (주문으로 전환)
}
```

### 6. ReservationStatus (예약 상태)

```typescript
enum ReservationStatus {
  WAITING     // 대기 중
  PROMOTED    // 승격됨 (재고 확보, 타이머 시작)
  COMPLETED   // 완료 (주문으로 전환)
  CANCELLED   // 취소됨
  EXPIRED     // 만료됨 (승격 후 타이머 시간 초과)
}
```

### 7. PaymentMethod (결제 수단)

```typescript
enum PaymentMethod {
  BANK_TRANSFER, // 무통장 입금 (MVP에서는 이것만 지원)
}
```

### 8. PaymentStatus (결제 상태)

```typescript
enum PaymentStatus {
  PENDING     // 입금 대기
  CONFIRMED   // 입금 확인됨
  FAILED      // 결제 실패
}
```

### 9. ShippingStatus (배송 상태)

```typescript
enum ShippingStatus {
  PENDING     // 배송 준비 중
  SHIPPED     // 배송 중
  DELIVERED   // 배송 완료
}
```

### 10. OrderStatus (주문 상태)

```typescript
enum OrderStatus {
  PENDING_PAYMENT      // 입금 대기
  PAYMENT_CONFIRMED    // 입금 확인됨
  SHIPPED              // 배송 중
  DELIVERED            // 배송 완료
  CANCELLED            // 취소됨
}
```

### 11. ModerationAction (관리 조치)

```typescript
enum ModerationAction {
  DELETE_MESSAGE   // 메시지 삭제
  MUTE             // 음소거
  BAN              // 차단
}
```

### 12. SettlementStatus (정산 상태)

```typescript
enum SettlementStatus {
  PENDING    // 정산 대기
  APPROVED   // 정산 승인
  PAID       // 정산 완료
}
```

---

## 🔒 데이터 무결성

### 1. 외래 키 제약 조건

모든 관계는 Prisma에 의해 자동으로 외래 키 제약이 설정됩니다.

**예시**:

```sql
ALTER TABLE "live_streams"
  ADD CONSTRAINT "live_streams_userId_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "users"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
```

### 2. Unique 제약 조건

| 테이블                       | 컬럼                             | 목적                    |
| ---------------------------- | -------------------------------- | ----------------------- |
| `users`                      | `email`                          | 이메일 중복 방지        |
| `users`                      | `kakaoId`                        | 카카오 ID 중복 방지     |
| `users`                      | `instagramId`                    | 인스타그램 ID 중복 방지 |
| `live_streams`               | `streamKey`                      | 스트림 키 중복 방지     |
| `reservations`               | `(productId, reservationNumber)` | 상품별 순번 유일성      |
| `notification_templates`     | `name`                           | 템플릿 이름 중복 방지   |
| `notification_subscriptions` | `(userId, endpoint)`             | 중복 구독 방지          |

### 3. Check 제약 조건 (Application Level)

Prisma는 기본적으로 DB 레벨 CHECK 제약을 지원하지 않으므로, 애플리케이션 레벨에서 검증:

**검증 규칙**:

- `Product.price` >= 0
- `Product.quantity` >= 0
- `Product.discountRate` >= 0 AND <= 100
- `Cart.quantity` > 0
- `Order.total` >= 0
- `SystemConfig.noticeFontSize` >= 10 AND <= 24

### 4. Not Null 제약

대부분의 필수 필드는 `NOT NULL` 제약이 있습니다.

**선택적 (Nullable) 필드**:

- 사용자 프로필 관련: `email`, `depositorName`, `instagramId`, `shippingAddress`
- 방송 통계: `startedAt`, `endedAt`, `totalDuration`
- 타이머 관련: `expiresAt`
- 상태 변경 타임스탬프: `profileCompletedAt`, `suspendedAt`, `paidAt`, `shippedAt`, `deliveredAt`

---

## 📈 데이터 흐름 시나리오

### 시나리오 1: 상품 구매 플로우

```
1. User가 LiveStream 시청 중 Product 발견
2. Product를 Cart에 추가
   - timerEnabled = true인 경우 → expiresAt 설정
   - Product.quantity 감소 (예약)
3. Timer 만료 전에 주문 생성
   - Order 생성 (status = PENDING_PAYMENT)
   - OrderItem 생성 (Cart의 상품 정보 복사)
   - Cart.status = COMPLETED
4. 사용자가 무통장 입금
5. 관리자가 입금 확인
   - Order.paymentStatus = CONFIRMED
   - Order.status = PAYMENT_CONFIRMED
   - Order.paidAt = NOW()
6. 배송 시작
   - Order.shippingStatus = SHIPPED
   - Order.status = SHIPPED
   - Order.shippedAt = NOW()
7. 배송 완료
   - Order.shippingStatus = DELIVERED
   - Order.status = DELIVERED
   - Order.deliveredAt = NOW()
```

### 시나리오 2: 예약 대기열 플로우

```
1. Product가 품절 (status = SOLD_OUT)
2. User가 Reservation 생성
   - reservationNumber = MAX(reservationNumber) + 1
   - status = WAITING
3. 재고 복원 (Cart 타이머 만료 or 주문 취소)
   - Product.quantity 증가
4. Cron Job이 WAITING 예약을 PROMOTED로 승격
   - Reservation.status = PROMOTED
   - Reservation.promotedAt = NOW()
   - Reservation.expiresAt = NOW() + 10분
   - Product.quantity 감소
5. 사용자가 승격 알림 수신 후 주문 생성
   - Reservation.status = COMPLETED
6. 만료 시간 초과 시
   - Reservation.status = EXPIRED
   - Product.quantity 복원
   - 다음 대기자 승격
```

---

## 🛠️ 마이그레이션

### 초기 마이그레이션 생성

```bash
cd backend
npx prisma migrate dev --name init
```

### 새 마이그레이션 생성

```bash
npx prisma migrate dev --name add_new_feature
```

### Production 마이그레이션 적용

```bash
npx prisma migrate deploy
```

### 마이그레이션 상태 확인

```bash
npx prisma migrate status
```

---

## 📊 성능 최적화 권장사항

### 1. 인덱스 모니터링

```sql
-- PostgreSQL에서 인덱스 사용량 확인
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### 2. 느린 쿼리 식별

```sql
-- PostgreSQL slow query 로깅 활성화
ALTER DATABASE live_commerce SET log_min_duration_statement = 1000; -- 1초 이상 쿼리

-- 실행 계획 확인
EXPLAIN ANALYZE SELECT * FROM products WHERE streamKey = 'xxx' AND status = 'AVAILABLE';
```

### 3. Denormalization 전략

다음 필드들은 의도적으로 denormalized (이력 보존):

- `Cart.productName`, `Cart.price`
- `Reservation.productName`
- `Order.userEmail`, `Order.depositorName`, `Order.instagramId`, `Order.shippingAddress`
- `OrderItem.productName`, `OrderItem.price`

**이유**: 상품이나 사용자 정보가 변경되어도 주문 이력은 주문 당시의 정보를 보존해야 함

### 4. JSON 필드 사용

**암호화된 데이터**:

- `User.shippingAddress` (JSON) - 애플리케이션 레벨 AES-256-GCM 암호화
- `Order.shippingAddress` (JSON) - 복호화된 주소 저장
- `AuditLog.changes` (JSON) - Before/After 스냅샷

---

## 📞 문의

**Database 담당**: backend@dorami.com
**Schema 변경 요청**: architecture@dorami.com

---

**작성자**: Claude (Sonnet 4.5)
**최종 업데이트**: 2026-02-05
**버전**: 1.0.0
