# Dorami 라이브 커머스 - 코드 리뷰 보고서 v4

**분석 일시**: 2026-02-07
**분석 방법**: 소스 코드 정독 + 정적 분석 + 런타임 확인
**분석 범위**: Backend (120+ 파일) + Frontend (130+ 파일)
**기준 비교**: CODE_REVIEW_REPORT_v3.md (2026-02-03)

---

## 1. 실행 요약

### 전체 품질 스코어: 6.5/10 (v3 대비 +1.0 개선)

| 카테고리 | v3 점수 | v4 점수 | 상태 | 변동 |
|---------|--------|--------|------|------|
| 코드 품질 | 4/10 | 5/10 | ⚠️ | ⬆️ +1 |
| 보안 | 4/10 | 6/10 | ⚠️ | ⬆️ +2 |
| 성능 | 6/10 | 6/10 | ⚠️ | ➡️ 동일 |
| 아키텍처 | 7/10 | 7/10 | ✅ | ➡️ 동일 |
| 에러 처리 | 5/10 | 6/10 | ⚠️ | ⬆️ +1 |
| 테스트 | 3/10 | 4/10 | 🔴 | ⬆️ +1 |
| 의존성 보안 | 4/10 | 5/10 | ⚠️ | ⬆️ +1 |

---

## 2. v3 대비 개선된 사항 ✅

### 2.1 Rate Limiting 구현 완료 ✅
**v3 상태**: 🔴 Critical - `@Throttle` 미사용
**v4 상태**: ✅ 해결됨

```typescript
// app.module.ts - ThrottlerModule 추가됨
ThrottlerModule.forRoot(throttlerConfig)  // 전역 Rate Limiting

// throttler.config.ts - 3단계 티어 구성
{
  name: 'short',  ttl: 1000,  limit: 3,   // 버스트 보호
  name: 'medium', ttl: 10000, limit: 20,  // 일반
  name: 'long',   ttl: 60000, limit: 100, // 분당
}

// APP_GUARD로 ThrottlerGuard 전역 적용
{ provide: APP_GUARD, useClass: ThrottlerGuard }
```

**평가**: 잘 구현됨. 3단계 티어 구성은 실제 운영에 적합.

### 2.2 WebSocket CORS 수정 완료 ✅
**v3 상태**: 🔴 Critical - `origin: '*'`
**v4 상태**: ✅ 해결됨

```typescript
// websocket.gateway.ts - 환경변수 기반 화이트리스트
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
  },
})
```

### 2.3 JWT Token Rotation 구현 완료 ✅
**v3 상태**: 🔴 Critical - 기존 토큰 미삭제
**v4 상태**: ✅ 해결됨

```typescript
// auth.service.ts:141
async refreshToken(refreshToken: string): Promise<LoginResponseDto> {
  // ...검증 로직...
  // Token Rotation: Delete old refresh token BEFORE issuing new one
  await this.redisService.del(`refresh_token:${payload.sub}`);
  return this.login(user);
}
```

### 2.4 Auth 테스트 추가 ✅
**v3 상태**: 🔴 Critical - auth.service.spec.ts 없음
**v4 상태**: ✅ 추가됨 (188줄)

현재 테스트 파일 9개 (v3에서 7개):
```
+ backend/src/modules/auth/auth.service.spec.ts (신규)
+ backend/src/modules/orders/orders.service.spec.ts (신규)
```

### 2.5 CSRF Guard 개선
- `timingSafeEqual` 메서드로 타이밍 공격 방지 구현
- CSRF 토큰 자동 순환 (매 POST 요청 후 새 토큰 발급)
- `sameSite: 'strict'` 설정

---

## 3. 여전히 남아있는 Critical 이슈

### 3.1 🔴 관리자 인증/인가 비활성화 (가장 심각)

**심각도**: 🔴 Critical
**위치**: `backend/src/modules/admin/admin.controller.ts:10-11`

```typescript
@Controller('admin')
// TODO: Re-enable authentication for production
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles('ADMIN')
export class AdminController {
```

