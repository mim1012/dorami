# Prisma Migration Plan — Main Page Fields

**작성일:** 2026-02-28
**브랜치:** develop
**마이그레이션 이름:** `add_mainpage_fields`

---

## 1. 변경사항 요약

| #   | 모델         | 변경 유형                     | 내용                           | 필요 이유                                                 |
| --- | ------------ | ----------------------------- | ------------------------------ | --------------------------------------------------------- |
| A   | `LiveStream` | 필드 추가                     | `description: String?`         | 라이브 설명 표시 (메인페이지 섹션)                        |
| B   | `Product`    | ~~인덱스 추가~~ **이미 존재** | `@@index([streamKey, status])` | **현재 schema.prisma line 163에 이미 존재 — 변경 불필요** |
| C   | `OrderItem`  | 인덱스 추가                   | `@@index([productId])`         | 판매수 집계 쿼리 성능 (라이브 인기상품 섹션)              |

> **중요:** Product 복합 인덱스 `@@index([streamKey, status])`는 현재 schema.prisma의 163번째 줄에 이미 존재합니다. 실제 마이그레이션은 **A (LiveStream.description 추가)** 와 **C (OrderItem.productId 인덱스 추가)** 두 가지만 적용됩니다.

---

## 2. Prisma Schema 변경 코드

### A. LiveStream 모델 — `description` 필드 추가

**변경 전 (현재 schema.prisma line 63~90):**

```prisma
model LiveStream {
  id            String       @id @default(uuid())
  streamKey     String       @unique @map("stream_key")
  userId        String       @map("user_id")
  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  title         String       @default("Live Stream")
  status        StreamStatus @default(PENDING)
  startedAt     DateTime?    @map("started_at")
  endedAt       DateTime?    @map("ended_at")
  totalDuration Int?         @map("total_duration") // seconds
  peakViewers   Int          @default(0) @map("peak_viewers")
  freeShippingEnabled Boolean  @default(false) @map("free_shipping_enabled")
  scheduledAt   DateTime?    @map("scheduled_at")
  thumbnailUrl  String?      @map("thumbnail_url")
  expiresAt     DateTime     @map("expires_at")
  createdAt     DateTime     @default(now()) @map("created_at")
  ...
```

**변경 후 (`title` 아래에 `description` 추가):**

```prisma
model LiveStream {
  id            String       @id @default(uuid())
  streamKey     String       @unique @map("stream_key")
  userId        String       @map("user_id")
  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  title         String       @default("Live Stream")
  description   String?      @map("description")             // ← 추가
  status        StreamStatus @default(PENDING)
  startedAt     DateTime?    @map("started_at")
  endedAt       DateTime?    @map("ended_at")
  totalDuration Int?         @map("total_duration") // seconds
  peakViewers   Int          @default(0) @map("peak_viewers")
  freeShippingEnabled Boolean  @default(false) @map("free_shipping_enabled")
  scheduledAt   DateTime?    @map("scheduled_at")
  thumbnailUrl  String?      @map("thumbnail_url")
  expiresAt     DateTime     @map("expires_at")
  createdAt     DateTime     @default(now()) @map("created_at")
  ...
```

### B. Product 모델 — 변경 없음

현재 schema.prisma에 이미 존재:

```prisma
@@index([streamKey, status])  // For stream products filtering  ← line 163, 이미 존재
```

### C. OrderItem 모델 — `@@index([productId])` 추가

**변경 전 (현재 schema.prisma line 273~288):**

```prisma
model OrderItem {
  id          String  @id @default(uuid())
  orderId     String  @map("order_id")
  order       Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId   String? @map("product_id")
  productName String  @map("product_name")
  price       Decimal @db.Decimal(10, 2)
  quantity    Int
  color       String?
  size        String?
  shippingFee Decimal @map("shipping_fee") @db.Decimal(10, 2)
  Product     Product? @relation(fields: [productId], references: [id], onDelete: SetNull)

  @@index([orderId])
  @@map("order_items")
}
```

