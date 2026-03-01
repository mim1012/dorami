# 메인페이지 신규 API 성능 분석

**작성자**: Architect (DATABASE_STRUCTURE_ANALYSIS.md 기반)
**작성일**: 2026-02-28

---

## 개요

메인페이지 4개 섹션에 필요한 신규/확장 API의 성능 특성을 분석합니다.

---

## 1. GET /api/streaming/active (라이브 배너)

### 쿼리 분석

```sql
SELECT ls.* FROM live_streams ls
WHERE ls.status = 'LIVE'
ORDER BY ls.started_at DESC
LIMIT 1;
```

### 성능 특성

| 항목            | 값                       |
| --------------- | ------------------------ |
| **Index 사용**  | `live_streams(status)` ✓ |
| **JOIN 개수**   | 1 (User → host)          |
| **예상 시간**   | < 5ms (10만 행 기준)     |
| **테이블 잠금** | 없음 (SELECT only)       |

### Redis 부가 쿼리

```
GET stream:{streamKey}:viewers       // 실시간 시청자
GET stream:{streamKey}:featured-product  // 대표 상품
```

**예상 시간**: Redis 단일 조회 < 1ms (네트워크 포함 1-5ms)

---

## 2. GET /api/streaming/upcoming (곧 시작하는 라이브)

### 쿼리 분석

```sql
SELECT ls.* FROM live_streams ls
WHERE ls.status = 'PENDING' AND ls.scheduled_at > NOW()
ORDER BY ls.scheduled_at ASC
LIMIT 4;
```

### 성능 특성

| 항목            | 값                                                     |
| --------------- | ------------------------------------------------------ |
| **Index 사용**  | `live_streams(status)` (부분 스캔 후 WHERE 필터)       |
| **예상 시간**   | < 10ms (10만 행, 예정 라이브 적음 기준)                |
| **최적화 제안** | `@@index([status, scheduledAt])` 복합 인덱스 추가 권장 |
| **테이블 잠금** | 없음                                                   |

### 성능 개선 (Optional Phase 1.5)

```prisma
// schema.prisma에 추가
@@index([status, scheduledAt])  // For upcoming streams filter
```

---

## 3. GET /api/products/live-deals (방송특가) — 신규 API

### 쿼리 분석

```sql
SELECT p.* FROM products p
INNER JOIN live_streams ls ON p.stream_key = ls.stream_key
WHERE ls.status = 'LIVE' AND p.status = 'AVAILABLE'
ORDER BY ls.started_at DESC, p.created_at DESC
LIMIT 8;
```

### 성능 특성

| 항목            | 값                                         |
| --------------- | ------------------------------------------ |
| **Index 사용**  | `products(stream_key, status)` ✓           |
| **JOIN**        | 1 (LiveStream)                             |
| **예상 시간**   | < 15ms (라이브 스트림 1개, 상품 많음 기준) |
| **병목**        | 대부분의 시간은 Product 필터링 후 정렬     |
| **테이블 잠금** | 없음                                       |

### 최적화 전략

1. **Phase 1**: 현재 구조 (INNER JOIN + 인덱스)
2. **Phase 2 (선택사항)**: Redis 캐싱
   ```
   SET mainpage:live-deals "{products}" EX 30  // 30초 TTL
   ```

---

## 4. GET /api/products/popular (라이브 인기상품) — 신규 API

### 쿼리 분석

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

### 성능 특성

| 항목            | 값                                                      |
| --------------- | ------------------------------------------------------- |
| **Index 사용**  | `products(status)` ✓, `order_items(productId)` ✓ (신규) |
| **JOIN 개수**   | 2 (OrderItem, Order)                                    |
| **GROUP BY**    | 전체 상품 그룹핑 (비용 높음)                            |
| **예상 시간**   | **50-200ms** (제품 많음, 주문 많음 기준)                |
| **병목**        | `GROUP BY p.id` 집계 비용                               |
| **테이블 잠금** | 없음                                                    |

### ⚠️ 성능 주의사항

1. **문제**: 상품이 1000개, 주문이 100만 개일 때, 매번 풀 조인 + 집계
2. **현재 해결책**: `OrderItem(productId)` 인덱스 추가 (Phase 0 마이그레이션)
3. **향후 개선안** (Phase 2+):
   - **Option A**: 물려화 (Denormalization)
     ```sql
     ALTER TABLE products ADD COLUMN sold_count INT DEFAULT 0;
     -- 주문 완료 시마다 UPDATE
     ```
   - **Option B**: Redis 캐싱 (권장)
     ```
     SET mainpage:popular-products "{cached_result}" EX 3600  // 1시간 TTL
     -- 매 정각마다 갱신 (Cron Job)
     ```
   - **Option C**: Materialized View
     ```sql
     CREATE MATERIALIZED VIEW popular_products_mv AS (
       SELECT p.id, p.name, SUM(oi.quantity) as sold_count ...
     );
     CREATE INDEX popular_products_mv_sold_count ON popular_products_mv(sold_count DESC);
     -- 매시간 REFRESH
     ```

### 권장 전략

**Phase 1 (MVP)**: Redis 캐싱 불가 → 매 요청마다 계산

- **성능**: 50-200ms (acceptable for mainpage)
- **구현**: PRISMA raw query + GROUP BY

**Phase 2** (트래픽 증가 후):

