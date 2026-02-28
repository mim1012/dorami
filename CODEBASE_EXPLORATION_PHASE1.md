# Phase 1: Dorami 코드베이스 탐색 — 테스트, 배포, DB 설정 분석

**작성일**: 2026-02-28
**상태**: ✅ 완료
**범위**: 테스트 구조, 배포 인프라, 데이터베이스 설정

---

## 1️⃣ 테스트 파일 구조

### 전체 테스트 통계

- **총 테스트 파일**: 516개
- **Backend E2E 테스트**: 14개 파일 (`.e2e-spec.ts`)
- **Frontend E2E 테스트**: 37개 파일 (Playwright)
- **구성**: Backend 단위 테스트 + E2E, Frontend Playwright

### Backend 테스트 구조

#### E2E 테스트 (14개 파일)

**인증 및 기본 기능**:

- `backend/test/app.e2e-spec.ts` — 기본 엔드포인트 + 헬스체크
- `backend/test/auth/kakao-auth.e2e-spec.ts` — Kakao OAuth 플로우

**사용자 관리**:

- `backend/test/users/profile-completion.e2e-spec.ts` — 프로필 완성 흐름
- `backend/test/users/my-page-address-update.e2e-spec.ts` — 주소 업데이트

**쇼핑 플로우**:

- `backend/test/cart/cart.e2e-spec.ts` — 장바구니 CRUD
- `backend/test/orders/orders.e2e-spec.ts` — 주문 생성 및 조회
- `backend/test/products/store-products.e2e-spec.ts` — 상품 목록

**관리자 기능**:

- `backend/test/admin/admin-orders.e2e-spec.ts` — 관리자 주문 관리
- `backend/test/admin/admin-users.e2e-spec.ts` — 관리자 사용자 관리
- `backend/test/admin/admin-user-detail.e2e-spec.ts` — 사용자 상세 조회
- `backend/test/admin/dashboard-and-audit.e2e-spec.ts` — 대시보드 및 감사 로그
- `backend/test/admin/payment-confirmation.e2e-spec.ts` — 결제 확인
- `backend/test/admin/settlement.e2e-spec.ts` — 정산

**테스트 프레임워크**: Jest 30.2.0 + NestJS Testing Module

#### 테스트 설정

```typescript
// 표준 패턴: app.e2e-spec.ts
- TestingModule (AppModule 임포트)
- createNestApplication()
- ValidationPipe (whitelist, forbidNonWhitelisted, transform)
- TransformInterceptor 적용
- supertest로 HTTP 요청
```

#### 단위 테스트 실행

```bash
npm run test:backend                    # Jest 단위 테스트
cd backend && npx jest --watch          # Watch 모드
cd backend && npx jest --coverage       # 커버리지 리포트
```

### Frontend 테스트 구조 (37개 Playwright 테스트)

#### Playwright 설정 (`client-app/playwright.config.ts`)

```typescript
- 두 개의 프로젝트:
  1. user: 일반 사용자 프로젝트 (admin-*.spec.ts 제외)
  2. admin: 관리자 프로젝트 (admin-*.spec.ts만 포함)
- 기본 브라우저: Desktop Chrome
- 병렬 실행: 3개 workers (CI: 1개)
- 재시도: CI에서 2회
- globalSetup: e2e/global-setup.ts (사전 인증)
- 저장소: e2e/.auth/user.json, e2e/.auth/admin.json
```

#### 테스트 카테고리

**라이브 스트리밍**:

- `live-page.spec.ts` — 라이브 페이지 기본 표시
- `live-cart-pickup.spec.ts` — 라이브 중 장바구니 픽업
- `live-featured-product-purchase.spec.ts` — 주요 상품 구매

**사용자 기능**:

- `home.spec.ts` — 홈 페이지
- `user-registration.spec.ts` — 회원가입
- `user-journey.spec.ts` — 전체 사용자 여정
- `user-mypage.spec.ts` — 마이페이지
- `user-cart-order.spec.ts` — 장바구니 → 주문
- `shop-purchase-flow.spec.ts` — 쇼핑 구매 흐름

**채팅**:

- `chat.spec.ts` — 실시간 채팅
- `chat-send-message.spec.ts` — 메시지 전송
- `chat-delete-test.spec.ts`, `chat-delete-manual.spec.ts` — 메시지 삭제

**관리자**:

- `admin-management.spec.ts` — 일반 관리 페이지
- `admin-orders-management.spec.ts` — 주문 관리
- `admin-users-detail.spec.ts` — 사용자 상세
- `admin-products-crud.spec.ts` — 상품 CRUD
- `admin-payment-confirmation.spec.ts` — 결제 확인
- `admin-settlement.spec.ts` — 정산
- `admin-audit-log.spec.ts` — 감사 로그
- `admin-broadcasts.spec.ts` — 알림
- `admin-settings.spec.ts` — 설정
- 기타 14개 admin 테스트

**예약 및 검증**:

- `reservation-system.spec.ts` — 예약 시스템
- `verification-live-status.spec.ts`, `verification-access-control.spec.ts` — 검증 테스트

#### 실행 명령어

```bash
cd client-app
npx playwright test                    # 전체 (user + admin)
npx playwright test --project=user     # 사용자만
npx playwright test --project=admin    # 관리자만
npx playwright test e2e/live-page.spec.ts  # 특정 파일
```

#### 테스트 인증 패턴

```typescript
// e2e/global-setup.ts에서 사전 인증
// 두 가지 스토리지 상태 생성:
// 1. e2e/.auth/user.json — 일반 사용자 JWT
// 2. e2e/.auth/admin.json — 관리자 JWT

// 테스트에서 사용:
test.beforeEach(async ({ page }) => {
  await ensureAuth(page, 'USER'); // 또는 'ADMIN'
});
```

---

## 2️⃣ 배포 및 인프라 설정

### 로컬 개발 환경 (Docker Compose)

**파일**: `docker-compose.yml`

```yaml
services:
  postgres:16     # 5432
  redis:7         # 6379
  srs:v6          # RTMP 1935, HTTP 8080
```

#### 실행

```bash
npm run docker:up     # docker-compose up -d
npm run docker:down
npm run docker:logs   # Follow logs
```

### SRS 스트리밍 서버 설정

**파일**: `infrastructure/docker/srs/srs.conf`

#### 핵심 설정

```conf
listen              1935                    # RTMP 포트
http_server         8080                    # HTTP 서버 (FLV + HLS)
threads             4                       # 멀티코어 활용

Heartbeat:
  interval        9.9초
  callback        http://backend:3001/api/streaming/srs-heartbeat

VHost Configuration:
  - HTTP-FLV:  /live/[app]/[stream].flv (저지연 주)
  - HLS:       /live/ (높은 호환성)
  - Fragment:  1초 (keyframe 기반)
  - Window:    4개 fragment

WebHook Callbacks:
  on_publish     -> http://backend:3001/api/streaming/srs-auth
  on_unpublish   -> http://backend:3001/api/streaming/srs-done
```

#### 프로토콜 플로우

```
OBS (rtmp://localhost:1935/live/{streamKey})
    ↓
SRS Media Server (1935 RTMP)
    ↓
├─ HTTP-FLV: http://localhost:8080/live/live/{streamKey}.flv
│  (Nginx → /live/live/[...] 프록시)
│
└─ HLS: http://localhost:8080/live/live/{streamKey}.m3u8
   (Nginx → /hls/[...] 프록시)
```

### AWS CDK 배포 (프로덕션)

**파일**: `infrastructure/aws-cdk/`

#### 아키텍처

```
OBS (1935 RTMP)
  ↓
Network Load Balancer (NLB) — 1935 TCP
  ↓
ECS Fargate Task (2048 CPU, 4096 MB)
  ├─ Nginx RTMP Proxy
  ├─ FFmpeg (재인코딩)
  ↓
Application Load Balancer (ALB) — 8080 HTTP
  ↓
CloudFront CDN
  ↓
HLS.js (클라이언트)
```

#### 스택 구성

```typescript
// infrastructure/aws-cdk/lib/streaming-stack.ts
- VPC (2 AZ, public + private subnets)
- ECR Repository (RTMP 서버 이미지)
- ECS Cluster + Fargate Task Definition
- Network Load Balancer (RTMP 1935)
- Application Load Balancer (HLS 8080)
- CloudFront (CDN)
- CloudWatch Logs (1주일 retention)
- Route53 DNS (선택사항)
- ACM Certificate (HTTPS)

// 배포 명령어
cd infrastructure/aws-cdk
npm run deploy:dev   # 개발 환경
npm run deploy:prod  # 프로덕션 (2개 task)
```

#### 환경 설정

```typescript
// infrastructure/aws-cdk/bin/app.ts
- 두 개 스택: dev + prod
- 기본 리전: ap-northeast-2 (서울)
- BACKEND_URL, CERTIFICATE_ARN 환경변수 필수
- Prod: desiredTaskCount = 2 (고가용성)
```

### CI/CD 파이프라인

**파일**: `.github/workflows/ci.yml`

