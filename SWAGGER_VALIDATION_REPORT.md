# 메인페이지 리디자인 Plan Validation Report

**Date**: 2026-02-28
**Status**: ⚠️ PARTIAL - 2개 엔드포인트 기존 존재, 2개 신규 개발 필요

---

## 📋 Executive Summary

Plan에서 정의한 **4개 신규 API 엔드포인트** 검증 결과:

| #   | Endpoint                     | Plan명          | 현재 상태 | 비고                     |
| --- | ---------------------------- | --------------- | --------- | ------------------------ |
| 1   | GET /api/streaming/active    | 라이브 배너     | ✅ 존재   | 응답 형식 확인 필요      |
| 2   | GET /api/streaming/upcoming  | 곧 시작 라이브  | ✅ 존재   | limit 기본값 3 (plan: 4) |
| 3   | GET /api/products/live-deals | 방송특가        | ❌ 미존재 | 신규 개발 필요           |
| 4   | GET /api/products/popular    | 라이브 인기상품 | ❌ 미존재 | 신규 개발 필요           |

---

## 🔍 Detailed Analysis

### 1. GET /api/streaming/active ✅ **존재**

**Location**: `backend/src/modules/streaming/streaming.controller.ts:140-145`

```typescript
@Public()
@Get('active')
@ApiOperation({ summary: '현재 라이브 중인 스트림 목록 (공개)' })
@ApiResponse({ status: 200, description: '활성 스트림 목록' })
async getActiveStreams() {
  return this.streamingService.getActiveStreams();
}
```

**Plan 정의**:

```typescript
GET /api/streaming/active
Response: {
  items: [LiveStream],  // 최대 1개 (현재 LIVE만)
  total: number
}
```

**⚠️ 검증 이슈**:

- 코드상 응답은 `items` + `total` 구조인지 확인 필요
- Plan에서는 최대 1개 항목으로 정의했으나, 코드 주석은 "목록"이라고 표기
- **검증 필요**: `StreamingService.getActiveStreams()` 구현 확인

**Action**:

- [ ] `streaming.service.ts`의 `getActiveStreams()` 메서드 검증
- [ ] 응답 DTO 확인 및 필요시 수정

---

### 2. GET /api/streaming/upcoming ✅ **존재**

**Location**: `backend/src/modules/streaming/streaming.controller.ts:148-155`

```typescript
@Public()
@Get('upcoming')
@ApiOperation({ summary: '예정된 스트림 목록 (공개)' })
@ApiQuery({
  name: 'limit',
  required: false,
  description: '조회 수 (기본값: 3, 최대: 10)',
  example: '3'
})
@ApiResponse({ status: 200, description: '예정 스트림 목록' })
async getUpcomingStreams(@Query('limit') limit?: string) {
  const { limit: limitNum } = parsePagination(1, limit, { limit: 3, maxLimit: 10 });
  return this.streamingService.getUpcomingStreams(limitNum);
}
```

**Plan 정의**:

```typescript
GET /api/streaming/upcoming?limit=4
Response: {
  items: LiveStream[],
  total: number
}
```

**⚠️ 검증 이슈**:

- **기본값 불일치**: 코드는 `limit: 3` (기본값), Plan은 4로 정의
- **응답 형식**: `items` + `total` 구조 확인 필요

**Action**:

- [ ] `streaming.service.ts`의 `getUpcomingStreams()` 메서드 검증
- [ ] 필요시 기본값을 4로 수정
- [ ] LiveStream.description 필드 포함 여부 확인

---

### 3. GET /api/products/live-deals ❌ **미존재**

**현재 상황**:

- Products controller에 "라이브 상품 전용" 엔드포인트 없음
- 현재 구조: `GET /api/products?streamKey={streamKey}` (line 112-143)

```typescript
@Public()
@Get()
@ApiOperation({ summary: 'Get all products for a stream (Public)' })
@ApiQuery({
  name: 'streamKey',
  description: 'Stream key',
  required: true,
  example: 'abc123def456',
})
async findAll(
  @Query('streamKey') streamKey?: string,
  @Query('status') status?: ProductStatus,
): Promise<ProductResponseDto[]> {
  if (streamKey) {
    return await this.productsService.findByStreamKey(streamKey, status);
  }
  return await this.productsService.findAll(status);
}
```

**Plan 정의**:

```typescript
GET /api/products/live-deals?limit=8
Response: {
  items: Product[],
  total: number
}
// Description: 현재 LIVE 스트림의 상품 최대 8개
```

**🛠️ 신규 개발 필요**:

1. **New Endpoint**: `GET /api/products/live-deals`
2. **Logic**:
   - 현재 LIVE 상태인 LiveStream 조회
   - 해당 streamKey의 AVAILABLE 상품 8개
   - 정렬: 라이브 시작 역순 → 상품 등록순
