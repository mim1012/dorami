# Dorami 라이브 커머스 - 코드 리뷰 보고서 v2

**분석 일시**: 2026-02-03
**분석 범위**: Backend (13,869줄) + Frontend (15,048줄)
**총 파일 수**: 390+ TypeScript/TSX 파일

---

## 1. 실행 요약

### 전체 품질 스코어: 6/10 (개선 필요)

| 카테고리 | 점수 | 상태 | 설명 |
|---------|------|------|------|
| 코드 품질 | 5/10 | ⚠️ | any 타입 과다, 함수 복잡도 높음 |
| 보안 | 4/10 | 🔴 | Rate Limiting 부재, CSP 약함 |
| 성능 | 6/10 | ⚠️ | N+1 쿼리 일부, 캐싱 제한적 |
| 아키텍처 | 7/10 | ✅ | NestJS 모듈 구조 양호 |
| 에러 처리 | 6/10 | ⚠️ | 패턴 존재하나 일관성 부족 |
| 테스트 | 4/10 | 🔴 | 커버리지 47%, Auth 테스트 없음 |
| 유지보수성 | 6/10 | ⚠️ | 문서화 부족, 설정 분산 |

---

## 2. Critical 이슈 (즉시 수정 필요)

### 2.1 Rate Limiting 부재

**심각도**: 🔴 Critical
**위치**: `backend/src/modules/auth/auth.controller.ts`
**문제**: 로그인/회원가입 엔드포인트에 Rate Limiting이 없어 Brute Force 공격에 취약

**현재 상태**:
```typescript
// auth.controller.ts
@Post('login')
async login(@Body() loginDto: LoginDto) {
  // Rate Limiting 없음
  return this.authService.login(loginDto);
}
```

**권장 수정**:
```typescript
@Post('login')
@Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } }) // 15분에 5회
async login(@Body() loginDto: LoginDto) {
  return this.authService.login(loginDto);
}

@Post('register')
@Throttle({ default: { limit: 3, ttl: 60 * 60 * 1000 } }) // 1시간에 3회
async register(@Body() registerDto: RegisterDto) {
  return this.authService.register(registerDto);
}
```

---

### 2.2 CSP unsafe-inline 허용

**심각도**: 🔴 Critical
**위치**: `backend/src/main.ts:34-45`
**문제**: Content Security Policy에서 `unsafe-inline`, `unsafe-eval` 허용으로 XSS 공격 가능

**현재 상태**:
```typescript
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // 🔴 위험
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
});
```

**권장 수정**:
```typescript
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"], // nonce 기반으로 변경
      styleSrc: ["'self'"],
      connectSrc: ["'self'", process.env.FRONTEND_URL],
      imgSrc: ["'self'", 'data:', 'https:'],
      mediaSrc: ["'self'", process.env.CDN_URL],
    },
  },
});
```

---

### 2.3 JWT Secret 개발환경 선택사항

**심각도**: 🔴 Critical
**위치**: `backend/src/common/config/config.validation.ts:27-37`
**문제**: 개발 환경에서 JWT_SECRET이 선택사항이라 보안 취약

**현재 상태**:
```typescript
JWT_SECRET: Joi.string()
  .min(32)
  .when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(), // 🔴 개발에서 optional
  }),
```

**권장 수정**:
```typescript
JWT_SECRET: Joi.string()
  .min(32)
  .required() // 모든 환경에서 필수
  .messages({
    'string.min': 'JWT_SECRET must be at least 32 characters',
    'any.required': 'JWT_SECRET is required for all environments',
  }),
```

---

### 2.4 CSRF 토큰 httpOnly: false

**심각도**: 🔴 Critical
**위치**: `backend/src/common/guards/csrf.guard.ts:111`
**문제**: CSRF 토큰이 JavaScript에서 접근 가능하여 XSS로 탈취 가능

**현재 상태**:
```typescript
response.cookie('csrf-token', newToken, {
  httpOnly: false, // 🔴 XSS로 탈취 가능
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000,
});
```

**권장 수정** (Double Cookie Pattern):
```typescript
// HTTP-only 쿠키 (서버 검증용)
response.cookie('csrf-token-server', newToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000,
});

// JavaScript 접근용 쿠키 (헤더 전송용)
response.cookie('csrf-token-client', newToken, {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000,
});
```

---

### 2.5 테스트 커버리지 부족

**심각도**: 🔴 Critical
**문제**: 전체 테스트 커버리지 약 47%, Auth/Controller 테스트 0%

**현재 테스트 현황**:

