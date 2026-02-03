# Dorami 라이브 커머스 - 코드 리뷰 보고서 v3

**분석 일시**: 2026-02-03
**분석 방법**: 자동화 스캔 + 수동 검증
**분석 범위**: Backend (110 파일) + Frontend (128 파일)

---

## 1. 실행 요약

### 전체 품질 스코어: 5.5/10 (개선 필요)

| 카테고리 | 점수 | 상태 | 근거 |
|---------|------|------|------|
| 코드 품질 | 4/10 | 🔴 | any 타입 189개, console.log 17개 |
| 보안 | 4/10 | 🔴 | Rate Limiting 미구현, WebSocket CORS *, npm 취약점 |
| 성능 | 6/10 | ⚠️ | Promise.all 사용 양호, 캐싱 미구현 |
| 아키텍처 | 7/10 | ✅ | NestJS 모듈 구조 양호 |
| 에러 처리 | 5/10 | ⚠️ | 패턴 존재하나 일관성 부족 |
| 테스트 | 3/10 | 🔴 | 7개 spec 파일, Controller 테스트 0% |
| 의존성 보안 | 4/10 | 🔴 | High 1개, Moderate 5개 취약점 |

---

## 2. Critical 이슈 (즉시 수정 필요)

### 2.1 Rate Limiting 미구현

**심각도**: 🔴 Critical
**검증 방법**: `grep -r "@Throttle" backend/src` → 결과 없음
**위치**: `backend/src/modules/auth/auth.controller.ts`

**문제**: 로그인/회원가입 엔드포인트에 Rate Limiting이 없어 Brute Force 공격에 취약

**현재 상태**: `@Throttle` 데코레이터 사용 없음

**권장 수정**:
```typescript
// app.module.ts에 ThrottlerModule 추가
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,    // 1분
      limit: 10,     // 10회
    }]),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})

// auth.controller.ts
@Post('login')
@Throttle({ default: { limit: 5, ttl: 900000 } }) // 15분에 5회
async login(@Body() loginDto: LoginDto) {
  return this.authService.login(loginDto);
}
```

---

### 2.2 WebSocket CORS `origin: '*'`

**심각도**: 🔴 Critical
**검증 방법**: `grep "origin.*'\\*'" backend/src` → websocket.gateway.ts:20
**위치**: `backend/src/modules/websocket/websocket.gateway.ts:18-23`

**현재 상태**:
```typescript
@WebSocketGateway({
  cors: {
    origin: '*',  // 🔴 모든 출처 허용
    credentials: true,
  },
})
```

**문제**: Cross-site WebSocket hijacking 가능

**권장 수정**:
```typescript
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
})
```

---

### 2.3 JWT Refresh Token Rotation 미구현

**심각도**: 🔴 Critical
**위치**: `backend/src/modules/auth/auth.service.ts:118-147`

**현재 상태**:
```typescript
async refreshToken(refreshToken: string): Promise<LoginResponseDto> {
  // ... 검증 로직 ...

  // 기존 토큰 삭제 없이 새 토큰 발급
  return this.login(user);  // ← 이전 토큰 Redis에 남아있음
}
```

**문제**: 토큰 탈취 시 공격자가 계속 사용 가능

**권장 수정**:
```typescript
async refreshToken(refreshToken: string): Promise<LoginResponseDto> {
  // ... 검증 로직 ...

  // Token Rotation: 기존 토큰 삭제
  await this.redisService.del(`refresh_token:${payload.sub}`);

  // 새 토큰 발급
  return this.login(user);
}
```

---

### 2.4 npm 의존성 취약점

**심각도**: 🔴 Critical
**검증 방법**: `npm audit --json`

**발견된 취약점**:
| 심각도 | 개수 | 패키지 |
|--------|------|--------|
| High | 1 | lodash (Prototype Pollution) |
| Moderate | 5 | @nestjs/config, @nestjs/swagger 등 |

**권장 수정**:
```bash
npm audit fix
# 또는 major 업데이트 필요 시
npm audit fix --force
```

---

### 2.5 테스트 커버리지 심각하게 부족

**심각도**: 🔴 Critical
**검증 방법**: `find backend/src -name "*.spec.ts"` → 7개 파일

**실제 테스트 현황**:

| 카테고리 | 파일 수 | 테스트 파일 | 커버리지 |
|---------|--------|------------|---------|
| Controllers | 15 | 0 | 0% |
| Services | 15+ | 7 | ~47% |
| Guards | 3 | 0 | 0% |
| Gateways | 3 | 0 | 0% |