**변경 후 (`@@index([productId])` 추가):**

```prisma
model OrderItem {
  id          String  @id @default(uuid())
  orderId     String  @map("order_id")
  order       Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId   String? @map("product_id")
  productName String  @map("product_name")
  price       Decimal @db.Decimal(10, 2)
  quantity    Int
  color       String?
  size        String?
  shippingFee Decimal @map("shipping_fee") @db.Decimal(10, 2)
  Product     Product? @relation(fields: [productId], references: [id], onDelete: SetNull)

  @@index([orderId])
  @@index([productId])    // ← 추가: 판매수 집계 성능 (라이브 인기상품)
  @@map("order_items")
}
```

---

## 3. SQL Migration 스크립트 (PostgreSQL 16)

Prisma가 자동 생성할 SQL과 동일한 내용입니다. 수동 적용이 필요한 경우 사용하세요.

```sql
-- Migration: add_mainpage_fields
-- Generated for PostgreSQL 16
-- Date: 2026-02-28

BEGIN;

-- A. LiveStream: description 컬럼 추가
ALTER TABLE "live_streams"
  ADD COLUMN "description" TEXT;

-- C. OrderItem: product_id 인덱스 추가
-- (productId는 nullable이므로 NULL 값도 인덱싱됨)
CREATE INDEX "order_items_product_id_idx"
  ON "order_items" ("product_id");

COMMIT;
```

> **주의:** Prisma는 nullable 컬럼(`String?`)을 `TEXT` 타입 + `NULL` 허용으로 매핑합니다.
> `description` 컬럼은 기존 행에 대해 `NULL`로 채워지므로 데이터 손실 없음.

---

## 4. 마이그레이션 실행 커맨드

```bash
# 프로젝트 루트에서 실행
cd D:/Project/dorami

# 개발 환경: 마이그레이션 생성 + 적용
npx prisma migrate dev --name add_mainpage_fields

# 프로덕션 환경: 미리 생성된 마이그레이션 적용만
npx prisma migrate deploy

# Prisma Client 재생성 (마이그레이션 후 필수)
npx prisma generate
```

**마이그레이션 파일 위치 (자동 생성됨):**

```
backend/prisma/migrations/
└── 20260228_add_mainpage_fields/
    └── migration.sql
```

---

## 5. 예상 마이그레이션 시간

| 작업                                                   | 소요 시간                     | 테이블 잠금                                                |
| ------------------------------------------------------ | ----------------------------- | ---------------------------------------------------------- |
| `ALTER TABLE live_streams ADD COLUMN description TEXT` | < 1초                         | 없음 (PostgreSQL 11+ 지원 instant ADD COLUMN for nullable) |
| `CREATE INDEX order_items_product_id_idx`              | 행 수에 비례                  | 없음 (CONCURRENT 없어도 `CREATE INDEX`는 공유 잠금만)      |
| **총계**                                               | **< 5초** (10만 행 이하 기준) | **서비스 중단 없음**                                       |

> PostgreSQL 11+에서 nullable 컬럼 추가(`ADD COLUMN ... NULL`)는 테이블 재작성 없이 메타데이터만 수정되어 **즉시 완료**됩니다.
> 인덱스 생성은 읽기/쓰기 동시에 가능하며, 프로덕션에서 큰 테이블이라면 `CREATE INDEX CONCURRENTLY`를 고려하세요.

---

## 6. 성능 분석

### OrderItem `@@index([productId])` — 영향

**대상 쿼리 (라이브 인기상품 집계):**

```sql
SELECT p.*, SUM(oi.quantity) as sold_count
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN orders o ON o.id = oi.order_id
  AND o.status IN ('PAYMENT_CONFIRMED', 'SHIPPED', 'DELIVERED')
WHERE p.status = 'AVAILABLE'
GROUP BY p.id
ORDER BY sold_count DESC
LIMIT 8;
```

