# Dorami - Database Structure & API Analysis

## 1. ER Diagram (Text)

```
┌──────────────┐     1:N     ┌──────────────────┐     1:N     ┌──────────────┐
│     User     │────────────▶│    LiveStream     │────────────▶│   Product    │
│              │             │                   │             │              │
│  id (UUID)   │             │  id (UUID)        │             │  id (UUID)   │
│  kakaoId     │             │  streamKey (uniq) │             │  streamKey?  │
│  email?      │             │  userId (FK)      │             │  name        │
│  name        │             │  title            │             │  price (Dec) │
│  role        │             │  status           │             │  quantity    │
│  status      │             │  scheduledAt?     │             │  status      │
│  phone?      │             │  startedAt?       │             │  shippingFee │
│  instagramId?│             │  endedAt?         │             │  ...         │
│  shippingAddr│             │  peakViewers      │             └──────┬───────┘
│  (Json,encr.)│             │  thumbnailUrl?    │                    │
└──────┬───────┘             │  expiresAt        │                    │ 1:N
       │                     └────────┬──────────┘                    │
       │                              │                     ┌────────▼────────┐
       │ 1:N                          │ 1:N                 │   OrderItem     │
       │                              │                     │                 │
       ▼                              ▼                     │  id (UUID)      │
┌──────────────┐             ┌──────────────────┐           │  orderId (FK)   │
│    Order     │             │  ChatMessage     │           │  productId? (FK)│
│              │◀────────────│                  │           │  productName    │
│  id (ORD-*)  │   User 1:N │  id (UUID)       │           │  price (Dec)    │
│  userId (FK) │             │  streamKey (FK)  │           │  quantity       │
│  subtotal    │             │  userId? (FK)    │           │  color?, size?  │
│  shippingFee │             │  content (Text)  │           │  shippingFee    │
│  total (Dec) │             │  timestamp       │           └─────────────────┘
│  status      │             │  isDeleted       │                    ▲
│  payment*    │             └──────────────────┘                    │
│  shipping*   │                                                     │
│  ...         │─────────────────────────────────────────────────────┘
└──────┬───────┘                          1:N (OrderItems)
       │
       │ User has many:
       │
       ▼
┌──────────────┐   ┌──────────────┐   ┌────────────────────┐
│    Cart      │   │ Reservation  │   │  PointBalance      │
│              │   │              │   │                    │
│  id (UUID)   │   │  id (UUID)   │   │  id (UUID)         │
│  userId (FK) │   │  userId (FK) │   │  userId (FK, uniq) │
│  productId   │   │  productId   │   │  currentBalance    │
│  quantity    │   │  quantity    │   │  lifetimeEarned    │
│  color/size  │   │  resNumber   │   │  lifetimeUsed      │
│  price (Dec) │   │  status      │   │  lifetimeExpired   │
│  status      │   │  promotedAt? │   │                    │
│  expiresAt?  │   │  expiresAt?  │   │  1:N transactions  │
│  timerEnabled│   │              │   └────────┬───────────┘
└──────────────┘   └──────────────┘            │
                                               ▼
                                    ┌─────────────────────┐
                                    │  PointTransaction   │
                                    │                     │
                                    │  id (UUID)          │
                                    │  balanceId (FK)     │
                                    │  transactionType    │
                                    │  amount             │
                                    │  balanceAfter       │
                                    │  orderId?           │
                                    │  expiresAt?         │
                                    └─────────────────────┘

┌────────────────────┐    ┌────────────────┐    ┌──────────────────────┐
│  ReStreamTarget    │    │  ReStreamLog   │    │  NotificationSubscr. │
│                    │    │                │    │                      │
│  id (UUID)         │    │  id (UUID)     │    │  id (UUID)           │
│  userId (FK)       │    │  targetId (FK) │    │  userId (FK)         │
│  platform          │    │  liveStreamId  │    │  liveStreamId? (FK)  │
│  name              │    │  status        │    │  endpoint (Text)     │
│  rtmpUrl           │    │  startedAt?    │    │  p256dh (Text)       │
│  streamKey         │    │  endedAt?      │    │  auth (Text)         │
│  enabled           │    │  errorMessage? │    │                      │
│  muteAudio         │    │  restartCount  │    │  @@unique(userId,    │
└────────────────────┘    └────────────────┘    │    endpoint)         │
                                                └──────────────────────┘

┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Settlement      │    │  SystemConfig    │    │  Notice          │
│                  │    │  (singleton)     │    │                  │
│  id (UUID)       │    │                  │    │  id (UUID)       │
│  sellerId (FK)   │    │  noticeText?     │    │  title           │
│  periodStart     │    │  shippingMessages│    │  content (Text)  │
│  periodEnd       │    │  bankSettings    │    │  isActive        │
│  totalSales(Dec) │    │  zelleSettings   │    │  category        │
│  commission(Dec) │    │  pointsConfig    │    │  createdAt       │
│  settlementAmt   │    │  alimtalkConfig  │    └──────────────────┘
│  status          │    │  ...             │
└──────────────────┘    └──────────────────┘

┌──────────────────┐    ┌──────────────────┐    ┌────────────────────────┐
│  AuditLog        │    │  ModerationLog   │    │  NotificationTemplate  │
│                  │    │                  │    │                        │
│  id (UUID)       │    │  id (UUID)       │    │  id (UUID)             │
│  adminId? (FK)   │    │  adminId? (FK)   │    │  name (unique)         │
│  action          │    │  action          │    │  type                  │
│  entity          │    │  targetId        │    │  template (Text)       │
│  entityId        │    │  reason?         │    │  kakaoTemplateCode     │
│  changes (Json)  │    │  createdAt       │    │  createdAt, updatedAt  │
│  createdAt       │    └──────────────────┘    └────────────────────────┘
└──────────────────┘
```