3. **Service Method**: `ProductsService.getLiveDeals(limit: number = 8)`

**Implementation Priority**: 🔴 High (Main page hero section)

---

### 4. GET /api/products/popular ❌ **미존재**

**현재 상황**:

- `GET /api/products/featured` (line 58-74) 존재하지만 "인기상품"은 아님

```typescript
@Public()
@Get('featured')
@ApiOperation({ summary: 'Get featured products for homepage (Public)' })
@ApiQuery({
  name: 'limit',
  description: 'Number of products to return',
  required: false,
  example: 6,
})
async getFeaturedProducts(@Query('limit') limit?: string): Promise<ProductResponseDto[]> {
  const { limit: limitNum } = parsePagination(1, limit, { limit: 6, maxLimit: 20 });
  return this.productsService.getFeaturedProducts(limitNum);
}
```

**Plan 정의**:

```typescript
GET /api/products/popular?limit=8&page=0
Response: {
  products: Product[],
  meta: { total, page, totalPages }
}
// Description: 판매수 기준 인기상품 (라이브 무관)
```

**🛠️ 신규 개발 필요**:

1. **New Endpoint**: `GET /api/products/popular`
2. **Logic**:
   ```sql
   SELECT p.*, SUM(oi.quantity) as sold_count
   FROM products p
   LEFT JOIN order_items oi ON oi.product_id = p.id
   LEFT JOIN orders o ON o.id = oi.order_id
     AND o.status IN ('PAYMENT_CONFIRMED', 'SHIPPED', 'DELIVERED')
   WHERE p.status = 'AVAILABLE'
   GROUP BY p.id
   ORDER BY sold_count DESC
   LIMIT {limit}
   ```
3. **Service Method**: `ProductsService.getPopularProducts(page: number, limit: number)`
4. **Database Index**: `order_items.productId` (추가 필요)

**Implementation Priority**: 🔴 High (Main page bottom section)

---

## 📊 Existing Related Endpoints

### Streaming Controller Routes

| Route                                        | Method | Auth | Current Name           | Plan 용도         |
| -------------------------------------------- | ------ | ---- | ---------------------- | ----------------- |
| `/streaming`                                 | POST   | 필수 | startStream            | 라이브 생성       |
| `/streaming/:id/go-live`                     | PATCH  | 필수 | goLive                 | 라이브 시작       |
| `/streaming/:id/stop`                        | PATCH  | 필수 | stopStream             | 라이브 종료       |
| `/streaming/active`                          | GET    | 공개 | **getActiveStreams**   | ✅ 라이브 배너    |
| `/streaming/upcoming`                        | GET    | 공개 | **getUpcomingStreams** | ✅ 곧 시작 라이브 |
| `/streaming/key/:streamKey/featured-product` | GET    | 공개 | getFeaturedProduct     | 라이브 대표상품   |

### Products Controller Routes

| Route                | Method | Auth  | Current Name        | Plan 용도           |
| -------------------- | ------ | ----- | ------------------- | ------------------- |
| `/products`          | POST   | Admin | create              | 상품 생성           |
| `/products/featured` | GET    | 공개  | getFeaturedProducts | 추천상품 (다름)     |
| `/products/store`    | GET    | 공개  | getStoreProducts    | 스토어 상품         |
| `/products`          | GET    | 공개  | findAll             | streamKey 기반 조회 |
| `/products/:id`      | GET    | 공개  | findById            | 단일 상품           |
| `/products/:id`      | PATCH  | Admin | update              | 상품 수정           |

---

## ✅ Plan Update Required

현재 plan.md (mainpage-admin-redesign.md)에서 수정 필요한 항목:

### Section A.1 API Specifications

**Issue 1**: GET /api/streaming/active 응답 형식

- [ ] `StreamingService.getActiveStreams()` 구현 확인
- [ ] 응답이 `items` + `total` 구조인지 검증

**Issue 2**: GET /api/streaming/upcoming 기본값

- [ ] 현재 코드: `limit: 3` (기본값)
- [ ] Plan: `limit: 4`
- [ ] **Decision**: 4로 변경할지 3으로 유지할지 결정 필요

**Issue 3**: GET /api/products/live-deals (신규)

- [ ] 엔드포인트 추가 정의 필요
- [ ] Service 메서드 시그니처 확정

**Issue 4**: GET /api/products/popular (신규)

- [ ] 엔드포인트 추가 정의 필요
- [ ] 페이지네이션 방식 (limit + offset vs page-based) 확정

---

## 🔄 Decision Points

### 1️⃣ GET /api/streaming/active 응답 형식

**Options**:

- A) 배열 반환: `LiveStream[]` (현재 코드 스타일)
- B) 객체 반환: `{ items: [LiveStream], total: number }` (Plan 스타일)

**Recommendation**: **B) 객체 반환** (Plan 추종)