**테스트 파일 목록**:
```
backend/src/common/services/encryption.service.spec.ts
backend/src/modules/admin/admin.service.spec.ts
backend/src/modules/orders/inventory.service.spec.ts
backend/src/modules/products/products.service.spec.ts
backend/src/modules/reservation/reservation.service.spec.ts
backend/src/modules/settlement/settlement.service.spec.ts
backend/src/modules/users/users.service.spec.ts
```

**필수 추가 테스트** (Priority 순):
1. `auth.service.spec.ts` - 인증 핵심 로직
2. `auth.controller.spec.ts` - 인증 엔드포인트
3. `roles.guard.spec.ts` - 권한 검증
4. `csrf.guard.spec.ts` - CSRF 보호

---

## 3. High 이슈

### 3.1 any 타입 과다 사용 (189개)

**심각도**: 🟠 High
**검증 방법**: `grep -E "(: any|<any>|as any)" backend/src client-app/src | wc -l` → 189

**분포**:
| 위치 | 개수 | 주요 패턴 |
|------|------|----------|
| 테스트 파일 (*.spec.ts) | ~50 | `as any` mock 타입 |
| 서비스 파일 | ~60 | 반환 타입, 매개변수 |
| 컨트롤러 | ~30 | 요청/응답 타입 |
| 유틸리티 | ~49 | 제네릭 처리 |

**주요 문제 위치**:
```typescript
// redis-io.adapter.ts
createIOServer(port: number, options?: ServerOptions): any

// csrf.guard.ts
(target: any, propertyKey?: string, descriptor?: PropertyDescriptor)

// admin.controller.ts
const items = results.data.map((row: any) => ({
```

**권장**: 점진적으로 proper 타입으로 교체 (테스트 파일 제외 시 ~139개)

---

### 3.2 console.log 직접 사용 (17개)

**심각도**: 🟠 High
**검증 방법**: `grep -r "console\.\(log\|error\|warn\)" backend/src | wc -l` → 17

**권장 수정**:
```typescript
// Before
console.log('✅ Chat Gateway initialized');

// After
private readonly logger = new Logger(ChatGateway.name);
this.logger.log('Chat Gateway initialized');
```

---

### 3.3 CSP unsafe-inline 허용

**심각도**: 🟠 High
**위치**: `backend/src/main.ts`

```typescript
helmet({
  contentSecurityPolicy: {
    directives: {
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // 위험
    },
  },
});
```

**문제**: XSS 공격 벡터 확대

---

### 3.4 CSRF 토큰 httpOnly: false

**심각도**: 🟠 High
**위치**: `backend/src/common/guards/csrf.guard.ts`

```typescript
response.cookie('csrf-token', newToken, {
  httpOnly: false, // XSS로 탈취 가능
});
```

---

## 4. Medium 이슈

### 4.1 Cron 작업 경쟁 상태 미처리

**위치**: `backend/src/modules/orders/orders.service.ts`

```typescript
@Cron(CronExpression.EVERY_MINUTE)
async cancelExpiredOrders() {
  // 락 메커니즘 없음 - 중복 실행 가능
}
```

**권장**: Redis 기반 분산 락 추가

---

### 4.2 WebSocket 메모리 정리 누락

**위치**: `backend/src/modules/websocket/websocket.gateway.ts`

```typescript
handleDisconnect(client: Socket) {
  // client.data 정리 안 함
}
```

---

### 4.3 CSRF 토큰 자동 갱신 미구현 (Frontend)

**위치**: `client-app/src/lib/api/client.ts`

토큰 만료 시 자동 갱신 로직 없음

---

## 5. 보안 체크리스트

### 인증/인가

| 항목 | 상태 | 검증 |
|------|------|------|
| OAuth 2.0 (Kakao) | ✅ | kakao.strategy.ts 확인 |
| JWT Access Token | ✅ | 15분 만료 설정 확인 |
| JWT Refresh Token | ⚠️ | Rotation 미구현 |
| Token Blacklist | ✅ | Redis 사용 확인 |
| Rate Limiting | 🔴 | @Throttle 없음 |
| PKCE | ❓ | 미확인 |

### 공격 방어

| 항목 | 상태 | 검증 |
|------|------|------|
| SQL Injection | ✅ | Prisma ORM 사용 |
| XSS | ⚠️ | CSP unsafe-inline 허용 |
| CSRF | ⚠️ | httpOnly: false |
| Brute Force | 🔴 | Rate Limiting 없음 |
| WebSocket Hijacking | 🔴 | CORS origin: '*' |

