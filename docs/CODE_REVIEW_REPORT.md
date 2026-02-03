# 도라미 (Live Commerce Platform) 코드 리뷰 종합 보고서

**작성일**: 2026-02-03
**분석 범위**: 전체 코드베이스 (Backend, Frontend, Shared Types)
**분석 파일 수**: 300+ TypeScript/TSX 파일

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [Executive Summary](#2-executive-summary)
3. [Critical Issues (즉시 조치)](#3-critical-issues-즉시-조치)
4. [Backend 코드 품질](#4-backend-코드-품질)
5. [Frontend 코드 품질](#5-frontend-코드-품질)
6. [보안 취약점](#6-보안-취약점)
7. [아키텍처 분석](#7-아키텍처-분석)
8. [추가 중요 항목](#8-추가-중요-항목)
9. [개선 로드맵](#9-개선-로드맵)
10. [체크리스트](#10-체크리스트)

---

## 1. 프로젝트 개요

### 1.1 기술 스택

| 영역 | 기술 |
|------|------|
| **Frontend** | Next.js 16.1, React 19, TypeScript 5.7, Tailwind CSS 4.0 |
| **Backend** | NestJS 11.1, TypeScript 5.9, Prisma 6.19 |
| **Database** | PostgreSQL 16 |
| **Cache** | Redis 7 |
| **Real-time** | Socket.IO 4.8 |
| **인증** | Kakao OAuth, JWT |

### 1.2 프로젝트 구조

```
dorami/
├── packages/
│   └── shared-types/          # 공유 TypeScript 타입
├── client-app/                # Next.js Frontend (포트 3000)
│   ├── src/app/              # App Router 페이지
│   ├── src/components/       # React 컴포넌트
│   ├── src/lib/              # 유틸리티, API, 상태 관리
│   └── src/hooks/            # 커스텀 훅
├── backend/                   # NestJS Backend (포트 3001)
│   ├── src/modules/          # 기능 모듈 (13개)
│   ├── src/common/           # 공통 기능
│   └── prisma/               # 데이터베이스 스키마
└── docs/                      # 프로젝트 문서
```

### 1.3 주요 기능

- Kakao OAuth 로그인
- 라이브 스트리밍 (RTMP/HLS)
- 실시간 채팅 (WebSocket)
- 상품 관리 및 장바구니
- 주문/결제 시스템
- 예약 시스템
- 관리자 대시보드

---

## 2. Executive Summary

### 2.1 코드 품질 메트릭

| 영역 | 점수 | 상태 |
|------|------|------|
| 타입 안전성 | 5/10 | ⚠️ 개선 필요 |
| 보안 | 4/10 | 🔴 즉시 조치 |
| 성능 | 6/10 | ⚠️ 개선 필요 |
| 아키텍처 | 7/10 | ✅ 양호 |
| 유지보수성 | 6/10 | ⚠️ 개선 필요 |
| 테스트 | 4/10 | ⚠️ 개선 필요 |

### 2.2 발견된 문제 요약

| 심각도 | 개수 | 주요 항목 |
|--------|------|----------|
| 🔴 Critical | 4 | CORS, ValidationPipe, 파일 업로드, JWT |
| 🟠 High | 10 | any 타입, N+1 쿼리, 테스트 커버리지, Rate Limiting |
| 🟡 Medium | 14 | 순환 의존성, Redis Adapter, 로깅, 에러 처리, 타입 공유 |
| 🟢 Low | 6 | 문서화, 코드 스타일 |

### 2.3 우선순위 조정 사항

> **Developer Agent 리뷰 결과 반영**

| 항목 | 기존 | 조정 | 이유 |
|------|------|------|------|
| 테스트 커버리지 | Low | **High** | 4/10 점수는 즉시 개선 필요 |
| Rate Limiting | 미포함 | **High** | DoS 공격 취약점 |
| Redis Adapter | High | **Medium** | 수평 확장 시에만 필요 |
| 순환 의존성 | High | **Medium** | `forwardRef`로 동작 중 |

### 2.4 강점

1. **모듈화된 구조**: 14개 기능 모듈 체계적 구성
2. **이벤트 기반 통신**: EventEmitter로 느슨한 결합
3. **Prisma 트랜잭션**: Serializable 격리 수준 적용
4. **비즈니스 예외 체계**: 커스텀 예외 클래스 구현
5. **응답 일관성**: TransformInterceptor 적용

---

## 3. Critical Issues (즉시 조치)

### 3.1 CORS 모든 출처 허용

**파일**: `backend/src/main.ts:46-52`

```typescript
// 현재 코드 (위험)
app.enableCors({
  origin: true,  // 모든 출처 허용
  credentials: true,
});
```

**위험**:
- CSRF 공격 가능
- 크로스 도메인 데이터 탈취
- 세션 하이재킹

**해결 방안**:
```typescript
const allowedOrigins = [
  'http://localhost:3000',
  'https://your-domain.com',
];

app.enableCors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  maxAge: 86400,
});
```

---

### 3.2 ValidationPipe 비활성화

**파일**: `backend/src/main.ts:29-36`

```typescript
// 현재 코드 (비활성화됨)
// app.useGlobalPipes(
//   new ValidationPipe({
//     whitelist: true,
//     forbidNonWhitelisted: true,
//     transform: true,
//   }),
// );
```

**위험**:
- 모든 DTO 검증 미작동
- 악의적 입력 데이터 처리
- SQL Injection 위험 증가

**해결 방안**:
```bash
# 1. 의존성 재설치
npm install class-validator class-transformer --save

# 2. ValidationPipe 재활성화
```

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```

---

### 3.3 파일 업로드 인증 없음

**파일**: `backend/src/modules/upload/upload.controller.ts:13-15`

```typescript
// 현재 코드 (위험)
@Controller('upload')
export class UploadController {
  @Public()  // 누구나 접근 가능
  @Post('image')
  uploadImage() { }
}
```

**위험**:
- 인증 없이 파일 업로드 가능
- 서버 리소스 남용
- 악성 파일 저장

**해결 방안**:
```typescript
@Controller('upload')
export class UploadController {
  @Post('image')
  @UseGuards(JwtAuthGuard)
  uploadImage(
    @CurrentUser('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // 사용자별 저장 경로 격리
  }
}
```

---

### 3.4 JWT SECRET 약함

**파일**: `backend/.env`

```env
# 현재 설정 (위험)
JWT_SECRET=your-jwt-secret-change-in-production-min-32-chars
```

**위험**:
- 예측 가능한 시크릿
- 토큰 위변조 가능
- 세션 탈취

**해결 방안**:
```bash
# 강력한 랜덤 시크릿 생성
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

```env
# 프로덕션용 .env
JWT_SECRET=<64자 이상의 랜덤 문자열>
```

---

## 4. Backend 코드 품질

### 4.1 에러 핸들링

#### 강점
- `BusinessException` 기반 커스텀 예외 체계
- `BusinessExceptionFilter`로 일관된 에러 응답
- 환경별 스택 트레이스 노출 제어

#### 문제점

**1. 불완전한 예외 처리**

파일: `backend/src/modules/auth/auth.controller.ts:121-124`
```typescript
catch (error) {
  this.logger.error('Kakao callback error:', error.stack);
  return res.redirect(`${this.frontendUrl}/login?error=auth_failed`);
  // 문제: 에러 타입 검증 없음
}
```

**2. console.log vs Logger 혼용**

```typescript
// main.ts - console.log 사용
console.log('>>> Bootstrap starting...');

// products.service.ts - Logger 사용
this.logger.log(`Product created: ${product.id}`);
```

#### 개선 제안
```typescript
// 일관된 에러 핸들링 유틸리티
export class ErrorHandler {
  static handle(logger: Logger, message: string, error: unknown): never {
    logger.error(message, error instanceof Error ? error.stack : String(error));
    throw new InternalServerErrorException(message);
  }
}
```

---

### 4.2 입력 검증

#### 현황
- DTO에 117개의 class-validator 데코레이터 정의
- **ValidationPipe 비활성화로 모든 검증 미작동**

#### DTO 예시
```typescript
// backend/src/modules/orders/dto/order.dto.ts
class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}
```

#### 문제점
- ValidationPipe 비활성화
- 일부 DTO에 검증 데코레이터 누락
- 중첩 객체 검증 불완전

---

### 4.3 데이터베이스 접근

#### 강점
- Prisma 트랜잭션 적절히 사용 (6개 파일)
- Serializable 격리 수준 적용

```typescript
// backend/src/modules/orders/inventory.service.ts:22-59
await this.prisma.$transaction(
  async (tx) => {
    // 재고 차감 로직
  },
  {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 3000,
  },
);
```

#### N+1 쿼리 문제

**문제 위치**: `backend/src/modules/cart/cart.service.ts:48`
```typescript
async addToCart(userId: string, addToCartDto: AddToCartDto) {
  const product = await this.prisma.product.findUnique({ ... });
  const reservedQuantity = await this.getReservedQuantity(productId); // N+1
  // ...
  if (existingCartItem) {
    const reservedQuantity = await this.getReservedQuantityInTransaction(...); // N+1 반복
  }
}
```

**해결 제안**:
```typescript
// 단일 쿼리로 모든 정보 조회
const [product, reservedQuantity, existingCartItem] = await Promise.all([
  this.prisma.product.findUnique({ where: { id: productId } }),
  this.prisma.cart.aggregate({
    where: { productId, status: 'ACTIVE' },
    _sum: { quantity: true },
  }),
  this.prisma.cart.findFirst({
    where: { userId, productId, status: 'ACTIVE' },
  }),
]);
```

---

### 4.4 타입 안전성

#### `any` 타입 사용 현황: 202개

**주요 위치**:
| 파일 | 라인 | 사용 예 |
|------|------|---------|
| admin.service.ts | 55, 154 | `const where: any = {}` |
| cart.service.ts | 310, 354 | `tx: any`, `cartItem: any` |
| auth.controller.ts | 104, 177 | `req.user as any` |
| products.service.ts | 133 | `status as any` |

**개선 제안**:
```typescript
// 변경 전
private mapToResponseDto(cartItem: any): CartItemResponseDto

// 변경 후
import { Cart } from '@prisma/client';

interface CartModel extends Cart {
  price: Decimal;
  shippingFee: Decimal;
}

private mapToResponseDto(cartItem: CartModel): CartItemResponseDto
```

---

### 4.5 비즈니스 로직 중복

**문제 위치**: `backend/src/modules/orders/orders.service.ts`

```typescript
// 메서드 1: 장바구니에서 주문 생성 (라인 37-100)
async createOrderFromCart(userId: string) {
  let subtotal = 0;
  let totalShippingFee = 0;
  // 계산 로직...
}

// 메서드 2: DTO에서 직접 주문 생성 (라인 159-260)
async createOrder(userId: string, createOrderDto: CreateOrderDto) {
  let subtotal = 0;
  let totalShippingFee = 0;
  // 동일한 계산 로직 반복...
}
```

**해결 제안**:
```typescript
// 공통 로직 추출
private calculateOrderTotals(
  items: Array<{ price: Decimal; shippingFee: Decimal; quantity: number }>
): { subtotal: number; totalShippingFee: number; total: number } {
  let subtotal = 0;
  let totalShippingFee = 0;

  items.forEach((item) => {
    subtotal += Number(item.price) * item.quantity;
    totalShippingFee += Number(item.shippingFee);
  });

  return { subtotal, totalShippingFee, total: subtotal + totalShippingFee };
}
```

---

## 5. Frontend 코드 품질

### 5.1 컴포넌트 구조

#### 문제점

**1. 컴포넌트 크기 초과**

| 컴포넌트 | 라인 수 | 책임 |
|----------|---------|------|
| ProductDetailModal.tsx | ~200줄 | UI + 상태 + WebSocket + API |
| ProductList.tsx | ~190줄 | UI + 상태 + WebSocket |

**2. 타입 정의 분산**

```typescript
// ProductDetailModal.tsx 내부에 정의
interface Product {
  id: string;
  streamKey: string;
  // ...
}

// ProductList.tsx 내부에 동일하게 정의
interface Product {
  id: string;
  streamKey: string;
  // ...
}
```

**해결 제안**:
```typescript
// lib/types/product.ts (공유 타입)
export interface Product {
  id: string;
  streamKey: string;
  name: string;
  price: number;
  // ...
}

// 컴포넌트에서 임포트
import type { Product } from '@/lib/types/product';
```

---

### 5.2 상태 관리

#### 현황
- Zustand: auth store
- React Context: cart context
- React Query: 설정만 존재, 미사용

#### React Query 미활용 문제

**현재**: 모든 API 호출이 직접 async/await
```typescript
// 현재 방식
const [products, setProducts] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchProducts = async () => {
    setLoading(true);
    const data = await getProducts();
    setProducts(data);
    setLoading(false);
  };
  fetchProducts();
}, []);
```

**개선 제안**:
```typescript
// React Query 활용
export function useProducts(status?: string) {
  return useQuery({
    queryKey: ['products', status],
    queryFn: () => getProducts(status),
    staleTime: 60 * 1000,
  });
}

// 컴포넌트에서 사용
function ProductList() {
  const { data: products, isLoading, error } = useProducts();
}
```

---

### 5.3 API 통신

#### 응답 구조 불일치

**파일**: `client-app/src/lib/api/products.ts:26-31`
```typescript
export async function getFeaturedProducts(limit: number = 6): Promise<Product[]> {
  const response = await apiClient.get<any>(`/products/featured?limit=${limit}`);
  return response.data.data || response.data; // 불명확한 처리
}
```

**해결 제안**:
```typescript
// API 클라이언트에서 응답 정규화
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const result = await response.json();

  // 응답 구조 정규화
  if (result?.data?.data) {
    return result.data.data;
  }
  if (result?.data) {
    return result.data;
  }
  return result;
}
```

---

### 5.4 훅 사용

#### 의존성 배열 문제

**파일**: `client-app/src/lib/hooks/use-auth.ts:13`
```typescript
useEffect(() => {
  if (isLoading && !user) {
    fetchProfile();
  }
}, []); // 의존성 배열 누락
```

**해결**:
```typescript
useEffect(() => {
  if (isLoading && !user) {
    fetchProfile();
  }
}, [isLoading, user, fetchProfile]);
```

---

### 5.5 `any` 타입 사용

**파일**: `client-app/src/lib/hooks/use-chat.ts`
```typescript
// 라인 74, 89, 96
socket.on('connection:success', (data: any) => { ... });
socket.on('error', (data: any) => { ... });
socket.on('chat:message', (data: any) => { ... });
```

**해결 제안**:
```typescript
interface ConnectionSuccessEvent {
  type: string;
  message: string;
}

interface ChatMessageEvent {
  type: 'chat:message';
  data: ChatMessage;
}

socket.on('connection:success', (data: ConnectionSuccessEvent) => { ... });
socket.on('chat:message', (data: ChatMessageEvent) => { ... });
```

---

## 6. 보안 취약점

### 6.1 인증/인가

| 취약점 | 심각도 | 파일 |
|--------|--------|------|
| CORS 모든 출처 허용 | 🔴 Critical | main.ts:46 |
| 파일 업로드 인증 없음 | 🔴 Critical | upload.controller.ts:13 |
| JWT SECRET 약함 | 🔴 Critical | .env |
| WebSocket JWT 검증 불일치 | 🟠 High | ws-jwt-auth.middleware.ts |

### 6.2 입력 검증

| 취약점 | 심각도 | 파일 |
|--------|--------|------|
| ValidationPipe 비활성화 | 🔴 Critical | main.ts:29 |
| 파일 매직 바이트 검증 없음 | 🟠 High | upload.controller.ts |
| 채팅 메시지 이스케이프 없음 | 🟡 Medium | chat.gateway.ts |

### 6.3 데이터 노출

| 취약점 | 심각도 | 파일 |
|--------|--------|------|
| 사용자 이메일 로깅 | 🟡 Medium | auth.service.ts:61 |
| 에러 컨텍스트 노출 | 🟡 Medium | business.exception.ts |
| 개발 모드 콘솔 로그 | 🟡 Medium | chat.gateway.ts |

### 6.4 환경 설정

| 취약점 | 심각도 | 파일 |
|--------|--------|------|
| .env 파일 커밋 가능성 | 🟠 High | backend/.env |
| 환경 변수 검증 없음 | 🟡 Medium | app.module.ts |
| 프로덕션 설정 미분리 | 🟡 Medium | - |

---

## 7. 아키텍처 분석

### 7.1 모듈 구조

```
AppModule (root)
├── Core Modules
│   ├── ConfigModule (전역)
│   ├── EventEmitterModule (전역)
│   ├── ScheduleModule
│   └── LoggerModule
│
├── Infrastructure Modules
│   ├── PrismaModule (전역)
│   ├── RedisModule (전역)
│   └── UploadModule
│
└── Feature Modules (13개)
    ├── AuthModule
    ├── UsersModule
    ├── ProductsModule
    ├── CartModule
    ├── OrdersModule
    ├── ReservationModule
    ├── StreamingModule
    ├── WebsocketModule
    ├── ChatModule
    ├── NotificationsModule
    ├── AdminModule ⟲ (순환 의존성)
    ├── SettlementModule
    └── NoticesModule
```

### 7.2 순환 의존성

**문제**: `AdminModule ↔ WebsocketModule`

**파일**: `backend/src/modules/admin/admin.module.ts`
```typescript
@Module({
  imports: [forwardRef(() => WebsocketModule), NotificationsModule],
  providers: [
    AdminService,
    {
      provide: 'WEBSOCKET_GATEWAY',
      useFactory: (gateway: WebsocketGateway) => gateway,
      inject: [WebsocketGateway],
    },
  ],
})
```

**해결 제안**: Event-Driven 패턴으로 전환
```typescript
// AdminService에서 이벤트 발행
this.eventEmitter.emit('admin:notification', payload);

// WebsocketModule의 리스너가 수신
@OnEvent('admin:notification')
handleAdminNotification(payload) {
  this.websocketGateway.broadcast(payload);
}
```

### 7.3 이벤트 시스템

#### 정의된 이벤트 (27개 `@OnEvent` 사용)

```
Order Events:
- order:created, order:paid, order:shipped, order:cancelled

Product Events:
- product:created, product:updated, product:deleted
- product:stock:updated, product:soldout

Cart Events:
- cart:added, cart:expired

Reservation Events:
- reservation:promoted
```

#### 문제점
- 이벤트명 불일치: `order.created` vs `order:created`
- 이벤트 스키마 검증 부재
- 에러 처리 전략 미흡

### 7.4 WebSocket 아키텍처

#### Gateway 구조
| Gateway | Namespace | 용도 |
|---------|-----------|------|
| WebsocketGateway | `/` | 스트림, 알림 |
| ChatGateway | `/chat` | 채팅 |

#### Redis Adapter 비활성화

**파일**: `backend/src/main.ts:56-61`
```typescript
// TODO: Fix Redis adapter connection hanging issue
// const redisIoAdapter = new RedisIoAdapter(app);
// await redisIoAdapter.connectToRedis();
// app.useWebSocketAdapter(redisIoAdapter);
```

**영향**:
- 수평 확장 불가
- 다중 서버 환경에서 메시지 손실

### 7.5 공유 타입 (shared-types)

#### 구조
```
packages/shared-types/src/
├── index.ts    # 주요 타입 (14,600줄)
└── events.ts   # WebSocket 이벤트 (76줄)
```

#### 활용 현황
| 영역 | 상태 |
|------|------|
| Backend | 부분 사용 |
| Frontend | 미사용 |

---

## 8. 추가 중요 항목

> **Developer Agent 리뷰에서 식별된 누락 항목**

### 8.1 보안 강화 (누락 항목)

#### 8.1.1 Rate Limiting

**위험**: DoS 공격 취약

**해결 방안**:
```bash
npm install @nestjs/throttler
```

```typescript
// app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,    // 1초
        limit: 3,     // 3회
      },
      {
        name: 'long',
        ttl: 60000,   // 1분
        limit: 100,   // 100회
      },
    ]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
```

```typescript
// auth.controller.ts - 로그인 엔드포인트 특별 제한
@Throttle({ short: { limit: 5, ttl: 60000 } }) // 1분에 5회
@Post('kakao-callback')
async kakaoCallback() { }
```

#### 8.1.2 CSRF 보호

**위험**: 상태 변경 공격

**해결 방안**:
```bash
npm install csurf
```

```typescript
// main.ts
import * as csurf from 'csurf';

// Cookie 기반 CSRF 토큰
app.use(csurf({ cookie: true }));
```

#### 8.1.3 보안 헤더 (Helmet)

**위험**: XSS, Clickjacking 등

**해결 방안**:
```bash
npm install helmet
```

```typescript
// main.ts
import helmet from 'helmet';

app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
  },
}));
```

#### 8.1.4 Prisma Raw Query 감사

**위험**: SQL Injection

**점검 대상**: `$queryRaw`, `$executeRaw` 사용처

```typescript
// 위험한 패턴
const result = await prisma.$queryRaw`SELECT * FROM users WHERE id = ${userId}`;

// 안전한 패턴 (Prisma.sql 사용)
import { Prisma } from '@prisma/client';
const result = await prisma.$queryRaw(
  Prisma.sql`SELECT * FROM users WHERE id = ${userId}`
);
```

---

### 8.2 성능 최적화 (누락 항목)

#### 8.2.1 데이터베이스 인덱싱

**영향**: 쿼리 성능 저하

**권장 인덱스**:
```prisma
// prisma/schema.prisma

model Cart {
  // ... fields

  @@index([userId, status])           // 사용자별 활성 카트 조회
  @@index([productId, status])        // 상품별 예약 수량 조회
  @@index([expiresAt])                // 만료 카트 정리
}

model Product {
  // ... fields

  @@index([streamKey])                // 스트림별 상품 조회
  @@index([status])                   // 상태별 필터링
  @@index([createdAt])                // 최신순 정렬
}

model Order {
  // ... fields

  @@index([userId, createdAt])        // 사용자별 주문 이력
  @@index([status])                   // 상태별 필터링
  @@index([paymentStatus])            // 결제 상태별 조회
}

model LiveStream {
  // ... fields

  @@index([status])                   // 상태별 필터링
  @@index([userId])                   // 셀러별 방송 조회
}
```

#### 8.2.2 Prisma 연결 풀링

**영향**: DB 연결 고갈

**해결 방안**:
```env
# .env
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=30"
```

```typescript
// prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });
  }
}
```

#### 8.2.3 응답 압축

**영향**: 대역폭 낭비

**해결 방안**:
```bash
npm install compression
```

```typescript
// main.ts
import * as compression from 'compression';

app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,  // 압축 레벨 (1-9)
}));
```

---

### 8.3 운영 안정성 (누락 항목)

#### 8.3.1 Health Check 엔드포인트

**영향**: 모니터링 사각지대

**해결 방안**:
```bash
npm install @nestjs/terminus
```

```typescript
// health/health.module.ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
```

```typescript
// health/health.controller.ts
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaHealthIndicator,
    private redis: RedisHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prisma.isHealthy('database'),
      () => this.redis.isHealthy('redis'),
    ]);
  }

  @Get('ready')
  @Public()
  readiness() {
    return { status: 'ready', timestamp: new Date().toISOString() };
  }

  @Get('live')
  @Public()
  liveness() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }
}
```

**응답 예시**:
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  },
  "details": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

#### 8.3.2 구조화된 로깅

**영향**: 로그 분석 어려움

**해결 방안**:
```typescript
// common/logger/logger.config.ts
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

export const winstonConfig = WinstonModule.forRoot({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),  // JSON 포맷
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  ],
});
```

**로그 출력 예시**:
```json
{
  "timestamp": "2026-02-03T10:30:00.000Z",
  "level": "info",
  "context": "OrdersService",
  "message": "Order created",
  "orderId": "ORD-20260203-00001",
  "userId": "user-123",
  "total": 50000
}
```

#### 8.3.3 에러 트래킹 (Sentry)

**영향**: 장애 대응 지연

**해결 방안**:
```bash
npm install @sentry/nestjs @sentry/profiling-node
```

```typescript
// main.ts
import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

// app.module.ts
import { SentryModule } from '@sentry/nestjs/setup';

@Module({
  imports: [
    SentryModule.forRoot(),
    // ... other modules
  ],
})
```

---

### 8.4 코드 품질 도구 (누락 항목)

#### 8.4.1 ESLint Strict 규칙

**파일**: `backend/.eslintrc.js`

```javascript
module.exports = {
  extends: [
    'plugin:@typescript-eslint/strict',
    'plugin:@typescript-eslint/stylistic',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/strict-boolean-expressions': 'warn',
  },
};
```

#### 8.4.2 Pre-commit Hooks

**해결 방안**:
```bash
npm install -D husky lint-staged
npx husky init
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
npm run lint-staged
npm run type-check
```

#### 8.4.3 API 버전관리

**해결 방안**:
```typescript
// main.ts
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
  prefix: 'api/v',
});

// 컨트롤러에서 버전 지정
@Controller({ path: 'orders', version: '1' })
export class OrdersController { }

// 결과: /api/v1/orders
```

---

## 9. 개선 로드맵

> **Developer Agent 리뷰 결과 반영하여 조정됨**

### Phase 1: 즉시 조치 (Week 1)

| 항목 | 난이도 | 예상 시간 | 비고 |
|------|--------|----------|------|
| CORS 화이트리스트 설정 | 낮음 | 30분 | Critical |
| ValidationPipe 재활성화 | 중간 | 2시간 | Critical |
| 파일 업로드 인증 추가 | 낮음 | 1시간 | Critical |
| JWT_SECRET 강화 | 낮음 | 30분 | Critical |
| **Rate Limiting 추가** | 낮음 | 2시간 | **신규** |
| **Health Check 추가** | 낮음 | 2시간 | **신규** |

### Phase 2: 단기 개선 (Week 2-3)

| 항목 | 난이도 | 예상 시간 | 비고 |
|------|--------|----------|------|
| any 타입 제거 (핵심 서비스) | 중간 | 8시간 | High |
| N+1 쿼리 최적화 | 중간 | 4시간 | High |
| **테스트 커버리지 개선** | 높음 | 12시간 | **Low→High 상향** |
| **DB 인덱스 추가** | 낮음 | 2시간 | **신규** |
| **보안 헤더 (helmet)** | 낮음 | 1시간 | **Low→High 상향** |
| 이벤트명 표준화 | 낮음 | 4시간 | Medium |

### Phase 3: 중기 개선 (Week 4-6)

| 항목 | 난이도 | 예상 시간 | 비고 |
|------|--------|----------|------|
| Redis Adapter 활성화 | 중간 | 4시간 | **High→Medium 하향** |
| 순환 의존성 제거 | 중간 | 8시간 | **High→Medium 하향** |
| React Query 적용 | 중간 | 8시간 | Medium |
| 컴포넌트 분리 | 중간 | 6시간 | Medium |
| 설정 검증 (Joi) 추가 | 중간 | 4시간 | Medium |
| **CSRF 보호 추가** | 낮음 | 2시간 | **신규** |
| **응답 압축 설정** | 낮음 | 1시간 | **신규** |
| **Prisma 연결 풀링** | 낮음 | 1시간 | **신규** |

### Phase 4: 장기 개선 (Month 2-3)

| 항목 | 난이도 | 예상 시간 | 비고 |
|------|--------|----------|------|
| 통합 테스트 작성 | 높음 | 16시간 | Low |
| E2E 테스트 확대 | 높음 | 16시간 | Low |
| 성능 모니터링 | 중간 | 8시간 | Low |
| 문서화 개선 | 중간 | 8시간 | Low |
| **Sentry 에러 트래킹** | 중간 | 4시간 | **신규** |
| **Pre-commit hooks** | 낮음 | 2시간 | **신규** |
| **API 버전관리** | 중간 | 4시간 | **신규** |
| **ESLint strict 규칙** | 낮음 | 2시간 | **신규** |

### 총 예상 소요 시간

| Phase | 예상 시간 | 기간 |
|-------|----------|------|
| Phase 1 | ~8시간 | Week 1 |
| Phase 2 | ~31시간 | Week 2-3 |
| Phase 3 | ~34시간 | Week 4-6 |
| Phase 4 | ~60시간 | Month 2-3 |
| **합계** | **~133시간** | **~3개월** |

---

## 10. 체크리스트

### Critical (즉시)

- [x] CORS 화이트리스트 설정 ✅ 2026-02-03
- [x] ValidationPipe 재활성화 ✅ 2026-02-03
- [x] 파일 업로드 인증 추가 ✅ 2026-02-03
- [x] JWT_SECRET 강화 ✅ 2026-02-03

### High (1-2주) - 조정됨

- [x] **Rate Limiting 추가** (신규) ✅ 2026-02-03
- [ ] **테스트 커버리지 개선** (Low → High 상향)
- [ ] any 타입 제거 (admin.service.ts)
- [x] any 타입 제거 (cart.service.ts) ✅ 2026-02-03
- [ ] any 타입 제거 (auth.controller.ts)
- [x] N+1 쿼리 최적화 (CartService) ✅ 2026-02-03
- [ ] N+1 쿼리 최적화 (ProductsService)
- [x] 비즈니스 로직 중복 제거 ✅ 2026-02-03
- [x] **Health Check 엔드포인트 추가** (신규) ✅ 2026-02-03
- [x] **DB 인덱스 추가** (신규) ✅ 2026-02-03

### Medium (2-4주) - 조정됨

- [ ] Redis Adapter 활성화 (High → Medium 하향)
- [ ] 순환 의존성 제거 (High → Medium 하향)
- [ ] 이벤트명 표준화
- [ ] 설정 검증 (Joi) 추가
- [ ] shared-types Backend 적용
- [ ] shared-types Frontend 적용
- [ ] React Query 적용
- [ ] 컴포넌트 크기 축소
- [ ] useEffect 의존성 수정
- [ ] 에러 핸들링 일관성 개선
- [ ] 로깅 일관성 개선
- [ ] 민감 정보 로깅 제거
- [ ] **보안 헤더 추가 (helmet)** (Low → Medium 상향)
- [ ] **CSRF 보호 추가** (신규)
- [ ] **응답 압축 설정** (신규)
- [ ] **Prisma 연결 풀링 설정** (신규)

### Low (1개월+)

- [ ] 통합 테스트 작성
- [ ] E2E 테스트 확대
- [ ] 성능 모니터링 구성
- [ ] API 문서화 개선
- [ ] 환경별 설정 파일 분리
- [ ] **Sentry 에러 트래킹 연동** (신규)
- [ ] **Pre-commit hooks 설정** (신규)
- [ ] **API 버전관리 적용** (신규)
- [ ] **ESLint strict 규칙 적용** (신규)

---

## 부록

### A. 주요 파일 위치

| 항목 | 경로 |
|------|------|
| Backend 진입점 | `backend/src/main.ts` |
| App Module | `backend/src/app.module.ts` |
| 예외 필터 | `backend/src/common/filters/business-exception.filter.ts` |
| Prisma 스키마 | `backend/prisma/schema.prisma` |
| Frontend 진입점 | `client-app/src/app/layout.tsx` |
| API 클라이언트 | `client-app/src/lib/api/client.ts` |
| Auth Store | `client-app/src/lib/store/auth.ts` |
| 공유 타입 | `packages/shared-types/src/index.ts` |

### B. 참고 문서

- NestJS 공식 문서: https://docs.nestjs.com
- Next.js 공식 문서: https://nextjs.org/docs
- Prisma 공식 문서: https://www.prisma.io/docs
- Socket.IO 공식 문서: https://socket.io/docs

---

**문서 작성**: Claude Code Review
**리뷰 검토**: Developer Agent (Amelia)
**최종 수정**: 2026-02-03
**변경 이력**:
- 2026-02-03: 초안 작성
- 2026-02-03: Developer Agent 리뷰 반영 (우선순위 조정, 누락 항목 추가)