**문제**: 관리자 API 전체가 인증 없이 접근 가능. 누구나 다음을 할 수 있음:
- 모든 사용자 정보 조회 (개인정보 유출)
- 주문 입금 확인/취소
- 사용자 계정 정지
- 시스템 설정 변경
- 정산 데이터 조회

**프론트엔드에서도 동일하게 비활성화**:
```typescript
// client-app/src/app/admin/orders/page.tsx
// TEMPORARILY DISABLED FOR TESTING
// @UseGuards(JwtAuthGuard, RolesGuard)
```

**위험도**: 프로덕션 배포 시 절대 이 상태로 배포하면 안 됨.

### 3.2 🔴 CSP unsafe-inline/unsafe-eval 유지

**위치**: `backend/src/main.ts:35-36`

```typescript
scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
styleSrc: ["'self'", "'unsafe-inline'"],
```

**문제**: XSS 공격 벡터 확대. v3에서 지적된 이후 변경 없음.

### 3.3 🔴 CSRF 토큰 httpOnly: false 유지

**위치**: `backend/src/common/guards/csrf.guard.ts:108`

```typescript
response.cookie('csrf-token', newToken, {
  httpOnly: false, // JavaScript에서 읽어야 하므로 필요하지만...
});
```

**참고**: Double Submit Cookie 패턴에서는 httpOnly: false가 필요하나, Synchronizer Token 패턴으로 전환 권장.

### 3.4 🔴 npm 의존성 취약점

```
High: 1 (@isaacs/brace-expansion - Uncontrolled Resource Consumption)
Moderate: 5 (@nestjs/config, @nestjs/swagger via lodash)
```

---

## 4. High 이슈

### 4.1 🟠 any 타입 과다 사용

| 영역 | v3 | v4 | 변동 |
|------|-----|-----|------|
| Backend | ~140 | 142 | ➡️ 미개선 |
| Frontend | ~49 | 78 | ⬆️ 증가 |
| **합계** | **189** | **220** | ⬆️ 증가 |

**주요 문제 위치 (Backend)**:
- `streaming.service.ts` - `getStreamHistory`의 where 절이 `any`
- `admin.controller.ts` - CSV 파싱 시 `row: any`
- `streaming.service.ts` - `mapToResponseDto(session: any)`

**주요 문제 위치 (Frontend)**:
- `client-app/src/lib/api/client.ts` - API 응답 타입들
- 각 페이지 컴포넌트의 `catch (err: any)`

### 4.2 🟠 console.log 직접 사용

| 영역 | v3 | v4 | 변동 |
|------|-----|-----|------|
| Backend | 17 | 17 | ➡️ 미개선 |
| Frontend | - | 111 | 새로 측정 |

**Backend 주요 위치**: `chat.gateway.ts` (9곳), `streaming.gateway.ts` (4곳)

NestJS Logger 서비스가 구현되어 있음에도 (`LoggerService`) WebSocket 게이트웨이들에서 사용하지 않음.

### 4.3 🟠 프론트엔드 하드코딩 Mock 데이터

여러 관리자 페이지가 API 대신 하드코딩된 mock 데이터를 사용:

| 페이지 | 상태 |
|--------|------|
| `/admin/products` | 🔴 Mock 데이터 사용 |
| `/admin/orders` | 🔴 Mock 데이터 사용 |
| `/admin/dashboard` (admin/page.tsx) | 🔴 Mock 데이터 사용 |
| `/admin/dashboard` (dashboard/page.tsx) | ✅ API 연동 |
| `/` (홈 페이지) | 🔴 Mock 데이터 사용 |
| `/shop` | 🔴 Mock 데이터 사용 |

**문제**: 백엔드 API가 완전히 구현되어 있으나 프론트엔드에서 연결하지 않음.

### 4.4 🟠 recharts 의존성 누락

`client-app/src/app/admin/settlement/page.tsx`에서 `recharts`를 import하지만 `package.json`에 미설치:

```
Module not found: Can't resolve 'recharts'
```

정산 페이지 전체 및 라우팅에 영향을 미침 (같은 레이아웃 내 다른 페이지도 빌드 에러 발생).

### 4.5 🟠 Cron 작업 분산 락 미구현