| 구분                               | 인덱스 없음            | 인덱스 있음 |
| ---------------------------------- | ---------------------- | ----------- |
| `JOIN order_items ON product_id`   | Seq Scan (전체 테이블) | Index Scan  |
| 예상 속도 (1만 order_items 기준)   | ~50ms                  | ~5ms        |
| 예상 속도 (100만 order_items 기준) | ~2000ms                | ~20ms       |

**INSERT/UPDATE/DELETE 오버헤드:**

- INSERT: +0.1~0.5ms per row (인덱스 엔트리 추가)
- UPDATE productId: +0.2ms (인덱스 갱신)
- DELETE: +0.1ms (인덱스 엔트리 제거)
- OrderItem은 주로 생성 후 삭제 없는 패턴이므로 오버헤드 미미

### LiveStream `description` 필드 — 영향

- 텍스트 필드 추가: 저장 공간 소폭 증가 (NULL이면 0 byte)
- 쿼리 성능: description 기반 WHERE절 없으므로 성능 영향 없음
- API 응답: 직렬화 크기 소폭 증가 (description이 있는 경우만)

---

## 7. Rollback 계획

### 자동 롤백 (Prisma)

```bash
# 마이그레이션 실패 시 Prisma가 자동으로 트랜잭션 롤백
# 수동으로 되돌리려면:
npx prisma migrate resolve --rolled-back add_mainpage_fields
```

### 수동 롤백 SQL

```sql
BEGIN;

-- C 롤백: order_items productId 인덱스 삭제
DROP INDEX IF EXISTS "order_items_product_id_idx";

-- A 롤백: live_streams description 컬럼 삭제
-- 주의: 데이터가 존재하면 함께 삭제됨
ALTER TABLE "live_streams"
  DROP COLUMN IF EXISTS "description";

COMMIT;
```

### 데이터 무결성 검증 쿼리

```sql
-- 마이그레이션 후 검증 1: description 컬럼 존재 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'live_streams'
  AND column_name = 'description';
-- 기대값: column_name=description, data_type=text, is_nullable=YES

-- 마이그레이션 후 검증 2: 인덱스 존재 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'order_items'
  AND indexname = 'order_items_product_id_idx';
-- 기대값: 1개 행 반환

-- 마이그레이션 후 검증 3: 기존 데이터 무결성
SELECT COUNT(*) as total,
       COUNT(description) as with_description
FROM live_streams;
-- 기대값: with_description = 0 (기존 행은 NULL)

-- 마이그레이션 후 검증 4: order_items 행 수 이상 없음
SELECT COUNT(*) FROM order_items;
-- 롤백 전후 비교 (숫자 동일해야 함)
```

---

## 8. 테스트 계획

### 마이그레이션 전 검증

```bash
# 1. 현재 DB 상태 스냅샷
npx prisma migrate status

# 2. 테스트 환경에서 먼저 실행
DATABASE_URL="postgresql://..." npx prisma migrate dev --name add_mainpage_fields

# 3. 스키마 diff 확인
npx prisma migrate diff \
  --from-schema-datamodel backend/prisma/schema.prisma \
  --to-schema-datasource backend/prisma/schema.prisma \
  --script
```

### 마이그레이션 후 검증

```bash
# 1. Prisma Studio로 스키마 확인
npx prisma studio

# 2. 백엔드 타입 체크
cd backend && npx tsc --noEmit

# 3. 단위 테스트 실행
cd backend && npx jest --passWithNoTests

# 4. E2E 테스트 (앱 실행 후)
cd client-app && npx playwright test --project=admin
```

### 쿼리 성능 테스트