## 2. Model Relationships Summary

### Core Entity Relationships

| Parent         | Child                    | Relation | FK                  | onDelete     |
| -------------- | ------------------------ | -------- | ------------------- | ------------ |
| User           | LiveStream               | 1:N      | userId              | Cascade      |
| User           | ChatMessage              | 1:N      | userId              | SetNull      |
| User           | Cart                     | 1:N      | userId              | Cascade      |
| User           | Reservation              | 1:N      | userId              | Cascade      |
| User           | Order                    | 1:N      | userId              | **Restrict** |
| User           | ModerationLog            | 1:N      | adminId             | SetNull      |
| User           | AuditLog                 | 1:N      | adminId             | SetNull      |
| User           | NotificationSubscription | 1:N      | userId              | Cascade      |
| User           | PointBalance             | 1:1      | userId (unique)     | Cascade      |
| User           | Settlement               | 1:N      | sellerId            | (default)    |
| User           | ReStreamTarget           | 1:N      | userId              | Cascade      |
| LiveStream     | ChatMessage              | 1:N      | streamKey→streamKey | Cascade      |
| LiveStream     | Product                  | 1:N      | streamKey→streamKey | Cascade      |
| LiveStream     | NotificationSubscription | 1:N      | liveStreamId        | Cascade      |
| LiveStream     | ReStreamLog              | 1:N      | liveStreamId        | Cascade      |
| Product        | Cart                     | 1:N      | productId           | Cascade      |
| Product        | Reservation              | 1:N      | productId           | Cascade      |
| Product        | OrderItem                | 1:N      | productId           | **SetNull**  |
| Order          | OrderItem                | 1:N      | orderId             | Cascade      |
| PointBalance   | PointTransaction         | 1:N      | balanceId           | Cascade      |
| ReStreamTarget | ReStreamLog              | 1:N      | targetId            | Cascade      |

### Key Design Decisions

1. **Order→User uses `onDelete: Restrict`** — orders cannot be cascade-deleted when a user is deleted (audit trail preservation)
2. **OrderItem→Product uses `onDelete: SetNull`** — product deletion preserves order history (productId becomes null, productName is denormalized)
3. **LiveStream→Product linked via `streamKey`** (not LiveStream.id) — allows direct streamKey-based lookups without JOINs
4. **ChatMessage→LiveStream also linked via `streamKey`** — same pattern
5. **Order.id is NOT UUID** — uses `ORD-YYYYMMDD-XXXXX` format (human-readable)
6. **PointBalance→User is 1:1** (userId is `@unique`)

## 3. Enum Types