| 모듈 | 테스트 파일 | 상태 |
|------|-----------|------|
| Auth | 없음 | 🔴 |
| Orders | `orders.service.spec.ts` | ⚠️ 부분 |
| Products | `products.service.spec.ts` | ⚠️ 부분 |
| Cart | 없음 | 🔴 |
| Admin | `admin.service.spec.ts` | ⚠️ 부분 |
| Controllers | 없음 | 🔴 |
| Guards | 없음 | 🔴 |

**필수 추가 테스트**:
- `auth.service.spec.ts` - 로그인, 토큰 갱신, 권한 검증
- `auth.controller.spec.ts` - 엔드포인트 테스트
- `roles.guard.spec.ts` - Role 검증 테스트
- `csrf.guard.spec.ts` - CSRF 보호 테스트

---

## 3. High 이슈

### 3.1 any 타입 과다 사용

**심각도**: 🟠 High
**발견 위치**: 36개 인스턴스

| 파일 | 라인 | 코드 |
|------|------|------|
| `streaming.service.ts` | 34 | `Promise<any[]>` |
| `cart/page.tsx` | 54 | `catch (err: any)` |
| `users.service.ts` | 106 | `as any` |
| `admin.service.ts` | 다수 | JSON 타입 처리 |

**권장 수정 예시**:
```typescript
// Before
async getUpcomingStreams(limit: number = 3): Promise<any[]>

// After
interface UpcomingStreamDto {
  id: string;
  title: string;
  scheduledTime: Date;
  thumbnailUrl: string | null;
  isLive: boolean;
}
async getUpcomingStreams(limit: number = 3): Promise<UpcomingStreamDto[]>
```

---

### 3.2 N+1 쿼리 문제

**심각도**: 🟠 High
**위치**: `backend/src/modules/admin/admin.service.ts:124-141`

**현재 상태**:
```typescript
const users = await this.prisma.user.findMany({
  where,
  select: {
    id: true,
    email: true,
    name: true,
    // orders count가 없음 - 별도 쿼리 필요
  },
});
```

**권장 수정**:
```typescript
const users = await this.prisma.user.findMany({
  where,
  select: {
    id: true,
    email: true,
    name: true,
    _count: {
      select: { orders: true }
    }
  },
});
```

---

### 3.3 중복 코드 (주문 취소 로직)

**심각도**: 🟠 High
**위치**: `backend/src/modules/orders/orders.service.ts:364-485`

**문제**: 주문 취소 로직이 `cancelOrder()`와 `cancelExpiredOrders()`에서 중복

**현재 상태**:
```typescript
// 중복 1: cancelOrder() (라인 364-388)
async cancelOrder(orderId: string) {
  // 재고 복구 로직
  for (const item of order.orderItems) {
    await this.prisma.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }
  // 주문 상태 업데이트
}

// 중복 2: cancelExpiredOrders() (라인 437-485)
@Cron(CronExpression.EVERY_MINUTE)
async cancelExpiredOrders() {
  // 동일한 재고 복구 로직 반복
  for (const item of order.orderItems) {
    await this.prisma.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }
}
```

**권장 수정**:
```typescript
private async restoreOrderStock(
  tx: PrismaTransaction,
  orderItems: OrderItem[]
): Promise<void> {
  await Promise.all(
    orderItems.map(item =>
      tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      })
    )
  );
}

async cancelOrder(orderId: string) {
  return this.prisma.$transaction(async (tx) => {
    const order = await this.getOrderWithItems(tx, orderId);
    await this.restoreOrderStock(tx, order.orderItems);
    return this.updateOrderStatus(tx, orderId, 'CANCELLED');
  });
}
```

---

### 3.4 console.log 직접 사용

**심각도**: 🟠 High
**위치**: `backend/src/modules/chat/chat.gateway.ts` 등 7개 파일

**현재 상태**:
```typescript
// chat.gateway.ts
console.log('✅ Chat Gateway initialized');
console.log(`✅ Client connected: ${client.id}`);
console.error('❌ Connection failed:', error.message);
```

**권장 수정**:
```typescript
private readonly logger = new Logger(ChatGateway.name);

afterInit() {
  this.logger.log('Chat Gateway initialized');
}

handleConnection(client: Socket) {
  this.logger.log(`Client connected: ${client.id}`);
}
```

---

### 3.5 함수 길이 과다 (119줄)

**심각도**: 🟠 High
**위치**: `backend/src/modules/orders/orders.service.ts:65-184`

**문제**: `createOrderFromCart()` 함수가 119줄로 Single Responsibility Principle 위반