```sql
-- 인덱스 사용 확인: EXPLAIN ANALYZE
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT p.id, p.name, COALESCE(SUM(oi.quantity), 0) as sold_count
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN orders o ON o.id = oi.order_id
  AND o.status IN ('PAYMENT_CONFIRMED', 'SHIPPED', 'DELIVERED')
WHERE p.status = 'AVAILABLE'
GROUP BY p.id
ORDER BY sold_count DESC
LIMIT 8;

-- 기대값: "Index Scan using order_items_product_id_idx on order_items"
-- (Seq Scan이 나오면 테이블이 너무 작아 옵티마이저가 인덱스 무시한 것 — 정상)

-- LiveStream description 저장/조회 테스트
INSERT INTO live_streams (id, stream_key, user_id, title, description, status, expires_at)
VALUES (gen_random_uuid(), 'test-key', '<valid-user-id>', 'Test Live', '테스트 설명입니다', 'PENDING', NOW() + INTERVAL '1 day');

SELECT id, title, description FROM live_streams WHERE stream_key = 'test-key';
-- 기대값: description = '테스트 설명입니다'
```

---

## 9. 주의사항 및 체크리스트

### 실행 전 체크리스트

- [ ] `DATABASE_URL` 환경변수가 올바른 DB를 가리키는지 확인
- [ ] 마이그레이션 전 DB 백업 완료 (프로덕션 필수)
- [ ] `npx prisma migrate status`로 pending 마이그레이션 없음 확인
- [ ] 개발 환경에서 먼저 테스트 완료

### schema.prisma 직접 수정 사항

schema.prisma 파일에서 두 곳을 수정합니다:

**1. LiveStream 모델 (line ~69, `title` 아래):**

```prisma
  title         String       @default("Live Stream")
  description   String?      @map("description")   // ← 이 줄 추가
  status        StreamStatus @default(PENDING)
```

**2. OrderItem 모델 (line ~286, `@@index([orderId])` 아래):**

```prisma
  @@index([orderId])
  @@index([productId])    // ← 이 줄 추가
  @@map("order_items")
```

### 실행 후 체크리스트

- [ ] `npx prisma generate` 실행하여 Prisma Client 재생성
- [ ] 백엔드 재시작 후 `/api/health/ready` 응답 확인
- [ ] `description` 필드 관련 DTO/Service 업데이트 필요 여부 확인
- [ ] 프론트엔드 타입 업데이트 필요 여부 확인 (`shared-types` 빌드)

### 주의사항

1. **Product 복합 인덱스는 이미 존재** — schema.prisma 163번 줄에 `@@index([streamKey, status])`가 존재합니다. 중복 추가하지 마세요.
2. **OrderItem.productId는 nullable** (`String?`) — 인덱스는 NULL 값도 포함하므로 정상 동작합니다.
3. **`description`은 `@db.Text` 없이 `String?`으로 추가** — PostgreSQL에서 Prisma `String`은 `TEXT`로 매핑됩니다. 별도 `@db.Text` 지정은 선택사항입니다 (긴 텍스트라면 추가 권장).
4. **프로덕션 적용 시**: `migrate deploy` 사용 (interactive prompt 없음), 실행 전 반드시 백업.

---

## 10. 최종 실행 순서

```bash
# Step 1: schema.prisma 수정 (위 변경 코드 적용)
# - LiveStream에 description 추가
# - OrderItem에 @@index([productId]) 추가

# Step 2: 개발 환경에서 마이그레이션 생성 + 적용
cd D:/Project/dorami/backend
npx prisma migrate dev --name add_mainpage_fields

# Step 3: Prisma Client 재생성 (migrate dev가 자동으로 수행)
# 수동 필요 시: npx prisma generate

# Step 4: 백엔드 타입 체크
cd D:/Project/dorami/backend
npx tsc --noEmit

# Step 5: 테스트 실행
npx jest --passWithNoTests

# Step 6: 검증 쿼리 실행 (Section 7 참조)

# Step 7: 프로덕션 배포 시
npx prisma migrate deploy
```

---

_이 문서는 dorami 메인페이지 기능 구현을 위한 DB 스키마 마이그레이션 계획입니다._
_참조: `backend/prisma/schema.prisma`, `MAINPAGE_CONCEPTS.md`_