#### 워크플로우 구조

```yaml
1. 변경사항 감지 (Dorny paths-filter)
   - backend/ → backend-ci 트리거
   - frontend/ → frontend-ci 트리거
   - docker/**/*.* → docker-build 트리거

2. Backend CI (PostgreSQL + Redis 서비스)
   - npm ci + npm install
   - prisma generate
   - prisma migrate deploy
   - eslint & tsc --noEmit (병렬)
   - jest unit tests
   - npm run test:e2e (계속 실행, 실패 무시)
   - npm run build

3. Frontend CI
   - npm install (package-lock.json 없음)
   - eslint & tsc --noEmit (병렬)
   - npm run build

4. Docker Build Test (Matrix)
   - backend/Dockerfile
   - client-app/Dockerfile
   - GitHub Actions Cache 사용

5. Security Scan (Trivy)
   - Backend: CRITICAL,HIGH 취약성 검사
   - Frontend: CRITICAL,HIGH 취약성 검사
```

#### 환경 변수 (CI에서)

```bash
# Backend
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/test_db
JWT_SECRET=test-jwt-secret-for-ci-testing-purposes-only
PROFILE_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
NODE_ENV=test

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=http://localhost:3001
NEXT_PUBLIC_CDN_URL=http://localhost:8080
```

---

## 3️⃣ 데이터베이스 설정

### Prisma Schema 개요

**파일**: `backend/prisma/schema.prisma`

#### 데이터베이스

```
PostgreSQL 16
connection_limit: 20 (권장: CPU cores * 2 + 1)
pool_timeout: 30초
```

#### 핵심 모델 (19개)

```
Core:
  - User (ID: UUID, Kakao 기반)
  - Role: USER | ADMIN
  - UserStatus: ACTIVE | INACTIVE | SUSPENDED

Streaming:
  - LiveStream (ID: UUID, streamKey: unique)
  - StreamStatus: PENDING | LIVE | OFFLINE
  - ChatMessage (Redis history + DB 저장)
  - ModerationLog (메시지 삭제, 뮤트, 밴)

Products:
  - Product (streamKey FK, colorOptions[], sizeOptions[])
  - ProductStatus: AVAILABLE | SOLD_OUT
  - 이미지 배열, 타이머 기능, 할인율

Shopping:
  - Cart (10분 TTL, expiresAt)
  - CartStatus: ACTIVE | EXPIRED | CONVERTED
  - Reservation (대기열 → promoted to cart)
  - ReservationStatus: WAITING | PROMOTED | CANCELLED

Orders:
  - Order (ID: ORD-YYYYMMDD-XXXXX, 고정 형식)
  - OrderItem (productId FK)
  - OrderStatus: PENDING_PAYMENT | PAYMENT_CONFIRMED | SHIPPED | DELIVERED | CANCELLED
  - ShippingStatus: PENDING | SHIPPED | DELIVERED

Financial:
  - PointBalance (누적 포인트)
  - PointTransaction (이력)
  - Settlement (판매 정산)

Notifications & Config:
  - NotificationSubscription (Web Push)
  - AuditLog (관리자 감사)
  - ReStreamTarget (FFmpeg 대상)
  - SystemConfig (설정값)
  - Notice (공지사항)
```

### 마이그레이션 이력 (14개)

| 날짜     | 설명                                         |
| -------- | -------------------------------------------- |
| 0_init   | 초기 스키마                                  |
| 20260220 | 공지사항 카테고리 추가                       |
| 20260221 | LiveStream scheduled_at, thumbnail_url       |
| 20260223 | AlimTalk 설정, 주문 tracking_number          |
| 20260224 | 배송료 임계값, 무료배송 설정, 배송지역 설정  |
| 20260225 | 사용자 전화번호, Zelle 필드, 뮤트오디오 옵션 |
| 20260228 | LiveStream description 추가                  |
| 20260228 | OrderItem productId 인덱스 추가              |

#### 최근 마이그레이션 실행

```bash
npm run prisma:migrate       # 대화형 마이그레이션 생성
npm run prisma:generate      # Prisma Client 생성
npm run prisma:studio        # GUI로 데이터 조회
```

### 중요 데이터 특성

#### 암호화

- **모델**: User.shippingAddress (JSON)
- **방식**: AES-256-GCM
- **키**: PROFILE_ENCRYPTION_KEY (64자 hex)
- **필수**: 프로덕션에서 필수

#### 주문 ID 포맷

```
ORD-YYYYMMDD-XXXXX
예: ORD-20260228-00001
```

#### TTL 필드 (자동 만료)