**권장 리팩토링**:
```typescript
async createOrderFromCart(userId: string): Promise<OrderResponseDto> {
  return this.prisma.$transaction(async (tx) => {
    const user = await this.validateAndGetUser(tx, userId);
    const cartItems = await this.getValidCartItems(tx, userId);
    const totals = this.calculateOrderTotals(cartItems);
    const order = await this.createOrderRecord(tx, user, cartItems, totals);
    await this.processInventory(tx, cartItems);
    await this.clearUserCart(tx, userId);
    this.emitOrderCreatedEvent(order);
    return this.mapToResponseDto(order);
  });
}
```

---

## 4. Medium 이슈

### 4.1 ValidationPipe 설정 미흡

**위치**: `backend/src/main.ts:70-80`

```typescript
// 현재
transformOptions: {
  enableImplicitConversion: true, // 암시적 변환 위험
}

// 권장
transformOptions: {
  enableImplicitConversion: false,
}
forbidUnknownValues: true, // 추가
```

---

### 4.2 에러 로깅 중복

**위치**: `backend/src/modules/products/products.service.ts:88-92`

모든 함수에서 동일한 try-catch 패턴 반복 (9회)

**권장**: 데코레이터로 추상화
```typescript
@CatchAndLog()
async create(dto: CreateProductDto): Promise<ProductResponseDto> {
  // try-catch 없음
}
```

---

### 4.3 환경 변수로 제어 안 되는 설정

**위치**: `backend/src/main.ts`

CORS origins, CSP directives 등이 하드코딩됨

---

## 5. 아키텍처 분석

### 5.1 강점

- ✅ 명확한 NestJS 모듈 구조 (13개 기능 모듈)
- ✅ SOLID 원칙 준수 (Dependency Injection)
- ✅ Domain Event 패턴 구현
- ✅ 적절한 계층 분리 (Controller → Service → Repository)
- ✅ Prisma ORM 사용 (SQL Injection 방지)

### 5.2 모듈 구조

```
backend/src/modules/
├── admin/          # 관리자 기능
├── auth/           # 인증/인가
├── cart/           # 장바구니
├── chat/           # 실시간 채팅
├── orders/         # 주문 관리
├── products/       # 상품 관리
├── reservation/    # 예약 시스템
├── settlement/     # 정산
├── streaming/      # 라이브 스트리밍
└── users/          # 사용자 관리
```

### 5.3 의존성 관계

```
AppModule
├── AuthModule (독립)
├── UsersModule ← AuthModule
├── ProductsModule ← StreamingModule
├── CartModule ← ProductsModule, UsersModule
├── OrdersModule ← CartModule, ProductsModule, UsersModule
├── StreamingModule ← UsersModule
├── ChatModule ← StreamingModule, UsersModule
├── AdminModule ← All Modules
└── SettlementModule ← OrdersModule
```

**주의**: AdminModule이 모든 모듈에 의존하여 순환 의존성 위험

---

## 6. 보안 체크리스트

### 인증/인가

| 항목 | 상태 | 비고 |
|------|------|------|
| OAuth 2.0 (Kakao) | ✅ | 구현됨 |
| JWT Access Token | ✅ | 15분 만료 |
| JWT Refresh Token | ✅ | 7일 만료 |
| Token Blacklist | ✅ | Redis 사용 |
| HTTP-only Cookie | ✅ | Refresh Token |
| Role-based Access | ⚠️ | 단순함, 개선 필요 |

### 입력 검증

| 항목 | 상태 | 비고 |
|------|------|------|
| Global ValidationPipe | ✅ | 설정됨 |
| DTO Validation | ✅ | class-validator |
| Whitelist | ✅ | unknown 속성 제거 |
| Path Parameter 검증 | ⚠️ | 일부 부재 |

### 보안 헤더

| 항목 | 상태 | 비고 |
|------|------|------|
| Helmet | ✅ | 기본 설정 |
| CSP | 🔴 | unsafe-inline 허용 |
| HSTS | ⚠️ | 프로덕션만 |
| X-Frame-Options | ✅ | SAMEORIGIN |
| X-Content-Type-Options | ✅ | nosniff |

### 공격 방어

| 항목 | 상태 | 비고 |
|------|------|------|
| SQL Injection | ✅ | Prisma ORM |
| XSS | ⚠️ | CSP 개선 필요 |
| CSRF | ⚠️ | httpOnly 개선 필요 |
| Rate Limiting | 🔴 | 엔드포인트별 없음 |

---

## 7. 성능 분석

### 7.1 데이터베이스

| 항목 | 상태 | 비고 |
|------|------|------|
| Connection Pooling | ✅ | Prisma 기본 |
| N+1 Query 방지 | ⚠️ | 일부 문제 |
| Index | ⚠️ | 추가 필요 |
| Transaction | ✅ | 적절히 사용 |