**위치**: `orders.service.ts`, `cart.service.ts`

```typescript
@Cron(CronExpression.EVERY_MINUTE)
async cancelExpiredOrders() {
  // 락 메커니즘 없음 - 다중 인스턴스에서 중복 실행 가능
}
```

---

## 5. Medium 이슈

### 5.1 WebSocket 메모리 관리

`websocket.gateway.ts`의 `handleDisconnect`에서 room 정리는 하지만, `client.data` 정리 미흡.

### 5.2 에러 핸들링 일관성

- Backend: `BusinessException` 패턴은 잘 구축되어 있으나, 일부 서비스에서 직접 NestJS 예외를 throw
- Frontend: `catch (err: any)` 패턴이 일관적이나 에러 타입 처리가 부족

### 5.3 타이머 정확성

장바구니 타이머가 서버 시간 기반으로 구현 (`expiresAt`) - 이것은 올바른 구현이나, 클라이언트-서버 시간 차이를 보정하는 로직 없음.

### 5.4 환경변수 기본값

일부 환경변수에 프로덕션에 부적합한 기본값이 하드코딩:
```typescript
this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
```

---

## 6. 보안 체크리스트 (v4 업데이트)

### 인증/인가

| 항목 | v3 | v4 | 비고 |
|------|-----|-----|------|
| OAuth 2.0 (Kakao) | ✅ | ✅ | 안정 |
| JWT Access Token (15분) | ✅ | ✅ | 안정 |
| JWT Refresh Token (7일) | ⚠️ | ✅ | Token Rotation 구현 |
| Token Blacklist | ✅ | ✅ | Redis 기반 |
| Rate Limiting | 🔴 | ✅ | **해결됨** - 3단계 티어 |
| Admin 인증 | - | 🔴 | **새 발견** - 비활성화 상태 |

### 공격 방어

| 항목 | v3 | v4 | 비고 |
|------|-----|-----|------|
| SQL Injection | ✅ | ✅ | Prisma ORM |
| XSS | ⚠️ | ⚠️ | CSP unsafe-inline 유지 |
| CSRF | ⚠️ | ⚠️ | 타이밍 공격 방지 추가, httpOnly 여전히 false |
| Brute Force | 🔴 | ✅ | **해결됨** |
| WebSocket Hijacking | 🔴 | ✅ | **해결됨** |

---

## 7. 아키텍처 분석

### 강점 (유지)

- ✅ 명확한 NestJS 모듈 구조 (18개 모듈)
- ✅ SOLID 원칙 준수 (DI 활용)
- ✅ Prisma ORM (타입 안전 + SQL Injection 방지)
- ✅ 이벤트 기반 설계 (`EventEmitter2` 활용)
- ✅ Promise.all 병렬 쿼리 최적화
- ✅ Redis 캐싱 활용 (스트리밍 메타데이터, 시청자 수)
- ✅ 환경변수 검증 (`configValidationSchema`)
- ✅ 응답 압축 (`compression`)
- ✅ Swagger API 문서 자동 생성
- ✅ 주문 ID 생성에 Redis INCR 사용 (충돌 방지)

### 개선 필요

- ❌ 캐싱 전략 미흡 (Redis에 스트리밍만 캐싱)
- ❌ Circuit Breaker 패턴 없음
- ❌ 장애 복구 전략 미정의
- ❌ 프론트-백 연동 미완성 (Mock 데이터 잔존)

### 프론트엔드 분석

| 항목 | 상태 | 비고 |
|------|------|------|
| 컴포넌트 구조 | ✅ | Atomic Design 패턴 준수 |
| 상태관리 | ✅ | Zustand + React Query 적절히 분리 |
| 타입 안정성 | ⚠️ | `any` 78개, 대부분 catch 블록 |
| 접근성 (a11y) | ⚠️ | `title` 속성 일부, aria 부족 |
| 반응형 | ✅ | Tailwind 기반 모바일-데스크톱 대응 |
| 다크모드 | ✅ | ThemeToggle 컴포넌트 구현 |
| 코드 분할 | ✅ | Next.js App Router 자동 처리 |
| 에러 바운더리 | ⚠️ | 컴포넌트 레벨만, 글로벌 미구현 |

