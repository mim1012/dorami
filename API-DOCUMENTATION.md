# API Documentation

**프로젝트**: Dorami Live Commerce
**버전**: 1.0.0 (MVP)
**Base URL**: `https://api.dorami.com/api` (Production)
**Base URL**: `https://api-staging.dorami.com/api` (Staging)
**Base URL**: `http://localhost:3001/api` (Local Development)
**작성일**: 2026-02-05

---

## 📋 목차

1. [개요](#개요)
2. [인증](#인증)
3. [API 엔드포인트](#api-엔드포인트)
4. [에러 처리](#에러-처리)
5. [Rate Limiting](#rate-limiting)
6. [WebSocket](#websocket)

---

## 🏗️ 개요

### 기술 스택

- **Framework**: NestJS 10.x
- **Authentication**: JWT (Kakao OAuth2.0)
- **Database**: PostgreSQL 16 via Prisma
- **Cache**: Redis 7
- **WebSocket**: Socket.io
- **File Upload**: Multipart/form-data
- **Security**: Helmet, CORS, CSRF Protection, Rate Limiting

### API 특징

- **RESTful** 설계 원칙 준수
- **JWT 기반** 인증
- **Role-based** 접근 제어 (USER, ADMIN)
- **Pagination** 지원 (Cursor-based)
- **Real-time** 업데이트 (WebSocket)
- **Validation** 자동화 (class-validator)

---

## 🔐 인증

### 인증 플로우

```
1. 사용자가 Kakao 로그인 버튼 클릭
   ↓
2. Frontend가 Kakao OAuth URL로 리다이렉트
   ↓
3. Kakao에서 Authorization Code 발급
   ↓
4. Frontend가 Backend로 Code 전송 (POST /auth/kakao/callback)
   ↓
5. Backend가 Kakao API로 Access Token 교환
   ↓
6. Backend가 사용자 정보 조회 및 DB 저장/업데이트
   ↓
7. Backend가 JWT 토큰 발급 및 반환
   ↓
8. Frontend가 JWT를 localStorage에 저장
   ↓
9. 이후 모든 요청에 Authorization: Bearer {token} 헤더 포함
```

### 헤더 형식

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 토큰 갱신

JWT 토큰은 만료 시간이 있으므로, 만료 전에 `/auth/refresh`를 호출하여 갱신해야 합니다.

---

## 📡 API 엔드포인트

### 1. Health Check

#### `GET /health`

서버 상태 확인 (인증 불필요)

**Response**:

```json
{
  "status": "ok",
  "timestamp": "2026-02-05T12:00:00.000Z",
  "uptime": 123456,
  "version": "1.0.0"
}
```

---

### 2. Authentication (인증)

#### `POST /auth/kakao/callback`

Kakao OAuth 콜백 처리

**Request Body**:

```json
{
  "code": "string"
}
```

**Response**:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "kakaoId": "1234567890",
    "email": "user@example.com",
    "name": "홍길동",
    "role": "USER",
    "status": "ACTIVE"
  }
}
```

#### `GET /auth/me`

현재 로그인한 사용자 정보 조회 (인증 필요)

**Headers**:

```
Authorization: Bearer {token}
```

**Response**:

```json
{
  "id": "uuid",
  "kakaoId": "1234567890",
  "email": "user@example.com",
  "name": "홍길동",
  "role": "USER",
  "status": "ACTIVE",
  "depositorName": "홍길동",
  "instagramId": "@honggildong",
  "shippingAddress": {
    "fullName": "Hong Gildong",
    "address1": "123 Main St",
    "address2": "Apt 456",
    "city": "Seoul",
    "state": "Seoul",
    "zip": "12345",
    "phone": "(555) 123-4567"
  },
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-02-05T12:00:00.000Z"
}
```

#### `POST /auth/logout`

로그아웃 (인증 필요)

**Headers**:

```
Authorization: Bearer {token}
```

**Response**:

```json
{
  "message": "Logged out successfully"
}
```

#### `POST /auth/refresh`

JWT 토큰 갱신 (인증 필요)

**Headers**:

```
Authorization: Bearer {token}
```

**Response**:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 3. Users (사용자 프로필)

#### `PATCH /users/profile`

프로필 정보 업데이트 (인증 필요)

**Headers**:

```
Authorization: Bearer {token}
```

**Request Body**:

```json
{
  "depositorName": "홍길동",
  "instagramId": "@honggildong",
  "shippingAddress": {
    "fullName": "Hong Gildong",
    "address1": "123 Main St",
    "address2": "Apt 456",
    "city": "Seoul",
    "state": "Seoul",
    "zip": "12345",
    "phone": "(555) 123-4567"
  }
}
```

**Response**:

```json
{
  "id": "uuid",
  "depositorName": "홍길동",
  "instagramId": "@honggildong",
  "shippingAddress": { ... },
  "profileCompletedAt": "2026-02-05T12:00:00.000Z",
  "updatedAt": "2026-02-05T12:00:00.000Z"
}
```

---

### 4. Live Streaming (라이브 방송)

#### `POST /streaming/create-stream-key`

새 스트림 키 생성 (인증 필요, ADMIN만)

**Headers**:

```
Authorization: Bearer {token}
```

**Request Body**:

```json
{
  "title": "New Live Stream"
}
```

**Response**:

```json
{
  "id": "uuid",
  "streamKey": "live_abc123xyz456",
  "title": "New Live Stream",
  "status": "PENDING",
  "expiresAt": "2026-02-06T12:00:00.000Z",
  "createdAt": "2026-02-05T12:00:00.000Z"
}
```

#### `GET /streaming/active`

현재 라이브 중인 방송 목록 조회 (인증 불필요)

**Response**:

```json
{
  "streams": [
    {
      "id": "uuid",
      "streamKey": "live_abc123xyz456",
      "title": "Live Stream Title",
      "status": "LIVE",
      "startedAt": "2026-02-05T11:00:00.000Z",
      "peakViewers": 120,
      "streamer": {
        "id": "uuid",
        "name": "Streamer Name"
      }
    }
  ]
}
```

#### `POST /streaming/:streamKey/start`

방송 시작 (인증 필요, ADMIN만)

**Headers**:

```
Authorization: Bearer {token}
```

**Response**:

```json
{
  "id": "uuid",
  "streamKey": "live_abc123xyz456",
  "status": "LIVE",
  "startedAt": "2026-02-05T12:00:00.000Z"
}
```

#### `POST /streaming/:streamKey/end`

방송 종료 (인증 필요, ADMIN만)

**Headers**:

```
Authorization: Bearer {token}
```

**Response**:

```json
{
  "id": "uuid",
  "streamKey": "live_abc123xyz456",
  "status": "OFFLINE",
  "endedAt": "2026-02-05T13:00:00.000Z",
  "totalDuration": 3600,
  "peakViewers": 150
}
```

---

### 5. Products (상품 관리)

#### `POST /products`

새 상품 생성 (인증 필요, ADMIN만)

**Headers**:

```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body**:

```json
{
  "streamKey": "live_abc123xyz456",
  "name": "Product Name",
  "price": 29.99,
  "quantity": 100,
  "colorOptions": ["Red", "Blue", "Green"],
  "sizeOptions": ["S", "M", "L", "XL"],
  "shippingFee": 5.0,
  "freeShippingMessage": "Free shipping on orders over $50",
  "timerEnabled": true,
  "timerDuration": 10,
  "imageUrl": "https://cdn.dorami.com/products/abc123.jpg",
  "isNew": true,
  "discountRate": 10.0,
  "originalPrice": 33.32
}
```

**Response**:

```json
{
  "id": "uuid",
  "streamKey": "live_abc123xyz456",
  "name": "Product Name",
  "price": 29.99,
  "quantity": 100,
  "colorOptions": ["Red", "Blue", "Green"],
  "sizeOptions": ["S", "M", "L", "XL"],
  "shippingFee": 5.0,
  "freeShippingMessage": "Free shipping on orders over $50",
  "timerEnabled": true,
  "timerDuration": 10,
  "imageUrl": "https://cdn.dorami.com/products/abc123.jpg",
  "isNew": true,
  "discountRate": 10.0,
  "originalPrice": 33.32,
  "status": "AVAILABLE",
  "createdAt": "2026-02-05T12:00:00.000Z",
  "updatedAt": "2026-02-05T12:00:00.000Z"
}
```

#### `GET /products`

상품 목록 조회 (인증 불필요)

**Query Parameters**:

- `streamKey` (optional): 특정 방송의 상품만 조회
- `status` (optional): `AVAILABLE` | `SOLD_OUT`
- `cursor` (optional): Pagination cursor
- `limit` (optional, default: 20): 페이지 크기

**Response**:

```json
{
  "products": [
    {
      "id": "uuid",
      "streamKey": "live_abc123xyz456",
      "name": "Product Name",
      "price": 29.99,
      "quantity": 95,
      "colorOptions": ["Red", "Blue"],
      "sizeOptions": ["S", "M", "L"],
      "shippingFee": 5.0,
      "timerEnabled": true,
      "timerDuration": 10,
      "imageUrl": "https://cdn.dorami.com/products/abc123.jpg",
      "isNew": true,
      "discountRate": 10.0,
      "originalPrice": 33.32,
      "status": "AVAILABLE",
      "createdAt": "2026-02-05T12:00:00.000Z"
    }
  ],
  "nextCursor": "uuid",
  "hasMore": true
}
```

#### `GET /products/:id`

상품 상세 조회 (인증 불필요)

**Response**:

```json
{
  "id": "uuid",
  "streamKey": "live_abc123xyz456",
  "name": "Product Name",
  "price": 29.99,
  "quantity": 95,
  "colorOptions": ["Red", "Blue", "Green"],
  "sizeOptions": ["S", "M", "L", "XL"],
  "shippingFee": 5.0,
  "freeShippingMessage": "Free shipping on orders over $50",
  "timerEnabled": true,
  "timerDuration": 10,
  "imageUrl": "https://cdn.dorami.com/products/abc123.jpg",
  "isNew": true,
  "discountRate": 10.0,
  "originalPrice": 33.32,
  "status": "AVAILABLE",
  "createdAt": "2026-02-05T12:00:00.000Z",
  "updatedAt": "2026-02-05T12:00:00.000Z"
}
```

#### `PATCH /products/:id`

상품 정보 수정 (인증 필요, ADMIN만)

**Headers**:

```
Authorization: Bearer {token}
```

**Request Body** (모든 필드 optional):

```json
{
  "name": "Updated Name",
  "price": 24.99,
  "quantity": 80,
  "status": "SOLD_OUT"
}
```

**Response**:

```json
{
  "id": "uuid",
  "name": "Updated Name",
  "price": 24.99,
  "quantity": 80,
  "status": "SOLD_OUT",
  "updatedAt": "2026-02-05T12:30:00.000Z"
}
```

#### `DELETE /products/:id`

상품 삭제 (인증 필요, ADMIN만)

**Headers**:

```
Authorization: Bearer {token}
```

**Response**:

```json
{
  "message": "Product deleted successfully"
}
```

---

### 6. Cart (장바구니)

#### `POST /cart`

장바구니에 상품 추가 (인증 필요)

**Headers**:

```
Authorization: Bearer {token}
```

**Request Body**:

```json
{
  "productId": "uuid",
  "quantity": 2,
  "color": "Red",
  "size": "M"
}
```

**Response**:

```json
{
  "id": "uuid",
  "userId": "uuid",
  "productId": "uuid",
  "productName": "Product Name",
  "price": 29.99,
  "quantity": 2,
  "color": "Red",
  "size": "M",
  "shippingFee": 5.0,
  "timerEnabled": true,
  "expiresAt": "2026-02-05T12:10:00.000Z",
  "status": "ACTIVE",
  "createdAt": "2026-02-05T12:00:00.000Z"
}
```

#### `GET /cart`

장바구니 조회 (인증 필요)

**Headers**:

```
Authorization: Bearer {token}
```

**Response**:

```json
{
  "items": [
    {
      "id": "uuid",
      "productId": "uuid",
      "productName": "Product Name",
      "price": 29.99,
      "quantity": 2,
      "color": "Red",
      "size": "M",
      "shippingFee": 5.0,
      "timerEnabled": true,
      "expiresAt": "2026-02-05T12:10:00.000Z",
      "status": "ACTIVE",
      "createdAt": "2026-02-05T12:00:00.000Z"
    }
  ],
  "summary": {
    "subtotal": 59.98,
    "shippingFee": 5.0,
    "total": 64.98,
    "itemCount": 1
  }
}
```

#### `DELETE /cart/:id`

장바구니 아이템 삭제 (인증 필요)

**Headers**:

```
Authorization: Bearer {token}
```

**Response**:

```json
{
  "message": "Cart item removed successfully"
}
```

---

### 7. Reservations (예약 대기열)

#### `POST /reservation`

품절 상품 예약 (인증 필요)

**Headers**:

```
Authorization: Bearer {token}
```

**Request Body**:

```json
{
  "productId": "uuid",
  "quantity": 1
}
```

**Response**:

```json
{
  "id": "uuid",
  "userId": "uuid",
  "productId": "uuid",
  "productName": "Product Name",
  "quantity": 1,
  "reservationNumber": 15,
  "status": "WAITING",
  "createdAt": "2026-02-05T12:00:00.000Z"
}
```

#### `GET /reservation`

내 예약 목록 조회 (인증 필요)

**Headers**:

```
Authorization: Bearer {token}
```

**Response**:

```json
{
  "reservations": [
    {
      "id": "uuid",
      "productId": "uuid",
      "productName": "Product Name",
      "quantity": 1,
      "reservationNumber": 15,
      "status": "WAITING",
      "promotedAt": null,
      "expiresAt": null,
      "createdAt": "2026-02-05T12:00:00.000Z"
    }
  ]
}
```

#### `DELETE /reservation/:id`

예약 취소 (인증 필요)

**Headers**:

```
Authorization: Bearer {token}
```

**Response**:

```json
{
  "message": "Reservation cancelled successfully"
}
```

---

### 8. Orders (주문)

#### `POST /orders`

주문 생성 (인증 필요)

**Headers**:

```
Authorization: Bearer {token}
```

**Request Body**:

```json
{
  "cartItemIds": ["uuid1", "uuid2"],
  "depositorName": "홍길동",
  "shippingAddress": {
    "fullName": "Hong Gildong",
    "address1": "123 Main St",
    "address2": "Apt 456",
    "city": "Seoul",
    "state": "Seoul",
    "zip": "12345",
    "phone": "(555) 123-4567"
  },
  "instagramId": "@honggildong"
}
```

**Response**:

```json
{
  "id": "ORD-20260205-00001",
  "userId": "uuid",
  "userEmail": "user@example.com",
  "depositorName": "홍길동",
  "shippingAddress": { ... },
  "instagramId": "@honggildong",
  "subtotal": 59.98,
  "shippingFee": 5.00,
  "total": 64.98,
  "paymentMethod": "BANK_TRANSFER",
  "paymentStatus": "PENDING",
  "shippingStatus": "PENDING",
  "status": "PENDING_PAYMENT",
  "items": [
    {
      "id": "uuid",
      "productId": "uuid",
      "productName": "Product Name",
      "price": 29.99,
      "quantity": 2,
      "color": "Red",
      "size": "M",
      "shippingFee": 5.00
    }
  ],
  "bankTransferInfo": {
    "bankName": "우리은행",
    "accountNumber": "1002-123-456789",
    "accountHolder": "도라미 주식회사",
    "amount": 64.98,
    "depositorName": "홍길동"
  },
  "createdAt": "2026-02-05T12:00:00.000Z"
}
```

#### `GET /orders`

내 주문 목록 조회 (인증 필요)

**Headers**:

```
Authorization: Bearer {token}
```

**Query Parameters**:

- `status` (optional): `PENDING_PAYMENT` | `PAYMENT_CONFIRMED` | `SHIPPED` | `DELIVERED` | `CANCELLED`
- `cursor` (optional): Pagination cursor
- `limit` (optional, default: 20)

**Response**:

```json
{
  "orders": [
    {
      "id": "ORD-20260205-00001",
      "subtotal": 59.98,
      "shippingFee": 5.0,
      "total": 64.98,
      "paymentStatus": "PENDING",
      "shippingStatus": "PENDING",
      "status": "PENDING_PAYMENT",
      "itemCount": 1,
      "createdAt": "2026-02-05T12:00:00.000Z"
    }
  ],
  "nextCursor": "uuid",
  "hasMore": false
}
```

#### `GET /orders/:id`

주문 상세 조회 (인증 필요)

**Headers**:

```
Authorization: Bearer {token}
```

**Response**:

```json
{
  "id": "ORD-20260205-00001",
  "userId": "uuid",
  "userEmail": "user@example.com",
  "depositorName": "홍길동",
  "shippingAddress": { ... },
  "instagramId": "@honggildong",
  "subtotal": 59.98,
  "shippingFee": 5.00,
  "total": 64.98,
  "paymentMethod": "BANK_TRANSFER",
  "paymentStatus": "PENDING",
  "shippingStatus": "PENDING",
  "status": "PENDING_PAYMENT",
  "items": [
    {
      "id": "uuid",
      "productId": "uuid",
      "productName": "Product Name",
      "price": 29.99,
      "quantity": 2,
      "color": "Red",
      "size": "M",
      "shippingFee": 5.00
    }
  ],
  "bankTransferInfo": {
    "bankName": "우리은행",
    "accountNumber": "1002-123-456789",
    "accountHolder": "도라미 주식회사",
    "amount": 64.98,
    "depositorName": "홍길동"
  },
  "paidAt": null,
  "shippedAt": null,
  "deliveredAt": null,
  "createdAt": "2026-02-05T12:00:00.000Z",
  "updatedAt": "2026-02-05T12:00:00.000Z"
}
```

---

### 9. Admin (관리자 전용)

#### `PATCH /admin/orders/:id/payment-status`

주문 결제 상태 변경 (인증 필요, ADMIN만)

**Headers**:

```
Authorization: Bearer {token}
```

**Request Body**:

```json
{
  "paymentStatus": "CONFIRMED"
}
```

**Response**:

```json
{
  "id": "ORD-20260205-00001",
  "paymentStatus": "CONFIRMED",
  "status": "PAYMENT_CONFIRMED",
  "paidAt": "2026-02-05T13:00:00.000Z",
  "updatedAt": "2026-02-05T13:00:00.000Z"
}
```

#### `PATCH /admin/orders/:id/shipping-status`

주문 배송 상태 변경 (인증 필요, ADMIN만)

**Headers**:

```
Authorization: Bearer {token}
```

**Request Body**:

```json
{
  "shippingStatus": "SHIPPED"
}
```

**Response**:

```json
{
  "id": "ORD-20260205-00001",
  "shippingStatus": "SHIPPED",
  "status": "SHIPPED",
  "shippedAt": "2026-02-05T14:00:00.000Z",
  "updatedAt": "2026-02-05T14:00:00.000Z"
}
```

#### `GET /admin/users`

사용자 목록 조회 (인증 필요, ADMIN만)

**Headers**:

```
Authorization: Bearer {token}
```

**Query Parameters**:

- `status` (optional): `ACTIVE` | `INACTIVE` | `SUSPENDED`
- `cursor` (optional)
- `limit` (optional, default: 20)

**Response**:

```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "홍길동",
      "role": "USER",
      "status": "ACTIVE",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "lastLoginAt": "2026-02-05T10:00:00.000Z"
    }
  ],
  "nextCursor": "uuid",
  "hasMore": true
}
```

#### `PATCH /admin/users/:id/status`

사용자 상태 변경 (인증 필요, ADMIN만)

**Headers**:

```
Authorization: Bearer {token}
```

**Request Body**:

```json
{
  "status": "SUSPENDED",
  "reason": "Violation of terms of service"
}
```

**Response**:

```json
{
  "id": "uuid",
  "status": "SUSPENDED",
  "suspendedAt": "2026-02-05T15:00:00.000Z",
  "suspensionReason": "Violation of terms of service",
  "updatedAt": "2026-02-05T15:00:00.000Z"
}
```

#### `GET /admin/settlements`

정산 목록 조회 (인증 필요, ADMIN만)

**Headers**:

```
Authorization: Bearer {token}
```

**Response**:

```json
{
  "settlements": [
    {
      "id": "uuid",
      "sellerId": "uuid",
      "periodStart": "2026-01-01T00:00:00.000Z",
      "periodEnd": "2026-01-31T23:59:59.000Z",
      "totalSales": 10000.0,
      "commission": 1000.0,
      "settlementAmount": 9000.0,
      "status": "PENDING",
      "createdAt": "2026-02-01T00:00:00.000Z"
    }
  ]
}
```

---

### 10. Notifications (알림)

#### `POST /notifications/subscribe`

Push Notification 구독 (인증 필요)

**Headers**:

```
Authorization: Bearer {token}
```

**Request Body**:

```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "base64-encoded-key",
      "auth": "base64-encoded-secret"
    }
  },
  "liveStreamId": "uuid" // optional, null = subscribe to all
}
```

**Response**:

```json
{
  "id": "uuid",
  "userId": "uuid",
  "liveStreamId": "uuid",
  "createdAt": "2026-02-05T12:00:00.000Z"
}
```

#### `DELETE /notifications/unsubscribe`

Push Notification 구독 해제 (인증 필요)

**Headers**:

```
Authorization: Bearer {token}
```

**Request Body**:

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

**Response**:

```json
{
  "message": "Unsubscribed successfully"
}
```

---

### 11. Store (스토어 페이지)

#### `GET /store/products`

스토어 상품 목록 조회 (인증 불필요)

**Query Parameters**:

- `status` (optional): `AVAILABLE` | `SOLD_OUT`
- `sortBy` (optional): `createdAt` | `price`
- `order` (optional): `asc` | `desc` (default: `desc`)
- `cursor` (optional)
- `limit` (optional, default: 20)

**Response**:

```json
{
  "products": [
    {
      "id": "uuid",
      "name": "Product Name",
      "price": 29.99,
      "quantity": 95,
      "imageUrl": "https://cdn.dorami.com/products/abc123.jpg",
      "isNew": true,
      "discountRate": 10.0,
      "originalPrice": 33.32,
      "status": "AVAILABLE",
      "createdAt": "2026-02-05T12:00:00.000Z"
    }
  ],
  "nextCursor": "uuid",
  "hasMore": true
}
```

---

### 12. Notices (공지사항)

#### `GET /notices`

공지사항 목록 조회 (인증 불필요)

**Query Parameters**:

- `isActive` (optional): `true` | `false`

**Response**:

```json
{
  "notices": [
    {
      "id": "uuid",
      "title": "Notice Title",
      "content": "Notice content...",
      "isActive": true,
      "createdAt": "2026-02-05T00:00:00.000Z",
      "updatedAt": "2026-02-05T00:00:00.000Z"
    }
  ]
}
```

#### `POST /notices`

공지사항 생성 (인증 필요, ADMIN만)

**Headers**:

```
Authorization: Bearer {token}
```

**Request Body**:

```json
{
  "title": "Notice Title",
  "content": "Notice content...",
  "isActive": true
}
```

**Response**:

```json
{
  "id": "uuid",
  "title": "Notice Title",
  "content": "Notice content...",
  "isActive": true,
  "createdAt": "2026-02-05T12:00:00.000Z",
  "updatedAt": "2026-02-05T12:00:00.000Z"
}
```

---

### 13. Upload (파일 업로드)

#### `POST /upload/image`

이미지 업로드 (인증 필요, ADMIN만)

**Headers**:

```
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request Body**:

```
file: [binary data]
```

**Response**:

```json
{
  "url": "https://cdn.dorami.com/uploads/abc123def456.jpg"
}
```

---

## ⚠️ 에러 처리

### 에러 응답 형식

모든 에러는 다음 형식으로 반환됩니다:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    {
      "field": "email",
      "message": "email must be a valid email address"
    }
  ]
}
```

### HTTP 상태 코드

| 코드  | 의미                  | 설명                                   |
| ----- | --------------------- | -------------------------------------- |
| `200` | OK                    | 요청 성공                              |
| `201` | Created               | 리소스 생성 성공                       |
| `400` | Bad Request           | 잘못된 요청 (유효성 검증 실패)         |
| `401` | Unauthorized          | 인증 실패 (토큰 없음 또는 무효)        |
| `403` | Forbidden             | 권한 없음 (ADMIN 권한 필요)            |
| `404` | Not Found             | 리소스를 찾을 수 없음                  |
| `409` | Conflict              | 리소스 충돌 (예: 이미 존재하는 이메일) |
| `429` | Too Many Requests     | Rate Limit 초과                        |
| `500` | Internal Server Error | 서버 내부 오류                         |

### 주요 에러 케이스

#### 1. 인증 오류

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Invalid or expired token"
}
```

#### 2. 권한 오류

```json
{
  "statusCode": 403,
  "message": "Forbidden",
  "error": "Insufficient permissions. ADMIN role required."
}
```

#### 3. 유효성 검증 오류

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    {
      "field": "quantity",
      "message": "quantity must be greater than 0"
    }
  ]
}
```

#### 4. 리소스 없음

```json
{
  "statusCode": 404,
  "message": "Product not found",
  "error": "Not Found"
}
```

#### 5. 재고 부족

```json
{
  "statusCode": 409,
  "message": "Insufficient stock",
  "error": "Conflict",
  "details": {
    "requested": 10,
    "available": 5
  }
}
```

---

## 🔒 Rate Limiting

### 제한 정책

| 엔드포인트             | 제한         | 기간 |
| ---------------------- | ------------ | ---- |
| `/auth/kakao/callback` | 10 requests  | 15분 |
| `/auth/refresh`        | 20 requests  | 15분 |
| `/cart` (POST)         | 30 requests  | 1분  |
| `/orders` (POST)       | 10 requests  | 1분  |
| 기타 API               | 100 requests | 15분 |

### Rate Limit 헤더

응답 헤더에 Rate Limit 정보가 포함됩니다:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704448800
```

### Rate Limit 초과 시

```json
{
  "statusCode": 429,
  "message": "Too Many Requests",
  "error": "Rate limit exceeded. Please try again in 60 seconds.",
  "retryAfter": 60
}
```

---

## 🔌 WebSocket

### 연결

**URL**: `wss://api.dorami.com` (Production)
**URL**: `ws://localhost:3001` (Local)

### 이벤트

#### Client → Server

**1. join-stream**

라이브 방송 참여

```javascript
socket.emit('join-stream', {
  streamKey: 'live_abc123xyz456',
  userId: 'uuid', // optional, for authenticated users
});
```

**2. leave-stream**

라이브 방송 나가기

```javascript
socket.emit('leave-stream', {
  streamKey: 'live_abc123xyz456',
});
```

**3. send-chat**

채팅 메시지 전송 (인증 필요)

```javascript
socket.emit('send-chat', {
  streamKey: 'live_abc123xyz456',
  userId: 'uuid',
  content: 'Hello, world!',
});
```

#### Server → Client

**1. viewer-count**

시청자 수 업데이트

```javascript
socket.on('viewer-count', (data) => {
  console.log(data);
  // { streamKey: 'live_abc123xyz456', count: 120 }
});
```

**2. chat-message**

새 채팅 메시지

```javascript
socket.on('chat-message', (message) => {
  console.log(message);
  // {
  //   id: 'uuid',
  //   streamKey: 'live_abc123xyz456',
  //   userId: 'uuid',
  //   user: { name: '홍길동', role: 'USER' },
  //   content: 'Hello!',
  //   timestamp: '2026-02-05T12:00:00.000Z'
  // }
});
```

**3. product-update**

상품 정보 업데이트 (재고, 상태 변경)

```javascript
socket.on('product-update', (data) => {
  console.log(data);
  // {
  //   productId: 'uuid',
  //   quantity: 90,
  //   status: 'AVAILABLE'
  // }
});
```

**4. product-sold-out**

상품 품절 알림

```javascript
socket.on('product-sold-out', (data) => {
  console.log(data);
  // { productId: 'uuid' }
});
```

**5. reservation-promoted**

예약 승격 알림 (사용자별)

```javascript
socket.on('reservation-promoted', (data) => {
  console.log(data);
  // {
  //   reservationId: 'uuid',
  //   productId: 'uuid',
  //   productName: 'Product Name',
  //   expiresAt: '2026-02-05T12:10:00.000Z'
  // }
});
```

**6. stream-started**

방송 시작 알림

```javascript
socket.on('stream-started', (data) => {
  console.log(data);
  // {
  //   streamKey: 'live_abc123xyz456',
  //   title: 'Live Stream Title'
  // }
});
```

**7. stream-ended**

방송 종료 알림

```javascript
socket.on('stream-ended', (data) => {
  console.log(data);
  // { streamKey: 'live_abc123xyz456' }
});
```

---

## 📞 문의

**API 담당**: backend@dorami.com
**기술 지원**: support@dorami.com

---

**작성자**: Claude (Sonnet 4.5)
**최종 업데이트**: 2026-02-05
**버전**: 1.0.0