- 일관성: `/api/streaming/upcoming`과 동일 구조
- 향후 메타데이터 추가 용이

---

### 2️⃣ GET /api/streaming/upcoming 기본값

**Current**: `limit: 3`
**Plan**: `limit: 4`

**Recommendation**: **4로 변경**

- Plan에서 정의한 "곧 시작하는 라이브 4개" 반영
- Frontend UI 레이아웃 최적화 (2x2 그리드)

---

### 3️⃣ GET /api/products/live-deals 구현 방식

**Options**:

- A) Service 신규 메서드 추가
- B) Products controller에 dedicated 라우트 추가

**Recommendation**: **A + B**

1. `ProductsService.getLiveDeals(limit: number)` 신규 메서드
2. `ProductsController.getLiveDeals()` 신규 라우트 (@Public)
3. SQL:
   ```sql
   SELECT p.*, ls.started_at
   FROM products p
   INNER JOIN livestreams ls ON p.stream_key = ls.stream_key
   WHERE ls.status = 'LIVE' AND p.status = 'AVAILABLE'
   ORDER BY ls.started_at DESC, p.created_at DESC
   LIMIT {limit}
   ```

---

### 4️⃣ GET /api/products/popular 페이지네이션

**Options**:

- A) Limit-Offset: `/api/products/popular?limit=8&offset=0`
- B) Page-Based: `/api/products/popular?limit=8&page=1`

**Recommendation**: **B) Page-Based** (기존 코드 패턴 추종)

- `getStoreProducts()` 참조 (line 86-105)
- `parsePagination(page, limit)` 유틸 재사용

---

## 📋 Phase 0 (Schema Migration) 업데이트

### Prisma Schema Changes

**추가 필요:**

1. ✅ `LiveStream.description` (nullable String) - 이미 plan에 정의됨
2. ✅ `@@index([productId])` on `order_items` - 이미 plan에 정의됨
3. ❌ `@@index([streamKey, status])` on `Product` - 신규 추가 권장
   - 성능: `WHERE stream_key = ? AND status = 'AVAILABLE'` 쿼리 가속

---

## 🚀 Implementation Checklist

### Phase 0: Database (선행 필수)

- [ ] Prisma migration: `LiveStream.description` 필드 추가
- [ ] Prisma migration: `order_items` 인덱스 추가
- [ ] Prisma migration: `products` (streamKey, status) 복합 인덱스 추가

### Phase 1A: Backend APIs (병렬 실행 가능)

**1A-1: Streaming 엔드포인트 수정**

- [ ] `getActiveStreams()` → 응답 형식 `{ items, total }` 확인/수정
- [ ] `getUpcomingStreams()` → 기본값 `limit: 4` 변경

**1A-2: Products 신규 엔드포인트 (라이브 상품)**

- [ ] `ProductsService.getLiveDeals(limit)` 메서드 구현
- [ ] `ProductsController.getLiveDeals()` 라우트 추가
- [ ] Service 로직 (현재 LIVE stream + 상품 8개)

**1A-3: Products 신규 엔드포인트 (인기상품)**

- [ ] `ProductsService.getPopularProducts(page, limit)` 메서드 구현
- [ ] `ProductsController.getPopularProducts()` 라우트 추가
- [ ] Service 로직 (OrderItem JOIN 기반 판매수 집계)

### Phase 2: Frontend (Phase 1A 완료 후)

- [ ] `useMainPageData()` hook
- [ ] 4개 컴포넌트 구현
- [ ] 로딩/에러/빈 상태 처리

### Phase 4: Integration Testing

- [ ] 4개 API 엔드포인트 E2E 테스트
- [ ] 응답 타입 검증

---

## 📝 Notes

### Backward Compatibility

- ✅ `/api/streaming/active` 기존 서비스에 영향 없음
- ✅ `/api/streaming/upcoming` 기본값 변경만 필요 (신규 파라미터 아님)
- ✅ `/api/products/live-deals` 신규 엔드포인트 (충돌 없음)
- ✅ `/api/products/popular` 신규 엔드포인트 (충돌 없음)

### Performance Considerations

1. **Order Items Index**: `popular` 쿼리 성능 개선 필수
2. **Redis Caching** (Phase 5): 선택적
   - `/api/products/popular`: 1시간 TTL
   - `/api/products/live-deals`: 실시간

### Frontend Integration

- Next.js proxy 자동 라우팅 가능
- TanStack Query hooks로 래핑 필요

---

## 📌 Approval Gates

이 검증 리포트 완료 후:

- [ ] Lead Developer 승인: Plan 수정 사항 확인
- [ ] Backend Lead 승인: 신규 API 설계 확정
- [ ] Phase 0 (DB migration) 승인 후 Phase 1 착수

**Next Step**: 이 검증 결과를 반영하여 `mainpage-admin-redesign.md` 업데이트 → 병렬 에이전트 실행
