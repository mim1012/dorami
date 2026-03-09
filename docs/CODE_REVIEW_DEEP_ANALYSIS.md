# Doremi 심층 코드 리뷰 보고서

**분석 일시**: 2026-02-03
**분석 유형**: 심층 분석 (보안/성능/비즈니스 로직)
**이전 리뷰**: CODE_REVIEW_REPORT_v2.md 참조

---

## 1. 새로 발견된 Critical/High 이슈

### 1.1 WebSocket CORS `origin: '*'` (Critical)

**위치**: `backend/src/modules/websocket/websocket.gateway.ts:18-23`

```typescript
@WebSocketGateway({
  cors: {
    origin: '*',  // 🔴 모든 출처 허용
    credentials: true,
  },
  namespace: '/',
})
```

**문제**: HTTP CORS는 화이트리스트 기반이나, WebSocket은 모든 출처 허용
**영향**: Cross-site WebSocket hijacking 가능
**비교**: `chat.gateway.ts`는 올바르게 설정됨

**수정 방안**:

```typescript
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
  namespace: '/',
})
```

---

### 1.2 JWT Refresh Token Rotation 미구현 (High)

**위치**: `backend/src/modules/auth/auth.service.ts:118-144`

```typescript
async refreshToken(refreshToken: string): Promise<LoginResponseDto> {
  // Redis에서 기존 토큰 검증
  const storedToken = await this.redisService.get(`refresh_token:${payload.sub}`);

  if (storedToken !== refreshToken) {
    throw new UnauthorizedException('Invalid refresh token');
  }

  // 새 토큰 발급 - 기존 토큰은 그대로 유지됨!
  return this.login(user);  // ← 문제: 이전 토큰 삭제 안 함
}
```

**문제**: 토큰 갱신 시 이전 토큰이 Redis에 남아있어 공격자가 탈취한 토큰 계속 사용 가능

**수정 방안**:

```typescript
async refreshToken(refreshToken: string): Promise<LoginResponseDto> {
  // ... 검증 로직 ...

  // 기존 토큰 삭제 (Token Rotation)
  await this.redisService.del(`refresh_token:${payload.sub}`);

  // 새 토큰 발급
  return this.login(user);
}
```

---

### 1.3 WebSocket JWT 검증 방식 불일치 (High)

**위치**: `backend/src/common/middleware/ws-jwt-auth.middleware.ts:23-26`

```typescript
const payload = await jwtService.verifyAsync(token, {
  secret: process.env.JWT_SECRET, // 환경변수 직접 접근
});
```

**문제**: HTTP 요청과 다른 방식으로 JWT 검증

- HTTP: `JwtModule.register()`의 설정 사용
- WebSocket: `process.env` 직접 접근

**수정 방안**:

```typescript
constructor(
  private jwtService: JwtService,
  private configService: ConfigService,
) {}

const payload = await this.jwtService.verifyAsync(token, {
  secret: this.configService.get('JWT_SECRET'),
});
```

---

## 2. 보안 심층 분석

### 2.1 인증 플로우 검토 결과

| 항목              | 상태 | 비고             |
| ----------------- | ---- | ---------------- |
| Kakao OAuth       | ✅   | 구현 완료        |
| JWT Access Token  | ✅   | HTTP-only 쿠키   |
| JWT Refresh Token | ⚠️   | Rotation 미구현  |
| Token Blacklist   | ✅   | Redis 사용       |
| WebSocket 인증    | ⚠️   | 검증 방식 불일치 |

### 2.2 CORS 설정 현황

| Gateway          | origin 설정  | 상태 |
| ---------------- | ------------ | ---- |
| HTTP (main.ts)   | 화이트리스트 | ✅   |
| WebSocketGateway | `'*'`        | 🔴   |
| ChatGateway      | 화이트리스트 | ✅   |

### 2.3 OAuth 콜백 응답 방식

**위치**: `backend/src/modules/auth/auth.controller.ts:107-130`

**현재**: 리다이렉트 방식

```typescript
return res.redirect(redirectUrl);
```

**문제**: SPA에서 리다이렉트 처리 어려움

**권장**: JSON 응답 방식

```typescript
return res.json({
  success: true,
  data: { user, needsProfileCompletion },
});
```

---

## 3. 데이터베이스 심층 분석