```typescript
// ProductsService.getPopularProducts()
const cached = await redisService.get('mainpage:popular-products');
if (cached) return JSON.parse(cached);

const result = await prisma.$queryRaw`...`;
await redisService.setEx('mainpage:popular-products', 3600, JSON.stringify(result));
return result;
```

**Phase 3** (매우 높은 트래픽):

```sql
-- DB에 Materialized View 생성
-- Cron으로 1시간마다 REFRESH
-- 항상 캐시된 결과 반환 (< 1ms)
```

---

## 5. 동시성 및 트래픽 시나리오

### 시나리오 A: 일반 트래픽 (일일 1000 PV)

```
GET /api/streaming/active       →  5ms
GET /api/streaming/upcoming     →  10ms
GET /api/products/live-deals    →  15ms
GET /api/products/popular       →  100ms (GROUP BY)
────────────────────────────────────────
총 API 응답 시간:  130ms (직렬) / ~50ms (병렬)

메인페이지 로드 시간:  200-300ms (네트워크 + 렌더링)
```

**결론**: ✅ 충분히 빠름

### 시나리오 B: 높은 트래픽 (일일 100K PV)

```
동시 요청: 100명이 동시에 메인페이지 로드

GET /api/products/popular × 100 = 100 × 100ms = 10초 누적
→ DB CPU 100%, 메모리 spike
→ 다른 API 응답 시간 증가 (1-2초)
```

**결론**: ❌ Redis 캐싱 필수

---

## 6. 인덱스 검증 체크리스트

### Phase 0 (현재 마이그레이션)

- [x] `LiveStream(status)` — 이미 존재
- [x] `Product(streamKey, status)` — 이미 존재
- [x] `OrderItem(orderId)` — 이미 존재
- [x] `OrderItem(productId)` — **추가 필요** (신규)
- [ ] `LiveStream(status, scheduledAt)` — 선택사항 (Phase 1.5)

### 마이그레이션 확인 SQL

```sql
-- Phase 0 후 확인
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename IN ('live_streams', 'products', 'order_items')
ORDER BY tablename, indexname;

-- 기대 결과:
-- live_streams: (status), (stream_key), (user_id), ...
-- products: (stream_key), (status), (stream_key, status), (status, created_at), ...
-- order_items: (order_id), (product_id) ✓ NEW
```

---

## 7. 쿼리 최적화 팁 (구현 시)

### Prisma를 사용할 때

```typescript
// ❌ 나쁜 예: N+1 쿼리
const products = await prisma.product.findMany({
  where: { status: 'AVAILABLE' },
});
// → 각 상품마다 orderItems 집계
products.forEach((p) => {
  const count = await prisma.orderItem.count({ where: { productId: p.id } });
});

// ✅ 좋은 예: Single query
const result = await prisma.$queryRaw`
  SELECT p.id, p.name, SUM(oi.quantity) as sold_count
  FROM products p
  LEFT JOIN order_items oi ON oi.product_id = p.id
  LEFT JOIN orders o ON o.id = oi.order_id
    AND o.status IN ('PAYMENT_CONFIRMED', 'SHIPPED', 'DELIVERED')
  WHERE p.status = 'AVAILABLE'
  GROUP BY p.id
  ORDER BY sold_count DESC
  LIMIT 8;
`;
```

### Redis 캐싱 패턴

```typescript
async getPopularProducts(limit = 8): Promise<Product[]> {
  // 1. 캐시 확인
  const cached = await this.redisService.get('popular-products');
  if (cached) return JSON.parse(cached);

  // 2. DB 쿼리
  const result = await this.prisma.$queryRaw`...`;

  // 3. 1시간 캐싱
  await this.redisService.setEx('popular-products', 3600, JSON.stringify(result));

  return result;
}
```

---

## 8. 모니터링 및 알림

### 로깅 설정 (Phase 1)

```typescript
@Get('popular')
async getPopularProducts() {
  const start = Date.now();
  const result = await this.service.getPopularProducts();
  const duration = Date.now() - start;

  if (duration > 200) {
    this.logger.warn(`Slow query: getPopularProducts took ${duration}ms`);
  }

  return result;
}
```

### 성능 임계값

| API                 | 목표    | 경고    | 심각     |
| ------------------- | ------- | ------- | -------- |
| streaming/active    | < 10ms  | > 50ms  | > 200ms  |
| streaming/upcoming  | < 15ms  | > 50ms  | > 200ms  |
| products/live-deals | < 20ms  | > 100ms | > 500ms  |
| products/popular    | < 150ms | > 300ms | > 1000ms |

---

## 결론

| API                 | Phase 1 성능 | Phase 2 권장   | 우선순위 |
| ------------------- | ------------ | -------------- | -------- |
| streaming/active    | ✅ 5ms       | Redis (선택)   | High     |
| streaming/upcoming  | ✅ 10ms      | 인덱스 추가    | Medium   |
| products/live-deals | ✅ 15ms      | Redis (선택)   | High     |
| products/popular    | ⚠️ 100ms     | **Redis 필수** | **High** |

**Action**: Phase 1에서는 현재 인덱스로 충분하지만, **products/popular API는 트래픽 증가 시 Redis 캐싱 추가 필수**.

---

_Architect DATABASE_STRUCTURE_ANALYSIS.md 기반 작성_