---

## 8. 테스트 커버리지

### 단위 테스트 (Backend)

| 카테고리 | v3 파일 수 | v4 파일 수 | 변동 |
|---------|-----------|-----------|------|
| Services | 7 | 9 | ⬆️ +2 |
| Controllers | 0 | 0 | ➡️ |
| Guards | 0 | 0 | ➡️ |
| Gateways | 0 | 0 | ➡️ |

### E2E 테스트 (Backend)

| 카테고리 | 파일 수 |
|---------|--------|
| Admin | 6 |
| Auth | 1 |
| Cart | 1 |
| Orders | 1 |
| Products | 2 |
| Users | 2 |
| App | 1 |
| **합계** | **14** |

### Playwright 테스트 (Frontend)

| 파일 | 비고 |
|------|------|
| `api-health.spec.ts` | API 헬스체크 |
| `shop.spec.ts` | 상점 페이지 |
| `shop-purchase-flow.spec.ts` | 구매 플로우 |
| `home.spec.ts` | 홈 페이지 |
| `admin-products-crud.spec.ts` | 관리자 상품 CRUD |

---

## 9. 개선 로드맵 (v4 업데이트)

### Phase 1: Critical (이번 주) 🔥

| # | 작업 | 복잡도 | 비고 |
|---|------|--------|------|
| 1 | Admin 인증 재활성화 | 하 | 주석 해제 + 테스트 |
| 2 | `recharts` 의존성 설치 | 하 | `npm install recharts` |
| 3 | CSP unsafe-inline 제거 | 중 | nonce 기반 전환 |
| 4 | npm audit fix | 하 | 알려진 취약점 패치 |

### Phase 2: High (1-2주)

| # | 작업 | 복잡도 | 비고 |
|---|------|--------|------|
| 5 | 프론트엔드 Mock → API 연동 | 상 | 홈, 상품관리, 주문관리 |
| 6 | console.log → Logger 전환 | 중 | Backend 17곳 |
| 7 | any 타입 제거 (우선 50개) | 중 | catch 블록 중심 |
| 8 | Controller 테스트 작성 | 상 | 최소 auth, admin |

### Phase 3: Medium (3-4주)

| # | 작업 | 복잡도 |
|---|------|--------|
| 9 | Cron 분산 락 | 중 |
| 10 | 글로벌 에러 바운더리 | 중 |
| 11 | 접근성 (a11y) 강화 | 중 |
| 12 | 테스트 커버리지 50%+ | 상 |

---

## 10. 결론

### v3 → v4 변화 요약

| 메트릭 | v3 | v4 | 목표 (1개월) |
|--------|-----|-----|------------|
| 전체 품질 | 5.5/10 | 6.5/10 | 7.5/10 |
| 보안 점수 | 4/10 | 6/10 | 8/10 |
| 테스트 파일 | 7 | 9+14(E2E) | 25+ |
| any 타입 | 189 | 220 | 100 |
| console.log (BE) | 17 | 17 | 0 |
| Critical 이슈 | 5 | 2 | 0 |

### 즉시 수정 필요 (이번 주)

1. 🔴 **Admin 인증 재활성화** - 프로덕션 배포 전 필수
2. 🔴 **recharts 설치** - 정산 페이지 및 마이페이지 빌드 실패
3. 🔴 **CSP 강화** - unsafe-inline/unsafe-eval 제거
4. 🔴 **npm audit fix** - 알려진 취약점 존재

### 긍정적 변화

v3에서 지적된 Critical 5건 중 3건(Rate Limiting, WebSocket CORS, Token Rotation)이 해결되었으며, 보안 점수가 4/10 → 6/10으로 크게 개선됨. 이벤트 기반 아키텍처와 실시간 기능 구현이 견고함.

### 주의 사항

프론트엔드의 Mock 데이터 의존과 Admin 인증 비활성화는 MVP 배포 전 반드시 해결해야 하는 블로커임.

---

*코드 리뷰 v4: 2026-02-07*
*다음 리뷰: Phase 1 완료 후*
