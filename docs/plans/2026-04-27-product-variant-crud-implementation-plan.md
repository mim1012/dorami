# Product Variant CRUD Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 도레미 상품등록 및 주문 플로우에서 옵션/사이즈 조합별 가격과 재고를 입력·조회·수정할 수 있도록 ProductVariant 중심 CRUD를 도입한다.

**Architecture:** 기존 `Product.price + colorOptions[] + sizeOptions[]` 중심 구조를 유지 호환하되, 실제 판매 단위를 `ProductVariant`로 분리한다. 관리자 상품 CRUD는 `Product + variants[]` 형태로 확장하고, 장바구니/주문은 `variantId` 기준으로 저장하되 가격·옵션 스냅샷을 남긴다.

**Tech Stack:** NestJS, Prisma, PostgreSQL, shared-types, Next.js client-app, Jest, Playwright

---

## 범위/원칙

- 이번 작업은 **옵션/사이즈별 가격/재고 CRUD**에 집중한다.
- 기존 단일 가격 상품도 계속 동작해야 한다.
- `Product`는 상품 공통 정보, `ProductVariant`는 실제 판매 단위로 사용한다.
- 주문 시점 가격은 snapshot 저장으로 고정한다.
- 삭제는 hard delete보다 `status/deletedAt` 기반 soft-delete 우선.

---

## 현재 영향 파일

### Backend

- `backend/prisma/schema.prisma`
- `backend/src/modules/products/dto/product.dto.ts`
- `backend/src/modules/products/product.mapper.ts`
- `backend/src/modules/products/products.service.ts`
- `backend/src/modules/products/products.controller.ts`
- `backend/src/modules/products/products.service.spec.ts`
- `backend/src/modules/cart/dto/cart.dto.ts`
- `backend/src/modules/cart/cart.service.ts`
- `backend/src/modules/cart/cart.service.spec.ts`
- `backend/src/modules/orders/dto/order.dto.ts`
- `backend/src/modules/orders/orders.service.ts`
- `backend/src/modules/orders/orders.service.spec.ts`

### Shared types

- `packages/shared-types/src/index.ts`
- 필요 시 `packages/shared-types/src/mainpage.ts`

### Frontend

- `client-app/src/lib/types/product.ts`
- `client-app/src/lib/schemas/product.ts`
- `client-app/src/lib/api/products.ts`
- `client-app/src/components/live/ProductOptionModal.tsx`
- 상품 등록/수정 admin form 컴포넌트들 (`client-app/src/...admin...` 실제 검색 후 반영)
- 관련 e2e:
  - `client-app/e2e/admin-products-crud.spec.ts`
  - `client-app/e2e/live-featured-product-purchase.spec.ts`

---

## 목표 데이터 모델

### Product (공통 정보)

- `id`
- `streamKey`
- `name`
- `price` (호환용 대표가/최저가)
- `quantity` (호환용 총재고 or variant 합계 캐시)
- `imageUrl`, `images`
- `timerEnabled`, `timerDuration`
- `discountRate`, `originalPrice`
- `status`

### ProductVariant (신규)

- `id`
- `productId`
- `color` nullable
- `size` nullable
- `label` optional (`Black / XL`)
- `price`
- `stock`
- `status` (`ACTIVE`, `SOLD_OUT`, `HIDDEN`)
- `sortOrder`
- `createdAt`
- `updatedAt`
- `deletedAt` nullable

### Cart 추가 필드

- `variantId` nullable → 점진 이행 고려 시 nullable로 시작 가능
- `variantLabel`
- `unitPrice` 또는 기존 `price` 재사용

### OrderItem 추가 필드

- `variantId`
- `variantLabel`
- `color`
- `size`
- `price`는 주문 시점 snapshot 유지

---

## API 목표 형태

### 관리자 상품 생성/수정

```json
{
  "name": "후드집업",
  "streamKey": "abc123",
  "imageUrl": "https://...",
  "timerEnabled": false,
  "variants": [
    { "color": "Black", "size": "M", "price": 29, "stock": 3, "status": "ACTIVE" },
    { "color": "Black", "size": "L", "price": 31, "stock": 1, "status": "ACTIVE" },
    { "color": "Gray", "size": "M", "price": 30, "stock": 5, "status": "ACTIVE" }
  ]
}
```

### 장바구니 담기

```json
{
  "variantId": "pv_123",
  "quantity": 2
}
```

### 주문 조회 item