### 의존성 보안

| 심각도 | 개수 | 조치 |
|--------|------|------|
| Critical | 0 | - |
| High | 1 | npm audit fix 필요 |
| Moderate | 5 | npm audit fix 필요 |

---

## 6. 아키텍처 분석

### 강점

- ✅ 명확한 NestJS 모듈 구조 (15개 Controller)
- ✅ SOLID 원칙 준수 (Dependency Injection)
- ✅ Prisma ORM (SQL Injection 방지)
- ✅ 이벤트 기반 설계 (EventEmitter)
- ✅ Promise.all 활용한 N+1 방지 (cart.service.ts)

### 개선 필요

- ❌ 캐싱 전략 미구현
- ❌ Circuit Breaker 패턴 없음
- ❌ 장애 복구 전략 미정의

---

## 7. 파일별 품질 점수

### Backend (검증 기반)

| 파일 | 이슈 | 점수 |
|------|------|------|
| `main.ts` | CSP unsafe, ValidationPipe | 5/10 |
| `auth.service.ts` | Token Rotation 없음 | 5/10 |
| `auth.controller.ts` | Rate Limiting 없음 | 4/10 |
| `websocket.gateway.ts` | CORS *, 메모리 정리 | 3/10 |
| `orders.service.ts` | Cron 락 없음 | 6/10 |
| `cart.service.ts` | Promise.all 양호 | 7/10 |

---

## 8. 개선 로드맵

### Phase 1: Critical (1주차)

| # | 작업 | 파일 | 복잡도 |
|---|------|------|--------|
| 1 | Rate Limiting 추가 | app.module.ts, auth.controller.ts | 중 |
| 2 | WebSocket CORS 수정 | websocket.gateway.ts | 하 |
| 3 | JWT Token Rotation | auth.service.ts | 중 |
| 4 | npm audit fix | package.json | 하 |
| 5 | Auth 테스트 작성 | auth.service.spec.ts | 상 |

### Phase 2: High (2-3주차)

| # | 작업 | 파일 | 복잡도 |
|---|------|------|--------|
| 6 | any 타입 제거 (우선 50개) | 다수 | 상 |
| 7 | console.log → Logger | 17개 위치 | 중 |
| 8 | CSP 강화 | main.ts | 중 |
| 9 | CSRF httpOnly 개선 | csrf.guard.ts | 중 |
| 10 | Controller 테스트 | *controller.spec.ts | 상 |

### Phase 3: Medium (4주차+)

| # | 작업 | 복잡도 |
|---|------|--------|
| 11 | Cron 분산 락 | 중 |
| 12 | WebSocket 메모리 정리 | 하 |
| 13 | 캐싱 전략 구현 | 상 |
| 14 | 테스트 커버리지 70% | 상 |

---

## 9. 미분석 영역 (추가 검토 필요)

다음 영역은 본 리뷰에서 심층 분석되지 않았으며, 별도 검토 권장:

1. **OAuth 보안**: PKCE 구현 여부, state 파라미터 검증
2. **타이밍 공격**: 상수 시간 비교 사용 여부
3. **시크릿 로테이션**: JWT_SECRET 교체 전략
4. **부하 테스트**: 동시성, 성능 한계
5. **장애 복구**: Redis/DB 장애 시 동작

---

## 10. 결론

### 즉시 수정 필요 (이번 주)

1. 🔴 **Rate Limiting 추가** - Brute Force 공격 취약
2. 🔴 **WebSocket CORS 수정** - 모든 출처 허용 중
3. 🔴 **JWT Token Rotation** - 토큰 탈취 시 무방비
4. 🔴 **npm audit fix** - 알려진 취약점 존재
5. 🔴 **Auth 테스트 작성** - 핵심 기능 테스트 0%

### 권장 목표

| 메트릭 | 현재 | 1개월 | 3개월 |
|--------|------|-------|-------|
| 테스트 커버리지 | ~20% | 50% | 70% |
| any 타입 | 189개 | 100개 | 30개 |
| 보안 점수 | 4/10 | 6/10 | 8/10 |
| 전체 품질 | 5.5/10 | 6.5/10 | 8/10 |

---

*검증된 데이터 기반 분석: 2026-02-03*
*다음 리뷰: Phase 1 완료 후 (1주 후)*