**권장 인덱스**:
```prisma
model User {
  @@index([email])
  @@index([createdAt])
}

model Order {
  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

model Product {
  @@index([streamKey])
  @@index([status])
}
```

### 7.2 캐싱

| 항목 | 상태 | 비고 |
|------|------|------|
| Redis 활용 | ✅ | Token, Timer |
| Product 캐싱 | ❌ | 미구현 |
| User 캐싱 | ❌ | 미구현 |
| API Response 캐싱 | ❌ | 미구현 |

### 7.3 비동기 처리

| 항목 | 상태 | 비고 |
|------|------|------|
| Promise.all | ✅ | Cart, Inventory |
| Event-driven | ✅ | Order Events |
| Background Jobs | ✅ | Cron 사용 |

---

## 8. 테스트 현황

### 8.1 커버리지

| 카테고리 | 파일 수 | 테스트 | 커버리지 |
|---------|--------|--------|---------|
| Services | 15+ | 7 | ~47% |
| Controllers | 10+ | 0 | 0% |
| Guards | 3 | 0 | 0% |
| Utils | 5 | 1 | ~20% |

### 8.2 필수 추가 테스트

**Priority 1 - Critical**:
- `auth.service.spec.ts`
- `auth.controller.spec.ts`
- `roles.guard.spec.ts`

**Priority 2 - High**:
- `orders.controller.spec.ts`
- `cart.service.spec.ts`
- `csrf.guard.spec.ts`

**Priority 3 - Medium**:
- E2E 테스트 확장
- Integration 테스트

---

## 9. 개선 로드맵

### Phase 1: Critical (Week 1-2)

| 작업 | 파일 | 예상 시간 |
|------|------|----------|
| Rate Limiting 추가 | `auth.controller.ts` | 4h |
| CSP 강화 | `main.ts` | 4h |
| JWT Secret 필수화 | `config.validation.ts` | 1h |
| CSRF 토큰 개선 | `csrf.guard.ts` | 4h |
| Auth 테스트 작성 | `auth.service.spec.ts` | 8h |

### Phase 2: High (Week 3-4)

| 작업 | 파일 | 예상 시간 |
|------|------|----------|
| any 타입 제거 | 다수 | 8h |
| N+1 쿼리 수정 | `admin.service.ts` | 4h |
| 중복 코드 리팩토링 | `orders.service.ts` | 6h |
| console.log 제거 | 7개 파일 | 2h |
| Controller 테스트 | 다수 | 12h |

### Phase 3: Medium (Month 2)

| 작업 | 예상 시간 |
|------|----------|
| 테스트 커버리지 70% | 20h |
| 캐싱 전략 구현 | 12h |
| 인덱스 최적화 | 4h |
| 문서화 | 8h |

---

## 10. 파일별 품질 점수

### Backend

| 파일 | 라인 | 점수 | 주요 이슈 |
|------|------|------|----------|
| `main.ts` | 237 | 6/10 | CSP, ValidationPipe |
| `app.module.ts` | 98 | 6/10 | 모듈 의존성 |
| `auth.service.ts` | 160 | 7/10 | Rate Limiting 필요 |
| `orders.service.ts` | 512 | 5/10 | 함수 길이, 중복 |
| `products.service.ts` | 501 | 5/10 | 에러 로깅 중복 |
| `cart.service.ts` | 414 | 7/10 | Promise.all 사용 |
| `admin.service.ts` | 800+ | 5/10 | N+1, 복잡도 |
| `streaming.service.ts` | 300+ | 6/10 | any 타입 |

### Frontend

| 파일 | 라인 | 점수 | 주요 이슈 |
|------|------|------|----------|
| `cart/page.tsx` | 209 | 6/10 | any 에러 타입 |
| `lib/api/client.ts` | 106 | 7/10 | CSRF 처리 양호 |
| `layout.tsx` | 36 | 8/10 | 구조 깔끔 |

---

## 11. 결론

### 강점
1. 견고한 NestJS 아키텍처
2. JWT + OAuth 인증 체계
3. 이벤트 기반 설계
4. Prisma ORM 활용

### 즉시 개선 필요
1. 🔴 Rate Limiting 추가
2. 🔴 CSP 정책 강화
3. 🔴 테스트 커버리지 확대
4. 🔴 타입 안전성 개선

### 권장 목표

| 메트릭 | 현재 | 목표 (3개월) |
|--------|------|-------------|
| 테스트 커버리지 | 47% | 70% |
| any 타입 사용 | 36개 | 0개 |
| 보안 점수 | 4/10 | 8/10 |
| 전체 품질 | 6/10 | 8/10 |

---

*이 문서는 자동화된 코드 분석과 수동 검토를 기반으로 작성되었습니다.*