```json
{
  "productId": "prod_1",
  "variantId": "pv_123",
  "productName": "후드집업",
  "variantLabel": "Black / M",
  "color": "Black",
  "size": "M",
  "price": "29.00",
  "quantity": 2
}
```

---

## Task 1: Prisma 스키마에 ProductVariant 추가

**Objective:** 옵션/사이즈별 가격/재고를 저장할 신규 테이블을 도입한다.

**Files:**

- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_add_product_variants/*`

**Step 1: failing schema design note 작성**

- `ProductVariant` 모델 초안을 스키마에 주석으로 먼저 넣는다.
- `VariantStatus` enum도 같이 설계한다.

**Step 2: Prisma 모델 추가**
추가할 핵심 필드:

```prisma
model ProductVariant {
  id        String        @id @default(uuid())
  productId  String        @map("product_id")
  product    Product       @relation(fields: [productId], references: [id], onDelete: Cascade)
  color      String?
  size       String?
  label      String?       @map("label")
  price      Decimal       @db.Decimal(10, 2)
  stock      Int
  status     VariantStatus @default(ACTIVE)
  sortOrder  Int           @default(0) @map("sort_order")
  deletedAt  DateTime?     @map("deleted_at")
  createdAt  DateTime      @default(now()) @map("created_at")
  updatedAt  DateTime      @updatedAt @map("updated_at")

  @@index([productId, status])
  @@index([productId, sortOrder])
  @@unique([productId, color, size])
  @@map("product_variants")
}

enum VariantStatus {
  ACTIVE
  SOLD_OUT
  HIDDEN
}
```

**Step 3: Product relation 연결**
`Product`에 아래 relation 추가:

```prisma
variants ProductVariant[]
```

**Step 4: Cart/OrderItem 확장**

- `Cart.variantId`, `Cart.variantLabel`
- `OrderItem.variantId`, `OrderItem.variantLabel`
  추가

**Step 5: migration 생성/검증**
Run:

```bash
cd /private/tmp/dorami-develop/backend
npx prisma migrate dev --name add_product_variants
npx prisma generate
```

Expected: migration 생성 + Prisma client 갱신 성공

**Step 6: Commit**

```bash
git add backend/prisma
git commit -m "feat: add product variant schema"
```

---

## Task 2: shared-types와 DTO에 variant 타입 추가

**Objective:** API contract가 variants[]를 읽고 쓸 수 있게 만든다.

**Files:**

- Modify: `packages/shared-types/src/index.ts`
- Modify: `backend/src/modules/products/dto/product.dto.ts`
- Modify: `backend/src/modules/cart/dto/cart.dto.ts`
- Modify: `backend/src/modules/orders/dto/order.dto.ts`

**Step 1: shared-types에 Variant 인터페이스 추가**

```ts
export type VariantStatus = 'ACTIVE' | 'SOLD_OUT' | 'HIDDEN';

export interface ProductVariant {
  id: string;
  productId: string;
  color?: string;
  size?: string;
  label?: string;
  price: number;
  stock: number;
  status: VariantStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
```

**Step 2: Product 타입 확장**
`Product`에 추가:

```ts
variants?: ProductVariant[];
minPrice?: number;
maxPrice?: number;
```

**Step 3: CreateProductDto/UpdateProductDto에 variants 추가**

- `CreateProductVariantDto`
- `UpdateProductVariantDto`
- `variants?: CreateProductVariantDto[]`

필수 검증:

- 중복 color/size 조합 금지 (service에서도 재검증)
- `price > 0`
- `stock >= 0`

**Step 4: AddToCartDto를 variantId 기반으로 확장**

```ts
variantId?: string;
```

초기 이행 단계에서는 `productId` 유지 가능. 최종 목표는 `variantId` 필수.

**Step 5: OrderResponseDto item 확장**

- `variantId?: string`
- `variantLabel?: string`
- `color?: string`
- `size?: string`

**Step 6: 타입체크**
Run:

```bash
cd /private/tmp/dorami-develop
npm run type-check --workspace=backend
npm run type-check --workspace=client-app
```

**Step 7: Commit**

```bash
git add packages/shared-types backend/src/modules/*/dto
git commit -m "feat: add variant DTO and shared types"
```

---

## Task 3: Product mapper/service에 variants CRUD 추가

**Objective:** 상품 생성/조회/수정 시 variants를 저장하고 반환한다.

**Files:**

- Modify: `backend/src/modules/products/product.mapper.ts`
- Modify: `backend/src/modules/products/products.service.ts`
- Modify: `backend/src/modules/products/products.service.spec.ts`

**Step 1: failing test 작성**
케이스:

- create 시 variants 저장
- duplicate color/size 거부
- update 시 variants upsert
- findById/findByStreamKey 시 variants 반환

Run:

```bash
cd /private/tmp/dorami-develop/backend
npm test -- products.service.spec.ts
```

Expected: FAIL

**Step 2: mapper 확장**
`mapProductToDto`가 `variants` relation 포함 시 DTO로 변환하도록 수정

**Step 3: create 로직 구현**

- `createDto.variants?.length > 0`면 nested create
- product `price`는 variants 최저가로 동기화
- product `quantity`는 variants 총합으로 동기화
- 기존 `colorOptions`, `sizeOptions`는 variants에서 derive 하여 호환 유지

**Step 4: update 로직 구현**
업데이트 전략:

- 단순/안전하게는 `product.variants` 전체 replace
- 단, 이미 주문/카트 참조 중인 variant 삭제 정책은 soft-delete 처리

초기 추천:

1. 기존 variant 조회
2. 요청에 없는 variant는 `HIDDEN` 또는 `deletedAt` 처리
3. 요청 variant 중 id 있으면 update, 없으면 create

**Step 5: 조회 로직 구현**

- `findById`, `findByStreamKey`, `findAll`, featured 관련 조회에서 `variants` include 여부 정리
- 라이브/스토어 목록에는 summary만, admin/detail에는 full variants

**Step 6: 테스트 통과 확인**
Run:

```bash
cd /private/tmp/dorami-develop/backend
npm test -- products.service.spec.ts
npm run build --workspace=backend
```

Expected: PASS

**Step 7: Commit**

```bash
git add backend/src/modules/products
git commit -m "feat: add product variant CRUD to products service"
```

---

## Task 4: 관리자 상품등록 UI를 variant 테이블 방식으로 전환

**Objective:** 관리자 화면에서 옵션/사이즈별 가격/재고를 행 단위로 입력 가능하게 만든다.

**Files:**

- Modify: `client-app/src/lib/types/product.ts`
- Modify: `client-app/src/lib/schemas/product.ts`
- Modify: 실제 admin 상품 form 컴포넌트 검색 후 반영
- Possibly create: `client-app/src/components/admin/products/ProductVariantTable.tsx`

**Step 1: admin form 파일 찾기**
검색:

```bash
cd /private/tmp/dorami-develop
rg -n "originalPrice|discountPrice|stock|colorOptions|sizeOptions" client-app/src
```

**Step 2: failing UI validation 설계**
검증 항목:

- variant 1개 이상 필요
- 같은 color+size 조합 중복 금지
- price/stock 숫자 검증

**Step 3: Zod schema 확장**

```ts
variants: z.array(
  z.object({
    id: z.string().optional(),
    color: z.string().optional(),
    size: z.string().optional(),
    price: z.string().min(1),
    stock: z.string().min(1),
    status: z.enum(['ACTIVE', 'SOLD_OUT', 'HIDDEN']).default('ACTIVE'),
  }),
).min(1);
```

**Step 4: variant 테이블 UI 구현**
컬럼:

- 색상
- 사이즈
- 가격
- 재고
- 상태
- 삭제

기능:

- 행 추가
- 행 삭제
- duplicate highlight
- CSV/붙여넣기 지원은 후순위

**Step 5: submit payload 변경**

- 더 이상 `colorOptions`, `sizeOptions`만 보내지 말고 `variants[]` 전송
- 단기 호환 위해 backend가 derive 하도록 유지

**Step 6: 검증**
Run:

```bash
cd /private/tmp/dorami-develop
npm run type-check --workspace=client-app
npm run build --workspace=client-app
```

**Step 7: Commit**

```bash
git add client-app/src
git commit -m "feat: add variant table to admin product form"
```

---

## Task 5: 라이브/스토어 상품상세에서 선택한 옵션에 따라 가격 표시

**Objective:** 사용자가 색상/사이즈를 선택하면 variant 가격과 재고를 기준으로 구매하게 한다.

**Files:**

- Modify: `client-app/src/components/live/ProductOptionModal.tsx`
- Modify: `client-app/src/components/product/ProductDetailModal.tsx`
- Modify: 관련 API 타입 파일

**Step 1: failing UX 정의**
기존 문제:

- `product.price` 고정 사용
- 옵션 선택 UI가 placeholder 수준

**Step 2: selectedVariant 계산 구현**
로직:

- color, size 선택값으로 `product.variants`에서 일치 variant 찾기
- 1옵션 상품이면 color 또는 size 중 하나만 비교
- 옵션 미선택 시 CTA disabled

**Step 3: 가격/재고 표시 전환**

- `selectedVariant.price`
- `selectedVariant.stock`
- totalPrice = `selectedVariant.price * quantity`

**Step 4: addToCart payload 변경**

```ts
onAddToCart({ variantId: selectedVariant.id, quantity });
```

**Step 5: 품절/비활성 처리**

- selectedVariant 없으면 담기 비활성화
- stock 0 또는 status SOLD_OUT이면 품절 표기

**Step 6: UI 검증**

- 색상 변경 시 가격 변경
- 사이즈 변경 시 가격/재고 변경
- 조합 불가 variant 선택 차단

**Step 7: Commit**

```bash
git add client-app/src/components/live client-app/src/components/product
git commit -m "feat: use selected variant price in product option flows"
```

---

## Task 6: Cart를 variantId 기준으로 저장

**Objective:** 장바구니가 상품이 아니라 variant 판매단위를 기준으로 동작하게 만든다.

**Files:**

- Modify: `backend/src/modules/cart/dto/cart.dto.ts`
- Modify: `backend/src/modules/cart/cart.service.ts`
- Modify: `backend/src/modules/cart/cart.service.spec.ts`

**Step 1: failing test 작성**
케이스:

- variantId로 cart 추가
- variant stock 초과 거부
- cart 응답에 variantLabel/color/size/price 포함

**Step 2: addToCart 로직 변경**
서버 로직:

1. `variantId` 조회
2. parent product 조회
3. status/stock 검증
4. cart에 `variantId`, `variantLabel`, `color`, `size`, `price snapshot` 저장

**Step 3: 기존 productId fallback 유지 여부 결정**
권장:

- 1차 이행 중에는 `variantId` 없으면 단일 variant 상품에서만 허용
- variant 여러 개인 상품은 `variantId` 필수

**Step 4: cart summary 응답 확장**
반환:

- variantId
- variantLabel
- color
- size
- unit price

**Step 5: 테스트/빌드**
Run:

```bash
cd /private/tmp/dorami-develop/backend
npm test -- cart.service.spec.ts
npm run build --workspace=backend
```

**Step 6: Commit**

```bash
git add backend/src/modules/cart
git commit -m "feat: store cart items by product variant"
```

---

## Task 7: 주문 생성/조회에 variant snapshot 반영

**Objective:** 주문서에서 옵션/사이즈별 가격과 선택 정보를 안정적으로 조회할 수 있게 한다.

**Files:**

- Modify: `backend/src/modules/orders/dto/order.dto.ts`
- Modify: `backend/src/modules/orders/orders.service.ts`
- Modify: `backend/src/modules/orders/orders.service.spec.ts`

**Step 1: failing test 작성**
케이스:

- cart 기반 주문 생성 시 variant 정보 복사
- 주문 조회 시 variantLabel/color/size 표시
- 가격 snapshot 유지

**Step 2: createOrder/fromCart 로직 수정**
`OrderItem` 생성 시 저장:

- `productId`
- `variantId`
- `productName`
- `variantLabel`
- `color`
- `size`
- `price`
- `quantity`

**Step 3: 조회 mapper 수정**

- 주문 상세/목록 응답에 variant 관련 필드 포함
- 기존 notification payload 영향 여부 점검

**Step 4: 테스트/검증**
Run:

```bash
cd /private/tmp/dorami-develop/backend
npm test -- orders.service.spec.ts
npm run build --workspace=backend
```

**Step 5: Commit**

```bash
git add backend/src/modules/orders
git commit -m "feat: persist variant snapshots on order items"
```

---

## Task 8: 레거시 호환/집계값 동기화 정리

**Objective:** 기존 코드가 단일 `price/stock/colorOptions/sizeOptions`를 읽는 부분이 깨지지 않게 한다.

**Files:**

- Modify: `backend/src/modules/products/products.service.ts`
- Modify: `backend/src/modules/streaming/streaming.service.ts`
- Modify: `client-app/src/lib/api/*` 관련 파일
- Modify: `packages/shared-types/src/mainpage.ts` (필요시)

**Step 1: 대표값 정책 정의**

- `price` = 활성 variant 최저가
- `quantity/stock` = 활성 variant 총합
- `colorOptions` = variants distinct color
- `sizeOptions` = variants distinct size

**Step 2: mapper helper 작성**

```ts
function deriveProductSummaryFromVariants(variants) {
  // min price / total stock / distinct colors / distinct sizes
}
```

**Step 3: 목록/라이브 API 영향 확인**

- featured product
- stream products
- store page
- main page

**Step 4: 회귀 테스트**

- 기존 단일가격 상품도 정상 노출
- variants 없는 legacy 상품도 깨지지 않음

**Step 5: Commit**

```bash
git add backend client-app packages/shared-types
git commit -m "refactor: derive product summary from variants"
```

---

## Task 9: 통합 테스트와 E2E 검증

**Objective:** 관리자 등록 → 라이브/스토어 조회 → 장바구니 → 주문까지 end-to-end 검증한다.

**Files:**

- Modify: `backend/test/products.e2e-spec.ts`
- Modify: `client-app/e2e/admin-products-crud.spec.ts`
- Modify: `client-app/e2e/live-featured-product-purchase.spec.ts`

**Step 1: backend e2e 작성**
시나리오:

- 상품 생성 with variants
- variants 조회 확인
- cart add with variantId
- order create with variant snapshot

**Step 2: Playwright 시나리오 추가**
관리자:

- variant 2~3개 입력 후 저장
- 저장 후 목록/상세에서 가격/재고 조회

사용자:

- 라이브 또는 스토어에서 옵션 선택
- variant 가격 반영 확인
- 장바구니/주문서에 옵션/사이즈 표기 확인

**Step 3: 테스트 실행**
Run:

```bash
cd /private/tmp/dorami-develop
npm run build --workspace=backend
npm run type-check --workspace=client-app
cd client-app && npx playwright test e2e/admin-products-crud.spec.ts
cd client-app && npx playwright test e2e/live-featured-product-purchase.spec.ts
```

**Step 4: Commit**

```bash
git add backend/test client-app/e2e
git commit -m "test: cover product variant CRUD flow"
```

---

## Task 10: 배포/마이그레이션 전략

**Objective:** 운영 리스크를 줄이면서 staging-first로 반영한다.

**Files:**

- Modify: 필요 시 배포 문서 `docs/operations/...`

**Step 1: 2단계 배포 전략 사용**

1. schema + backend read/write 호환 배포
2. frontend variant UI 배포

**Step 2: 데이터 이관 스크립트 준비**
기존 상품이 `colorOptions/sizeOptions`만 있고 variants가 없으면:

- 단일 variant 자동 생성
- 가격 = product.price
- stock = product.quantity
- color/size는 null 또는 단일 값 기반 생성

**Step 3: staging 검증**
체크리스트:

- 관리자 상품 등록 성공
- 상품 조회에서 variants 확인
- 장바구니 variantId 저장
- 주문 상세 옵션/사이즈/가격 노출

**Step 4: prod 반영 전 확인**

- 기존 단일 상품 깨짐 없음
- 알림/주문 confirmation payload 회귀 없음
- sold out 계산이 variant 기준으로 과판매 안 나는지 확인

---

## 추천 구현 순서 요약

1. Prisma/ProductVariant 추가
2. shared-types + DTO 확장
3. products service CRUD
4. admin form variant 테이블
5. live/store 옵션 선택 UI
6. cart variantId 저장
7. order snapshot 저장
8. summary/legacy 호환 정리
9. e2e 검증
10. staging 배포

---

## 빠른 의사결정 포인트

### 반드시 확정할 것

1. `Product.price`를 **대표가(최저가)** 로 볼지
2. `Product.quantity`를 **variant 총합 캐시**로 볼지
3. variant 삭제를 hard delete 금지할지
4. 기존 상품 데이터 자동 migration 정책

### 추천값

- `Product.price` = 최저가
- `Product.quantity` = 총합 재고
- variant 삭제 = soft delete
- legacy 상품 = 단일 variant 자동 생성

---

## 완료 정의 (Definition of Done)

- 관리자 상품 등록/수정에서 옵션/사이즈별 가격/재고 입력 가능
- 상품 조회 응답에서 variants[] 확인 가능
- 라이브/스토어에서 옵션 선택 시 해당 가격/재고 반영
- 장바구니가 variantId 기준으로 저장
- 주문서에 옵션/사이즈/가격 snapshot 조회 가능
- staging에서 CRUD + 주문 플로우 검증 완료