| Enum                   | Values                                                                                       | Used In                          |
| ---------------------- | -------------------------------------------------------------------------------------------- | -------------------------------- |
| `Role`                 | `USER`, `ADMIN`                                                                              | User.role                        |
| `UserStatus`           | `ACTIVE`, `INACTIVE`, `SUSPENDED`                                                            | User.status                      |
| `StreamStatus`         | `PENDING`, `LIVE`, `OFFLINE`                                                                 | LiveStream.status                |
| `ProductStatus`        | `AVAILABLE`, `SOLD_OUT`                                                                      | Product.status                   |
| `CartStatus`           | `ACTIVE`, `EXPIRED`, `COMPLETED`                                                             | Cart.status                      |
| `ReservationStatus`    | `WAITING`, `PROMOTED`, `COMPLETED`, `CANCELLED`, `EXPIRED`                                   | Reservation.status               |
| `OrderStatus`          | `PENDING_PAYMENT`, `PAYMENT_CONFIRMED`, `SHIPPED`, `DELIVERED`, `CANCELLED`                  | Order.status                     |
| `PaymentStatus`        | `PENDING`, `CONFIRMED`, `FAILED`                                                             | Order.paymentStatus              |
| `PaymentMethod`        | `BANK_TRANSFER`                                                                              | Order.paymentMethod              |
| `ShippingStatus`       | `PENDING`, `SHIPPED`, `DELIVERED`                                                            | Order.shippingStatus             |
| `SettlementStatus`     | `PENDING`, `APPROVED`, `PAID`                                                                | Settlement.status                |
| `ModerationAction`     | `DELETE_MESSAGE`, `MUTE`, `BAN`                                                              | ModerationLog.action             |
| `PointTransactionType` | `EARNED_ORDER`, `USED_ORDER`, `REFUND_CANCELLED`, `MANUAL_ADD`, `MANUAL_SUBTRACT`, `EXPIRED` | PointTransaction.transactionType |
| `ReStreamPlatform`     | `YOUTUBE`, `INSTAGRAM`, `TIKTOK`, `CUSTOM`                                                   | ReStreamTarget.platform          |
| `ReStreamStatus`       | `IDLE`, `CONNECTING`, `ACTIVE`, `FAILED`, `STOPPED`                                          | ReStreamLog.status               |
| `NoticeCategory`       | `IMPORTANT`, `GENERAL`                                                                       | Notice.category                  |

## 4. Index Strategy

### Current Indexes

| Table                        | Index Fields                            | Purpose                            |
| ---------------------------- | --------------------------------------- | ---------------------------------- |
| `users`                      | `email`                                 | Email lookup                       |
| `users`                      | `kakaoId`                               | Kakao OAuth lookup                 |
| `live_streams`               | `streamKey` (unique)                    | Stream key lookup                  |
| `live_streams`               | `userId`                                | User's streams                     |
| `live_streams`               | `status`                                | Active/upcoming stream queries     |
| `chat_messages`              | `(streamKey, timestamp)`                | Chat history retrieval             |
| `moderation_logs`            | `adminId`                               | Admin's moderation actions         |
| `moderation_logs`            | `targetId`                              | Actions on a specific message      |
| `products`                   | `streamKey`                             | Products for a stream              |
| `products`                   | `(streamKey, status)`                   | Stream products with status filter |
| `products`                   | `status`                                | Products by status                 |
| `products`                   | `(status, createdAt)`                   | Store products listing (paginated) |
| `carts`                      | `(userId, status)`                      | User's active cart                 |
| `carts`                      | `(productId, status)`                   | Reserved quantity calculation      |
| `carts`                      | `expiresAt`                             | Timer-based cart expiration        |
| `carts`                      | `(status, timerEnabled, expiresAt)`     | Cron: expireTimedOutCarts          |
| `reservations`               | `(productId, reservationNumber)` unique | Sequential reservation numbering   |
| `reservations`               | `(userId, status)`                      | User's reservations                |
| `reservations`               | `(status, expiresAt)`                   | Cron: expirePromotedReservations   |
| `orders`                     | `userId`                                | User's orders                      |
| `orders`                     | `(userId, createdAt)`                   | User order history (sorted)        |
| `orders`                     | `paymentStatus`                         | Payment status filter              |
| `orders`                     | `status`                                | Order status filter                |
| `orders`                     | `(status, createdAt)`                   | Cron: cancelExpiredOrders          |
| `orders`                     | `(paymentStatus, paidAt)`               | Payment confirmation tracking      |
| `order_items`                | `orderId`                               | Items for an order                 |
| `point_balances`             | `userId` (unique)                       | User's point balance               |
| `point_transactions`         | `(balanceId, createdAt)`                | Transaction history                |
| `point_transactions`         | `orderId`                               | Points linked to orders            |
| `point_transactions`         | `expiresAt`                             | Point expiration cron              |
| `point_transactions`         | `transactionType`                       | Filter by type                     |
| `restream_targets`           | `userId`                                | User's restream targets            |
| `restream_logs`              | `targetId`                              | Logs for a target                  |
| `restream_logs`              | `liveStreamId`                          | Logs for a stream                  |
| `restream_logs`              | `status`                                | Active restream queries            |
| `notification_subscriptions` | `userId`                                | User's subscriptions               |
| `notification_subscriptions` | `liveStreamId`                          | Stream-specific subscriptions      |
| `audit_logs`                 | `adminId`                               | Admin's actions                    |
| `audit_logs`                 | `(entity, entityId)`                    | Entity-specific audit trail        |