### 3.1 인덱스 현황 (양호)

```prisma
model Cart {
  @@index([userId, status])
  @@index([productId, status])
  @@index([expiresAt])
  @@index([status, timerEnabled, expiresAt])
}

model Product {
  @@index([streamKey])
  @@index([status])
  @@index([status, createdAt])
}

model Order {
  @@index([userId, status])
  @@index([status])
}
```

**평가**: 대부분의 쿼리 패턴에 적절한 인덱스 설정됨 ✅

### 3.2 트랜잭션 사용 패턴 (양호)

**InventoryService** - Serializable 격리 수준 사용

```typescript
await this.prisma.$transaction(
  async (tx) => {
    /* ... */
  },
  {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 3000,
  },
);
```

**평가**: 재고 관리에 적절한 동시성 제어 ✅

### 3.3 암호화 필드 타입 문제 (Medium)

**위치**: `backend/prisma/schema.prisma:24`

```prisma
model User {
  shippingAddress     Json?   // 🟠 문제: 암호화 데이터는 String이어야 함
}
```

**권장**:

```prisma
model User {
  shippingAddress     String?   @db.Text
}
```

---

## 4. 실시간 기능 심층 분석

### 4.1 WebSocket 메모리 관리

**위치**: `backend/src/modules/websocket/websocket.gateway.ts:51-88`

**현재 구현**:

```typescript
handleDisconnect(client: Socket) {
  const rooms = Array.from(client.rooms).filter((room) => room !== client.id);
  rooms.forEach((room) => client.leave(room));
  // client.data 정리 없음
}
```

**문제**: `client.data.userId`, `client.data.role` 메모리에 유지

**수정 방안**:

```typescript
handleDisconnect(client: Socket) {
  // 데이터 정리
  delete client.data.userId;
  delete client.data.role;

  // 기존 로직
  const rooms = Array.from(client.rooms).filter((room) => room !== client.id);
  rooms.forEach((room) => client.leave(room));
}
```

### 4.2 Redis Adapter 설정 (양호)

```typescript
// main.ts:129-140
if (process.env.REDIS_ADAPTER_ENABLED !== 'false') {
  const connected = await redisIoAdapter.connectToRedis();
  if (connected) {
    app.useWebSocketAdapter(redisIoAdapter);
  } else {
    logger.warn('Redis adapter disabled - running in single-server mode');
  }
}
```

**평가**: 적절한 fallback 처리 ✅

### 4.3 이벤트 시스템 설정 (양호)

```typescript
EventEmitterModule.forRoot({
  maxListeners: 10,
  verboseMemoryLeak: true,
  ignoreErrors: false,
}),
```

**평가**: 메모리 누수 감지 설정 ✅

---

## 5. 비즈니스 로직 심층 분석

### 5.1 재고 관리 (양호)

**InventoryService** 분석:

- ✅ Serializable 격리 수준
- ✅ 3초 타임아웃
- ✅ 예외 처리

**개선 제안**: 상태 변경 로직 추상화

```typescript
private determineProductStatus(newQuantity: number, currentStatus: string) {
  if (newQuantity === 0) return 'SOLD_OUT';
  if (newQuantity > 0 && currentStatus === 'SOLD_OUT') return 'AVAILABLE';
  return currentStatus;
}
```

### 5.2 주문 플로우 (개선됨)

**이전 문제**: 중복 계산 로직
**현재 상태**: `calculateOrderTotals()` 함수로 통합됨 ✅

### 5.3 장바구니 최적화 (양호)

```typescript
const [product, reservedResult, existingCartItem] = await Promise.all([
  this.prisma.product.findUnique({ ... }),
  this.prisma.cart.aggregate({ ... }),
  this.prisma.cart.findFirst({ ... }),
]);
```

**평가**: Promise.all로 N+1 방지 ✅

---

## 6. 프론트엔드 심층 분석

### 6.1 CSRF 토큰 자동 갱신 부재 (Medium)

**위치**: `client-app/src/lib/api/client.ts:10-46`

```typescript
function getCsrfToken(): string | null {
  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match ? match[1] : null;
}

// 토큰 없으면 에러 발생 - 갱신 로직 없음
```

**수정 방안**:

```typescript
async function ensureCsrfToken(): Promise<string> {
  let token = getCsrfToken();
  if (!token) {
    // CSRF 토큰 갱신 요청
    await api.get('/api/csrf-token');
    token = getCsrfToken();
  }
  return token || '';
}
```

### 6.2 useEffect 의존성 (양호)

**VideoPlayer.tsx** 분석:

- ✅ 모바일 감지 의존성 올바름
- ✅ 방향 전환 의존성 올바름
- ✅ 플레이어 초기화 의존성 올바름

### 6.3 상태 관리 (양호)

- Zustand 사용으로 단순하고 효율적
- React Query로 서버 상태 관리

---

## 7. 개선 현황 요약

### 이전 리뷰 대비 개선된 항목

| 항목           | 이전      | 현재            |
| -------------- | --------- | --------------- |
| HTTP CORS      | `'*'`     | 화이트리스트 ✅ |
| ValidationPipe | 미흡      | 강화됨 ✅       |
| Rate Limiting  | 없음      | 구현됨 ✅       |
| CSRF 보호      | 없음      | 구현됨 ✅       |
| N+1 쿼리       | 일부 문제 | 대부분 해결 ✅  |
| 중복 코드      | 있음      | 리팩토링됨 ✅   |

### 새로 발견된 문제

| 심각도   | 항목                       | 파일                         |
| -------- | -------------------------- | ---------------------------- |
| Critical | WebSocket CORS `'*'`       | websocket.gateway.ts:20      |
| High     | JWT Refresh Token Rotation | auth.service.ts:141          |
| High     | WebSocket JWT 검증 불일치  | ws-jwt-auth.middleware.ts:24 |
| Medium   | 암호화 필드 타입           | schema.prisma:24             |
| Medium   | 클라이언트 메모리 정리     | websocket.gateway.ts:80      |
| Medium   | CSRF 토큰 자동 갱신        | client.ts                    |

---

## 8. 즉시 조치 필요 항목

### Priority 1 (이번 주)

| #   | 작업                       | 파일                      | 예상 시간 |
| --- | -------------------------- | ------------------------- | --------- |
| 1   | WebSocket CORS 수정        | websocket.gateway.ts      | 30분      |
| 2   | JWT Refresh Token Rotation | auth.service.ts           | 1시간     |
| 3   | WebSocket JWT 검증 통일    | ws-jwt-auth.middleware.ts | 30분      |

### Priority 2 (2주 내)

| #   | 작업                   | 파일                 | 예상 시간 |
| --- | ---------------------- | -------------------- | --------- |
| 4   | 암호화 필드 타입 수정  | schema.prisma        | 1시간     |
| 5   | 클라이언트 메모리 정리 | websocket.gateway.ts | 30분      |
| 6   | CSRF 토큰 자동 갱신    | client.ts            | 1시간     |

---

## 9. 품질 점수 업데이트

| 카테고리    | 초기     | v1 리뷰 후 | 현재                |
| ----------- | -------- | ---------- | ------------------- |
| 보안        | 4/10     | 6/10       | 6/10 (새 이슈 발견) |
| 성능        | 6/10     | 7/10       | 7/10                |
| 아키텍처    | 7/10     | 7/10       | 7/10                |
| 타입 안전성 | 5/10     | 6/10       | 6/10                |
| 테스트      | 4/10     | 5/10       | 5/10                |
| **전체**    | **6/10** | **6.5/10** | **6.5/10**          |

---

## 10. 결론

### 강점

1. ✅ NestJS 아키텍처 견고함
2. ✅ Prisma 인덱스 최적화 양호
3. ✅ 재고 관리 동시성 처리 양호
4. ✅ Promise.all로 N+1 방지
5. ✅ 이벤트 시스템 메모리 관리

### 즉시 수정 필요

1. 🔴 WebSocket CORS 설정
2. 🔴 JWT Refresh Token Rotation
3. 🔴 WebSocket JWT 검증 통일

### 권장 목표 (3개월)

| 메트릭          | 현재   | 목표 |
| --------------- | ------ | ---- |
| 보안 점수       | 6/10   | 8/10 |
| 테스트 커버리지 | 47%    | 70%  |
| any 타입        | 36개   | 0개  |
| 전체 품질       | 6.5/10 | 8/10 |

---

_심층 분석 완료: 2026-02-03_
_다음 리뷰: 2주 후 Priority 1 항목 수정 확인_