```
Cart.expiresAt (기본 10분)
Reservation.expiresAt (기본 10분)
```

#### 인덱싱 전략

```
- FK 필드: userId, productId, streamKey
- 복합 인덱스: (streamKey, status), (status, createdAt)
- 쿼리 성능: N+1 최적화됨
```

---

## 4️⃣ 환경 변수

### Backend (`.env.example`)

**필수**:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/live_commerce
JWT_SECRET=min-32-chars-required
REDIS_URL=redis://localhost:6379
```

**중요**:

```
PROFILE_ENCRYPTION_KEY=0123456789abcdef...(64자)
ADMIN_EMAILS=admin@example.com,admin2@example.com
CSRF_ENABLED=true (또는 개발: false)
CORS_ORIGINS=http://localhost:3000,http://localhost:3002
```

**스트리밍**:

```
RTMP_SERVER_URL=rtmp://localhost:1935/live
HLS_SERVER_URL=http://localhost:8080/hls
```

**인증**:

```
KAKAO_CLIENT_ID=...
KAKAO_CLIENT_SECRET=...
KAKAO_CALLBACK_URL=http://localhost:3001/api/auth/kakao/callback
KAKAOTALK_API_KEY=...
```

**타이머**:

```
CART_EXPIRATION_MINUTES=10
RESERVATION_PROMOTION_TIMER_MINUTES=10
ORDER_EXPIRATION_MINUTES=10
```

**기타**:

```
PORT=3001
NODE_ENV=development
APP_ENV=development (production이면 Swagger 숨김)
SENTRY_DSN=(선택)
```

### Frontend (`.env.example`)

```
NEXT_PUBLIC_API_URL=/api                    # Next.js 프록시
NEXT_PUBLIC_WS_URL=http://localhost:3001    # WebSocket
NEXT_PUBLIC_KAKAO_JS_KEY=...
NEXT_PUBLIC_KAKAO_CHANNEL_ID=_wxxxxxx
NEXT_PUBLIC_INSTAGRAM_ID=doremiusa
NEXT_PUBLIC_SENTRY_DSN=(선택)
```

---

## 5️⃣ 주요 발견사항 및 아키텍처 패턴

### 강점

1. ✅ **병렬 CI/CD**: 변경사항 기반 선택적 실행 (Dorny paths-filter)
2. ✅ **포괄적 테스트**: 516개 파일, Backend E2E + Frontend Playwright
3. ✅ **명확한 배포 계층**: 로컬 SRS + AWS CDK (dev/prod 분리)
4. ✅ **WebSocket 스케일링**: Redis 어댑터로 다중 인스턴스 지원
5. ✅ **보안**: 암호화된 주소, JWT HttpOnly, CSRF 보호

### 주의사항

1. ⚠️ **WebSocket 핸들러**: `main.ts`에 인라인 구현 (모듈화 검토 필요)
2. ⚠️ **TTL 관리**: Cart, Reservation 만료는 크론 작업 또는 수동 정리 필요
3. ⚠️ **마이그레이션 순서**: 최근 일자 마이그레이션 중복 (20260224, 20260225)
4. ⚠️ **테스트 커버리지**: 516개 파일이지만 일부 테스트가 실패 무시 (continue-on-error)

### E2E 테스트 신뢰성

**현재 상태**:

- Backend E2E: 14개 (모두 필수)
- Frontend E2E: 37개 (2개 프로젝트)
- 실패 시 영향: 빌드 통과하지만 로그 기록

**권장사항**:

- E2E 실패 시 빌드 실패로 변경 (중요 플로우 보호)
- 플레이라이트 테스트 재시도 증가 (CI: 3회 권장)
- 채팅/실시간 테스트에 명시적 대기 추가

---

## 6️⃣ 다음 단계

### Phase 2: 아키텍처 분석

- [ ] WebSocket 핸들러 모듈화 검토
- [ ] TTL 정리 메커니즘 검증
- [ ] 캐시/Redis 사용 패턴 분석
- [ ] 재시도 가능성 (idempotency) 검증

### Phase 3: 테스트 전략

- [ ] 실시간 성능 테스트 (load test)
- [ ] 네트워크 장애 시뮬레이션
- [ ] 동시 접속 시나리오

### Phase 4: 액션 플랜

- [ ] WebSocket 핸들러 모듈 분리
- [ ] TTL 크론 작업 구현 또는 검증
- [ ] E2E 실패 정책 강화
- [ ] 성능 모니터링 (Datadog/CloudWatch)

---

**작성자**: Claude Code Explorer
**기술 검증**: Phase 2 (아키텍처) 진행 중