## 5. Data Type Handling

### Decimal Fields (Prisma Decimal → PostgreSQL DECIMAL)

All monetary values use `@db.Decimal(10, 2)`:

- `Product.price`, `Product.shippingFee`, `Product.originalPrice`
- `Product.discountRate` → `@db.Decimal(5, 2)` (0.00~100.00)
- `Cart.price`, `Cart.shippingFee`
- `OrderItem.price`, `OrderItem.shippingFee`
- `Order.subtotal`, `Order.shippingFee`, `Order.total`
- `Settlement.totalSales`, `Settlement.commission`, `Settlement.settlementAmount`
- `SystemConfig.defaultShippingFee`, `SystemConfig.caShippingFee`, `SystemConfig.freeShippingThreshold`

**Frontend handling**: Prisma returns `Decimal` objects (not numbers). The `@live-commerce/shared-types` package provides:

- `formatDecimal(value, decimals?)` — safe Decimal→string conversion
- `parseDecimal(value)` — safe string→Decimal parsing
- `calculateCartTotal(items)` — returns `{ subtotal, totalShippingFee, total }` as strings

### DateTime Fields

All timestamps use PostgreSQL `timestamp with time zone`:

- `createdAt` → `@default(now())` — auto-set on creation
- `updatedAt` → `@updatedAt` — auto-updated by Prisma
- Column names use `@map("snake_case")` (e.g., `createdAt` → `created_at`)

### Json Fields

- `User.shippingAddress` — AES-256-GCM encrypted US-format address (via `EncryptionService`)
- `Order.shippingAddress` — decrypted copy at order time
- `AuditLog.changes` — before/after value snapshots
- `SystemConfig.shippingMessages` — `{ preparing, shipped, inTransit, delivered }` message templates

### Array Fields (PostgreSQL `text[]`)

- `Product.colorOptions` — string array of color tags
- `Product.sizeOptions` — string array of size tags
- `Product.images` — string array of image URLs

## 6. API Endpoint Catalog

### Response Envelope

All responses (unless `@SkipTransform()`) are wrapped by `TransformInterceptor`:

```json
{
  "data": { ... },
  "success": true,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Error responses use `BusinessException`:

```json
{
  "errorCode": "INSUFFICIENT_STOCK",
  "message": "Insufficient stock. Available: 5, Requested: 10",
  "context": { "productId": "uuid", "available": 5, "requested": 10 },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Named error codes: `INSUFFICIENT_STOCK`, `CART_EXPIRED`, `ORDER_NOT_FOUND`, `UNAUTHORIZED`, `PRODUCT_NOT_FOUND`, `USER_NOT_FOUND`, `RESERVATION_NOT_FOUND`, `INVALID_PAYMENT_STATUS`, `{ENTITY}_NOT_FOUND`

### Pagination Pattern

Uses `parsePagination(page, limit, options?)`:

- Defaults: `page=1`, `limit=24`, `maxLimit=100`
- Returns: `{ page: number, limit: number }`
- Store products response format:

```json
{
  "data": {
    "data": [...products],
    "meta": { "total": 100, "page": 1, "totalPages": 5 }
  }
}
```

---

### Auth Endpoints (`/api/auth`)

| Method | Path                   | Auth              | Description                             |
| ------ | ---------------------- | ----------------- | --------------------------------------- |
| GET    | `/auth/kakao`          | Public            | Kakao OAuth redirect                    |
| GET    | `/auth/kakao/callback` | Public            | Kakao callback → set cookies → redirect |
| POST   | `/auth/refresh`        | Public (cookie)   | Refresh access token                    |
| POST   | `/auth/logout`         | JWT               | Clear auth cookies                      |
| GET    | `/auth/me`             | JWT               | Current user token payload              |
| POST   | `/auth/dev-login`      | Public (dev only) | Dev login by email                      |

### User Endpoints (`/api/users`)

| Method | Path                      | Auth  | Description                         |
| ------ | ------------------------- | ----- | ----------------------------------- |
| GET    | `/users/me`               | JWT   | Basic profile (no sensitive data)   |
| GET    | `/users/check-instagram`  | JWT   | Check Instagram ID availability     |
| GET    | `/users/:id`              | Admin | Get user by ID                      |
| PATCH  | `/users/me`               | JWT   | Update profile                      |
| DELETE | `/users/me`               | JWT   | Delete account                      |
| POST   | `/users/complete-profile` | JWT   | Complete profile after OAuth        |
| GET    | `/users/profile/me`       | JWT   | Full profile with decrypted address |
| PATCH  | `/users/profile/address`  | JWT   | Update shipping address             |

### Streaming Endpoints (`/api/streaming`)

| Method | Path                                           | Auth     | Description                                |
| ------ | ---------------------------------------------- | -------- | ------------------------------------------ |
| POST   | `/streaming/start`                             | JWT      | Create stream session (PENDING)            |
| PATCH  | `/streaming/:id/go-live`                       | JWT      | PENDING → LIVE                             |
| PATCH  | `/streaming/:id/stop`                          | JWT      | LIVE → OFFLINE                             |
| PATCH  | `/streaming/:id`                               | JWT      | Update stream info                         |
| DELETE | `/streaming/:id`                               | JWT      | Cancel stream (PENDING only)               |
| GET    | `/streaming/:id/status`                        | Public   | Stream status by ID                        |
| GET    | `/streaming/active`                            | Public   | Current live streams                       |
| GET    | `/streaming/upcoming`                          | Public   | Upcoming streams (limit default=3, max=10) |
| POST   | `/streaming/generate-key`                      | JWT      | Generate RTMP stream key                   |
| GET    | `/streaming/key/:streamKey/status`             | Public   | Stream status by key                       |
| GET    | `/streaming/history`                           | Admin    | Stream history                             |
| GET    | `/streaming/live-status`                       | Admin    | Current live status summary                |
| POST   | `/streaming/auth`                              | Internal | nginx-rtmp on_publish callback             |
| POST   | `/streaming/done`                              | Internal | nginx-rtmp on_publish_done callback        |
| POST   | `/streaming/srs-auth`                          | Internal | SRS on_publish callback                    |
| POST   | `/streaming/srs-done`                          | Internal | SRS on_unpublish callback                  |
| POST   | `/streaming/srs-heartbeat`                     | Internal | SRS heartbeat (~10s)                       |
| GET    | `/streaming/key/:streamKey/featured-product`   | Public   | Featured product for stream                |
| POST   | `/streaming/:streamKey/featured-product`       | Admin    | Set featured product                       |
| PATCH  | `/streaming/:streamKey/featured-product/clear` | Admin    | Clear featured product                     |

### Product Endpoints (`/api/products`)

| Method | Path                      | Auth   | Description                                 |
| ------ | ------------------------- | ------ | ------------------------------------------- |
| POST   | `/products`               | Admin  | Create product                              |
| GET    | `/products/featured`      | Public | Featured products (limit default=6, max=20) |
| GET    | `/products/store`         | Public | Store products (paginated, default=24/page) |
| GET    | `/products`               | Public | Products by streamKey (+ optional status)   |
| GET    | `/products/:id`           | Public | Single product                              |
| POST   | `/products/:id/duplicate` | Admin  | Duplicate product                           |
| PATCH  | `/products/reorder`       | Admin  | Reorder products                            |
| POST   | `/products/bulk-status`   | Admin  | Bulk update status                          |
| POST   | `/products/bulk-delete`   | Admin  | Bulk delete                                 |
| PATCH  | `/products/:id`           | Admin  | Update product                              |
| PATCH  | `/products/:id/sold-out`  | Admin  | Mark sold out                               |
| PATCH  | `/products/:id/stock`     | Admin  | Update stock                                |
| DELETE | `/products/:id`           | Admin  | Delete product                              |

### Cart Endpoints (`/api/cart`)

| Method | Path        | Auth | Description               |
| ------ | ----------- | ---- | ------------------------- |
| POST   | `/cart`     | JWT  | Add to cart               |
| GET    | `/cart`     | JWT  | Get cart with summary     |
| PATCH  | `/cart/:id` | JWT  | Update cart item quantity |
| DELETE | `/cart/:id` | JWT  | Remove cart item          |
| DELETE | `/cart`     | JWT  | Clear cart                |

### Order Endpoints (`/api/orders`)

| Method | Path                                       | Auth | Description                                |
| ------ | ------------------------------------------ | ---- | ------------------------------------------ |
| POST   | `/orders/from-cart`                        | JWT  | Create order from cart (+ optional points) |
| POST   | `/orders`                                  | JWT  | Direct order                               |
| PATCH  | `/orders/:id/cancel`                       | JWT  | Cancel order                               |
| GET    | `/orders`                                  | JWT  | My orders                                  |
| GET    | `/orders/:id`                              | JWT  | Order detail                               |
| POST   | `/orders/reservations/:productId`          | JWT  | Join reservation queue                     |
| GET    | `/orders/reservations/:productId/position` | JWT  | Queue position                             |
| PATCH  | `/orders/reservations/:productId/cancel`   | JWT  | Cancel reservation                         |

### Points Endpoints

| Method | Path                                 | Auth             | Description             |
| ------ | ------------------------------------ | ---------------- | ----------------------- |
| GET    | `/users/me/points`                   | JWT              | My point balance        |
| GET    | `/users/me/points/history`           | JWT              | My point history        |
| GET    | `/users/:userId/points`              | JWT (self/admin) | User point balance      |
| GET    | `/users/:userId/points/history`      | JWT (self/admin) | User point history      |
| GET    | `/admin/config/points`               | Admin            | Points configuration    |
| PUT    | `/admin/config/points`               | Admin            | Update points config    |
| POST   | `/admin/users/:userId/points/adjust` | Admin            | Manual point adjustment |

### Admin Endpoints (`/api/admin`)

| Method | Path                                | Auth  | Description                             |
| ------ | ----------------------------------- | ----- | --------------------------------------- |
| GET    | `/admin/users`                      | Admin | User list (paginated)                   |
| GET    | `/admin/users/:id`                  | Admin | User detail                             |
| PATCH  | `/admin/users/:id/status`           | Admin | Update user status                      |
| GET    | `/admin/orders`                     | Admin | Order list (paginated)                  |
| GET    | `/admin/orders/export`              | Admin | Export orders to Excel                  |
| GET    | `/admin/orders/:id`                 | Admin | Order detail                            |
| PATCH  | `/admin/orders/:id/confirm-payment` | Admin | Confirm payment                         |
| PATCH  | `/admin/orders/:id/status`          | Admin | Update order status                     |
| PATCH  | `/admin/orders/:id/shipping-status` | Admin | Update shipping status                  |
| PATCH  | `/admin/orders/:id/send-reminder`   | Admin | Send payment reminder                   |
| POST   | `/admin/orders/bulk-notify`         | Admin | Bulk shipping notification (CSV upload) |
| GET    | `/admin/dashboard/stats`            | Admin | Dashboard statistics                    |
| GET    | `/admin/activities/recent`          | Admin | Recent activities                       |
| GET    | `/admin/config`                     | Admin | System configuration                    |
| PUT    | `/admin/config`                     | Admin | Update system config                    |
| GET    | `/admin/config/settings`            | Admin | System settings                         |
| PUT    | `/admin/config/settings`            | Admin | Update system settings                  |
| GET    | `/admin/config/shipping-messages`   | Admin | Shipping message templates              |
| PUT    | `/admin/config/shipping-messages`   | Admin | Update shipping messages                |
| GET    | `/admin/notification-templates`     | Admin | Notification templates                  |
| PATCH  | `/admin/notification-templates/:id` | Admin | Update notification template            |
| GET    | `/admin/settlement`                 | Admin | Settlement report                       |
| GET    | `/admin/audit-logs`                 | Admin | Audit logs (paginated)                  |
| GET    | `/admin/monitoring`                 | Admin | Real-time system monitoring             |

### Settlement Endpoints (`/api/admin/settlement`)

| Method | Path                         | Auth  | Description               |
| ------ | ---------------------------- | ----- | ------------------------- |
| GET    | `/admin/settlement`          | Admin | Settlement report         |
| GET    | `/admin/settlement/download` | Admin | Settlement Excel download |

### Notice Endpoints (`/api/notices`)

| Method | Path                 | Auth   | Description           |
| ------ | -------------------- | ------ | --------------------- |
| GET    | `/notices/current`   | Public | Current active notice |
| GET    | `/notices`           | JWT    | Active notices list   |
| GET    | `/notices/admin`     | Admin  | All notices           |
| POST   | `/notices/admin`     | Admin  | Create notice         |
| PUT    | `/notices/admin/:id` | Admin  | Update notice         |
| DELETE | `/notices/admin/:id` | Admin  | Delete notice         |

### Notification Endpoints (`/api/notifications`)

| Method | Path                           | Auth   | Description       |
| ------ | ------------------------------ | ------ | ----------------- |
| GET    | `/notifications/vapid-key`     | Public | VAPID public key  |
| POST   | `/notifications/subscribe`     | JWT    | Subscribe to push |
| DELETE | `/notifications/unsubscribe`   | JWT    | Unsubscribe       |
| GET    | `/notifications/subscriptions` | JWT    | My subscriptions  |

### Restream Endpoints (`/api/restream`)

| Method | Path                                              | Auth  | Description           |
| ------ | ------------------------------------------------- | ----- | --------------------- |
| POST   | `/restream/targets`                               | Admin | Add restream target   |
| GET    | `/restream/targets`                               | Admin | List restream targets |
| PATCH  | `/restream/targets/:id`                           | Admin | Update target         |
| DELETE | `/restream/targets/:id`                           | Admin | Delete target         |
| GET    | `/restream/status/:liveStreamId`                  | Admin | Restream status       |
| POST   | `/restream/:liveStreamId/targets/:targetId/start` | Admin | Manual start          |
| POST   | `/restream/:liveStreamId/targets/:targetId/stop`  | Admin | Manual stop           |

### Upload Endpoints (`/api/upload`)

| Method | Path            | Auth | Description                               |
| ------ | --------------- | ---- | ----------------------------------------- |
| POST   | `/upload/image` | JWT  | Upload image (5MB max, JPEG/PNG/GIF/WebP) |

### Health Endpoints (`/api/health`)

| Method | Path            | Auth   | Description                  |
| ------ | --------------- | ------ | ---------------------------- |
| GET    | `/health/live`  | Public | Liveness probe               |
| GET    | `/health/ready` | Public | Readiness probe (DB + Redis) |

## 7. Key Query Patterns

### Active Streams Query

```sql
SELECT * FROM live_streams
WHERE status = 'LIVE'
ORDER BY started_at DESC;
-- Uses index: live_streams(status)
```

### Upcoming Streams Query

```sql
SELECT * FROM live_streams
WHERE status = 'PENDING' AND scheduled_at > NOW()
ORDER BY scheduled_at ASC
LIMIT 3;
-- Uses index: live_streams(status)
```

### Products by Stream Key

```sql
SELECT * FROM products
WHERE stream_key = :streamKey AND status = :status
ORDER BY sort_order ASC;
-- Uses index: products(stream_key, status)
```

### Store Products (Paginated)

```sql
SELECT p.*, ls.ended_at
FROM products p
JOIN live_streams ls ON p.stream_key = ls.stream_key
WHERE ls.status = 'OFFLINE'
  AND p.status = 'AVAILABLE'
  AND p.quantity > 0
ORDER BY p.created_at DESC
LIMIT :limit OFFSET :offset;
-- Uses index: products(status, created_at)
```

### User's Active Cart

```sql
SELECT c.*, p.name, p.image_url, p.quantity as available_quantity
FROM carts c
JOIN products p ON c.product_id = p.id
WHERE c.user_id = :userId AND c.status = 'ACTIVE'
ORDER BY c.created_at DESC;
-- Uses index: carts(user_id, status)
```

### Reserved Quantity for a Product

```sql
SELECT COALESCE(SUM(quantity), 0) as reserved
FROM carts
WHERE product_id = :productId AND status = 'ACTIVE';
-- Uses index: carts(product_id, status)
```

### User Order History

```sql
SELECT o.*, oi.*
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.user_id = :userId
ORDER BY o.created_at DESC;
-- Uses index: orders(user_id, created_at)
```

### Cron: Expire Timed-Out Carts

```sql
UPDATE carts SET status = 'EXPIRED'
WHERE status = 'ACTIVE'
  AND timer_enabled = true
  AND expires_at <= NOW();
-- Uses index: carts(status, timer_enabled, expires_at)
```

### Cron: Expire Promoted Reservations

```sql
UPDATE reservations SET status = 'EXPIRED'
WHERE status = 'PROMOTED'
  AND expires_at <= NOW();
-- Uses index: reservations(status, expires_at)
```

### Point Transaction History

```sql
SELECT * FROM point_transactions
WHERE balance_id = :balanceId
ORDER BY created_at DESC
LIMIT :limit OFFSET :offset;
-- Uses index: point_transactions(balance_id, created_at)
```

## 8. Performance Analysis for New APIs

### Store Products Listing

- **Current**: Uses compound index `(status, createdAt)` — efficient for sorted pagination
- **Concern**: JOIN with `live_streams` table for stream status check — consider denormalizing stream status or adding a materialized view for high-traffic scenarios

### Product Detail with Cart Count

- **Pattern**: Product lookup + count of active carts for that product
- **Index support**: `carts(product_id, status)` handles this well

### Order Creation from Cart

- **Transaction**: Multi-step atomic operation (cart→order→order_items→stock_decrement→point_earn)
- **Concern**: Row-level locking on Product.quantity for concurrent cart checkouts
- **Mitigation**: Prisma `$transaction` with serializable isolation

### Dashboard Statistics

- **Pattern**: Aggregate queries across orders, users, products
- **Concern**: Full table scans for aggregation on large datasets
- **Optimization**: Consider caching dashboard stats in Redis with 1-5 minute TTL

### Audit Log Queries

- **Pattern**: Paginated with optional date range and action filter
- **Index support**: `audit_logs(entity, entity_id)` and `audit_logs(admin_id)`
- **Note**: No compound index for `(action, created_at)` — may need one if filtered by action frequently

## 9. Authentication & Authorization Summary

| Level              | Mechanism        | Decorator                    |
| ------------------ | ---------------- | ---------------------------- |
| Public (no auth)   | No guard         | `@Public()`                  |
| Authenticated user | JWT cookie       | `@UseGuards(JwtAuthGuard)`   |
| Admin only         | JWT + Role check | `@AdminOnly()`               |
| Internal only      | IP allowlist     | Manual `isPrivateIp()` check |
| Dev only           | NODE_ENV check   | Manual env check             |

JWT payload (`TokenPayload`):

- `userId: string`
- `email: string`
- `role: 'USER' | 'ADMIN'`

## 10. WebSocket Namespaces (Not REST)

| Namespace    | Purpose                | Key Events                                         |
| ------------ | ---------------------- | -------------------------------------------------- |
| `/`          | Stream room management | `join-stream`, `leave-stream`, `broadcastProduct*` |
| `/chat`      | Real-time chat         | `chat:message`, `chat:delete`, `chat:history`      |
| `/streaming` | Viewer count tracking  | `viewer:count`, `stream:ended`                     |

Redis-backed:

- Chat history: `chat:{liveId}:history` (max 100 msgs, 24h TTL)
- Viewer count: `stream:{streamKey}:viewers`
- Rate limit: 20 msgs/10s per user
