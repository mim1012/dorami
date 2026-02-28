# Dorami 코드베이스 분석 보고서

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [백엔드 아키텍처](#2-백엔드-아키텍처)
3. [프론트엔드 아키텍처](#3-프론트엔드-아키텍처)
4. [데이터베이스 설계](#4-데이터베이스-설계)
5. [실시간 통신 시스템](#5-실시간-통신-시스템)
6. [스트리밍 인프라](#6-스트리밍-인프라)
7. [배포 및 운영](#7-배포-및-운영)
8. [아키텍처 다이어그램 및 데이터 흐름](#8-아키텍처-다이어그램-및-데이터-흐름)
9. [주요 기술 결정사항 (ADR)](#9-주요-기술-결정사항-adr)
10. [개발자 가이드](#10-개발자-가이드)
11. [핵심 요약 및 다음 단계](#11-핵심-요약-및-다음-단계)

---

## 1. 프로젝트 개요

### 프로젝트 정의

Dorami는 **1인 셀러 라이브 커머스 MVP 플랫폼**이다. 셀러가 실시간 방송으로 상품을 시연하고, 시청자가 방송 중 바로 구매할 수 있는 한국어 기반 e-커머스 애플리케이션이다.

- **프로덕션 도메인**: `https://www.doremi-live.com`
- **타겟 시장**: 한국어 사용자 (US 배송 기반)
- **결제 방식**: 은행 송금 (무통장 입금) + Zelle

### 기술 스택 개요

| 영역             | 기술                          | 버전        |
| ---------------- | ----------------------------- | ----------- |
| **Backend**      | NestJS                        | 11.x        |
| **Frontend**     | Next.js (App Router)          | 16.x        |
| **UI Framework** | React                         | 19.x        |
| **스타일링**     | Tailwind CSS                  | 4.0         |
| **상태관리**     | Zustand + TanStack Query      | 5.x / 5.x   |
| **ORM**          | Prisma                        | 6.19        |
| **Database**     | PostgreSQL                    | 16          |
| **Cache/PubSub** | Redis                         | 7           |
| **Media Server** | SRS (Simple Realtime Server)  | v6          |
| **실시간 통신**  | Socket.IO                     | 4.8         |
| **인증**         | Kakao OAuth + JWT             | -           |
| **공유 타입**    | `@live-commerce/shared-types` | 자체 패키지 |
| **런타임**       | Node.js                       | >= 20       |

### 모노레포 구조

```
dorami/
├── backend/              # NestJS API 서버 (port 3001)
├── client-app/           # Next.js 프론트엔드 (port 3000)
├── packages/
│   └── shared-types/     # 공유 TypeScript 타입/헬퍼
├── infrastructure/       # Docker, SRS, AWS CDK
├── nginx/                # Nginx 프록시 설정
├── scripts/              # 배포/운영 스크립트
└── .github/workflows/    # CI/CD 파이프라인
```

npm workspaces로 관리되며, `postinstall` 훅에서 `shared-types` 패키지를 자동 빌드한다.

---

## 2. 백엔드 아키텍처

### 모듈 구조 및 책임

NestJS의 모듈 시스템 기반으로 20개 모듈이 기능별로 분리되어 있다.

| 모듈            | 책임                                             |
| --------------- | ------------------------------------------------ |
| `auth`          | Kakao OAuth 로그인, JWT 발급/갱신, 개발용 로그인 |
| `users`         | 사용자 프로필 CRUD, 배송지 암호화 관리           |
| `products`      | 상품 CRUD, 재고 관리, 라이브 상품 연결           |
| `streaming`     | 라이브 스트림 생명주기, SRS 웹훅 처리            |
| `cart`          | 장바구니 (10분 타이머 만료), 수량 관리           |
| `reservation`   | 대기열 시스템, 프로모션(대기 → 장바구니)         |
| `orders`        | 주문 생성, 결제 확인, 배송 상태 관리             |
| `chat`          | WebSocket 실시간 채팅 (게이트웨이 정의)          |
| `notifications` | Web Push (VAPID), 카카오 알림톡                  |
| `points`        | 리워드 포인트 적립/사용/만료                     |
| `settlement`    | 판매 정산 관리                                   |
| `restream`      | FFmpeg 멀티 플랫폼 동시 송출                     |
| `admin`         | 관리자 대시보드, 감사 로그, 시스템 설정          |
| `notices`       | 공지사항 CRUD                                    |
| `upload`        | 파일 업로드 (Multer)                             |
| `health`        | liveness/readiness 헬스체크                      |
| `store`         | 스토어 상품 목록                                 |
| `websocket`     | SocketIoProvider (DI용 싱글톤)                   |

### 요청 흐름 (Request Pipeline)

```
Client Request
  → cookieParser
  → helmet (보안 헤더)
  → compression (gzip level 6)
  → CORS (화이트리스트 기반)
  → ValidationPipe (whitelist + transform + forbidNonWhitelisted)
  → CsrfGuard (Double Submit Cookie 패턴)
  → Controller
  → Service
  → Prisma ORM
  → PostgreSQL
  → TransformInterceptor ({ data, success, timestamp } 래핑)
  → BusinessExceptionFilter (에러 시)
  → Response
```

### API 설계

- **글로벌 프리픽스**: `/api`
- **Swagger 문서**: `/api/docs` (프로덕션 제외, `APP_ENV !== 'production'`)
- **응답 형식**: `{ data: T, success: boolean, timestamp: string }`
- **에러 형식**: `{ statusCode, errorCode, message, timestamp }`

### 인증 및 인가

- **OAuth 2.0**: Kakao 로그인 → JWT 발급
- **Access Token**: 15분, HttpOnly 쿠키
- **Refresh Token**: 7일
- **개발용**: `POST /api/auth/dev-login` (E2E 테스트용)
- **커스텀 데코레이터**:
  - `@AdminOnly()` — JWT + Role 가드 결합
  - `@Public()` — 인증 면제
  - `@CurrentUser()` — JWT 컨텍스트에서 사용자 추출

### 에러 처리

`BusinessException` 기반의 네임드 에러 코드 시스템. 사전 정의된 서브클래스:

- `InsufficientStockException` — 재고 부족
- `CartExpiredException` — 장바구니 만료
- `OrderNotFoundException` — 주문 미발견
- 기타 도메인별 예외

### 보안 설정

- **Helmet**: CSP, HSTS, X-Frame-Options, Referrer-Policy
- **Permissions-Policy**: 카메라, 마이크, 위치, 결제 등 제한
- **CSRF**: Double Submit Cookie (프로덕션 항상 활성, 개발환경 `CSRF_ENABLED=false`로 비활성 가능)
- **입력 검증**: `ValidationPipe`의 whitelist + forbidNonWhitelisted
- **주소 암호화**: AES-256-GCM (`EncryptionService`, `PROFILE_ENCRYPTION_KEY` 필요)

---

## 3. 프론트엔드 아키텍처

### 라우팅 구조 (App Router)

```
app/
├── (auth)/login/          # 카카오 로그인 페이지
├── admin/                 # 관리자 영역
│   ├── dashboard/         # 대시보드
│   ├── orders/            # 주문 관리 (상세, 일괄 알림)
│   ├── products/          # 상품 관리
│   ├── users/             # 사용자 관리 (상세)
│   ├── broadcasts/        # 방송 관리
│   ├── settlement/        # 정산
│   ├── settings/          # 시스템 설정 (알림)
│   └── audit-log/         # 감사 로그
├── live/
│   ├── preview/           # 방송 미리보기
│   └── [streamKey]/       # 라이브 시청 페이지
├── cart/                  # 장바구니
├── checkout/              # 결제
├── orders/[orderId]/      # 주문 상세
├── order-complete/        # 주문 완료
├── my-page/               # 마이페이지 (포인트, 예약)
├── profile/register/      # 프로필 등록
├── shop/ & store/         # 상품 목록
├── products/[id]/         # 상품 상세
├── alerts/                # 알림
├── privacy/ & terms/      # 개인정보/이용약관
└── api/csrf/              # CSRF 토큰 API 라우트
```

### 상태관리

| 유형            | 기술                  | 위치                                                                                                 |
| --------------- | --------------------- | ---------------------------------------------------------------------------------------------------- |
| 클라이언트 상태 | Zustand               | `lib/store/auth.ts` (user, isAuthenticated)                                                          |
| 서버 상태       | TanStack Query v5     | `lib/hooks/queries/` (use-cart, use-orders, use-points, use-products, use-reservations, use-streams) |
| 실시간 상태     | Socket.IO Client      | `lib/socket/socket-client.ts` + `hooks/`                                                             |
| 폼 상태         | React Hook Form + Zod | 주문/프로필 폼                                                                                       |

### API 클라이언트 (`lib/api/client.ts`)

커스텀 fetch 래퍼로 다음 기능 제공:

- 자동 CSRF 토큰 주입
- 401 응답 시 토큰 리프레시 → 요청 재시도 (coalesced)
- `{ data }` 엔벨로프 자동 언래핑
- `ApiError` 클래스 (`statusCode`, `errorCode`, `details`)

### 주요 커스텀 훅

| 훅                               | 역할                                                                                                                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useLiveLayoutMachine`           | 라이브 페이지 멀티 FSM (connection/stream/uiMode/overlay 상태). `LiveSnapshot` enum 파생 (`LIVE_NORMAL`, `LIVE_TYPING`, `RETRYING`, `NO_STREAM`, `ENDED`). `LiveLayout` 디스크립터 계산 |
| `useChatConnection`              | `/chat` Socket.IO 네임스페이스 관리, `sendMessage`, `deleteMessage`                                                                                                                     |
| `useChatMessages`                | `chat:message` 이벤트 메시지 누적                                                                                                                                                       |
| `useCartActivity`                | 장바구니 추가 이벤트 → 채팅 오버레이 시스템 메시지                                                                                                                                      |
| `useProductStock`                | 실시간 재고 업데이트 (WebSocket)                                                                                                                                                        |
| `useNotifications`               | Web Push 구독 관리                                                                                                                                                                      |
| `useKakaoShare`                  | 카카오 공유하기                                                                                                                                                                         |
| `useIsMobile` / `useOrientation` | 반응형 레이아웃                                                                                                                                                                         |

### 비디오 플레이어

`VideoPlayer` 컴포넌트의 프로토콜 우선순위:

1. **HTTP-FLV** (mpegts.js) — 저지연 우선
2. **HLS** (hls.js) — 에러 시 폴백 (Safari/iOS 호환)

`VideoStreamEvent` 타입: `PLAY_OK` | `STALL` | `MEDIA_ERROR` | `STREAM_ENDED` → `useLiveLayoutMachine` FSM에 피드.

### UI 테마

- **다크 모드** 기반
- **액센트 컬러**: Hot Pink (`#FF1493` / `pink-500`)
- **Tailwind CSS 4.0**: 컴포넌트별 다크 모드 클래스

### Next.js 프록시 설정

`next.config.ts`에서 다음 프록시 설정:

- `/api/:path*` → `${BACKEND_URL}/api/:path*` (기본: `http://127.0.0.1:3001`)
- `/live/live/:path*` → `${MEDIA_SERVER_URL}` (기본: `http://127.0.0.1:8080`)
- `/hls/:path*` → `${MEDIA_SERVER_URL}` (fallback rewrites)

---

## 4. 데이터베이스 설계

### 주요 엔티티 (Prisma + PostgreSQL 16)

스키마 파일: `backend/prisma/schema.prisma`

#### 핵심 모델

| 모델                       | 설명           | 주요 필드                                                                                                                   |
| -------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `User`                     | 사용자         | kakaoId(unique), role(USER/ADMIN), status, instagramId, shippingAddress(JSON, 암호화)                                       |
| `LiveStream`               | 방송           | streamKey(unique), status(PENDING/LIVE/OFFLINE), scheduledAt, peakViewers, freeShippingEnabled                              |
| `Product`                  | 상품           | streamKey(FK), price(Decimal), quantity, colorOptions[], sizeOptions[], status(AVAILABLE/SOLD_OUT), discountRate, sortOrder |
| `Cart`                     | 장바구니       | userId, productId, status(ACTIVE/EXPIRED/COMPLETED), timerEnabled, expiresAt                                                |
| `Reservation`              | 대기열         | productId, reservationNumber(순번), status(WAITING/PROMOTED/CANCELLED/EXPIRED), promotedAt                                  |
| `Order`                    | 주문           | id(ORD-YYYYMMDD-XXXXX), depositorName, shippingAddress(JSON), subtotal/shippingFee/total(Decimal), pointsUsed/pointsEarned  |
| `OrderItem`                | 주문 항목      | orderId, productId, price(Decimal), quantity, color, size                                                                   |
| `PointBalance`             | 포인트 잔액    | userId(unique), currentBalance, lifetimeEarned/Used/Expired                                                                 |
| `PointTransaction`         | 포인트 거래    | transactionType(EARNED_ORDER/USED_ORDER/EXPIRED 등), amount, expiresAt                                                      |
| `Settlement`               | 정산           | sellerId, periodStart/End, totalSales, commission, status(PENDING/APPROVED/PAID)                                            |
| `ReStreamTarget`           | 동시 송출 대상 | platform(YOUTUBE/INSTAGRAM/TIKTOK/CUSTOM), rtmpUrl, streamKey                                                               |
| `ReStreamLog`              | 동시 송출 로그 | targetId, liveStreamId, status, restartCount                                                                                |
| `NotificationSubscription` | 푸시 구독      | endpoint, p256dh, auth (VAPID)                                                                                              |
| `SystemConfig`             | 시스템 설정    | 배송비, 은행 정보, Zelle 정보, 포인트 설정, 알림톡 설정                                                                     |
| `AuditLog`                 | 감사 로그      | adminId, action, entity, entityId, changes(JSON before/after)                                                               |
| `Notice`                   | 공지사항       | title, content, category(IMPORTANT/GENERAL), isActive                                                                       |

#### ID 생성 규칙

- **기본**: UUID v4 (`@default(uuid())`)
- **주문**: `ORD-YYYYMMDD-XXXXX` 포맷 (시퀀스 기반, UUID 아님)
- **예약**: `productId + reservationNumber` 복합 유니크

#### 관계 다이어그램 (텍스트)

```
User ──1:N──> LiveStream ──1:N──> Product ──1:N──> Cart
  │                │                  │              │
  │                │                  └──1:N──> OrderItem
  │                │                  │
  │                │                  └──1:N──> Reservation
  │                │
  │                └──1:N──> ChatMessage
  │                └──1:N──> ReStreamLog
  │
  ├──1:N──> Cart
  ├──1:N──> Order ──1:N──> OrderItem
  ├──1:N──> Reservation
  ├──1:1──> PointBalance ──1:N──> PointTransaction
  ├──1:N──> Settlement
  ├──1:N──> ReStreamTarget ──1:N──> ReStreamLog
  └──1:N──> NotificationSubscription
```

#### 암호화 및 보안

- `shippingAddress` 필드: AES-256-GCM 암호화 (`EncryptionService`)
- 암호화 키: `PROFILE_ENCRYPTION_KEY` (64자 hex)
- `User.shippingAddress` — Prisma에서 `Json` 타입, 저장/조회 시 암호화/복호화

#### 인덱스 전략

성능 최적화를 위한 복합 인덱스:

- `Cart`: `[userId, status]`, `[status, timerEnabled, expiresAt]` (크론 작업용)
- `Order`: `[userId, createdAt]` (주문 이력), `[status, createdAt]` (만료 주문 정리용)
- `Product`: `[streamKey, status]` (방송별 상품 필터링)
- `Reservation`: `[status, expiresAt]` (프로모션 만료 크론용)

---

## 5. 실시간 통신 시스템

### Socket.IO 아키텍처

Socket.IO는 NestJS 표준 게이트웨이 DI가 아닌, **`main.ts`에서 수동으로 부트스트랩**된다. 하나의 `Server` 인스턴스를 생성하고, Redis 어댑터를 연결한 뒤, 모든 네임스페이스의 이벤트 핸들러를 `main.ts` 내에 인라인으로 구현한다.

**`SocketIoProvider`** (`modules/websocket/socket-io.provider.ts`)는 NestJS 인젝터블 싱글톤으로, `Server` 인스턴스를 보유한다. `main.ts`에서 서버 생성 후 `socketIoProvider.setServer(io)`로 설정하며, 브로드캐스트가 필요한 서비스에 주입된다.

### 3개 네임스페이스

#### `/` (루트) — 일반 스트림 이벤트

| 이벤트                                       | 방향            | 설명                      |
| -------------------------------------------- | --------------- | ------------------------- |
| `join:stream`                                | Client → Server | 스트림 룸 입장            |
| `leave:stream`                               | Client → Server | 스트림 룸 퇴장            |
| `user:joined` / `user:left`                  | Server → Room   | 입퇴장 알림               |
| `live:product:added/updated/soldout/deleted` | Server → Room   | 상품 실시간 업데이트      |
| `order:purchase:notification`                | Server → Room   | 결제 알림 (채팅 오버레이) |
| `upcoming:updated`                           | Server → All    | 예정 방송 목록 갱신       |

`io` 객체에 `broadcastProduct*` 메서드를 monkey-patch하여 서비스에서 직접 호출 가능.

#### `/chat` — 실시간 채팅

| 이벤트                | 방향            | 설명                      |
| --------------------- | --------------- | ------------------------- |
| `chat:join-room`      | Client → Server | 채팅방 입장               |
| `chat:leave-room`     | Client → Server | 채팅방 퇴장               |
| `chat:send-message`   | Client → Server | 메시지 전송               |
| `chat:delete-message` | Client → Server | 메시지 삭제 (ADMIN 전용)  |
| `chat:message`        | Server → Room   | 메시지 브로드캐스트       |
| `chat:history`        | Server → Client | 최근 50개 메시지 히스토리 |

- **Redis 히스토리**: `chat:{liveId}:history` 키, 최대 100개 메시지, 24시간 TTL
- **Rate Limit**: 20 messages / 10초
- **메시지 최대 길이**: 500자, HTML 태그 strip (XSS 방지)
- **사용자 표시명**: `instagramId` 사용, 없으면 '익명'

#### `/streaming` — 시청자 수 추적

| 이벤트                 | 방향            | 설명           |
| ---------------------- | --------------- | -------------- |
| `stream:viewer:join`   | Client → Server | 시청 시작      |
| `stream:viewer:leave`  | Client → Server | 시청 종료      |
| `stream:viewer:update` | Server → Room   | 시청자 수 갱신 |
| `stream:ended`         | Server → Room   | 방송 종료 알림 |

- **시청자 카운트**: Redis Set (`stream:{streamKey}:viewer_ids`) — userId 기반으로 중복 카운트 방지
- disconnect 시 자동으로 시청자 Set에서 제거

### 이벤트 브리지 (EventEmitter2)

NestJS `EventEmitter2`를 통해 HTTP 요청 → WebSocket 브로드캐스트를 연결:

| 이벤트           | 소스             | 동작                                                                |
| ---------------- | ---------------- | ------------------------------------------------------------------- |
| `stream:ended`   | StreamingService | `/streaming` 네임스페이스에 방송 종료 브로드캐스트 + 예정 방송 갱신 |
| `stream:started` | StreamingService | 예정 방송 목록 갱신                                                 |
| `stream:created` | StreamingService | 예정 방송 목록 갱신                                                 |
| `order:paid`     | OrdersService    | 결제 알림 브로드캐스트 (`order:purchase:notification`)              |

### 인증 및 보안

- **모든 소켓 연결**: `authenticateSocket()` 미들웨어로 JWT 인증 필수
- **Rate Limiting**: `rateLimitCheck()` 미들웨어 — 이벤트별 윈도우/최대 횟수 설정
- **Redis 어댑터**: 멀티 인스턴스 환경에서 메시지 동기화

---

## 6. 스트리밍 인프라

### 로컬 개발 환경 (SRS v6)

SRS(Simple Realtime Server) v6을 Docker로 실행. 설정: `infrastructure/docker/srs/srs.conf`

| 포트 | 프로토콜 | 용도                |
| ---- | -------- | ------------------- |
| 1935 | RTMP     | OBS/인코더 인제스트 |
| 8080 | HTTP     | HTTP-FLV + HLS 재생 |
| 1985 | HTTP     | SRS API (모니터링)  |

#### SRS 핵심 설정

- **HTTP-FLV**: `/live/[app]/[stream].flv` 마운트 (저지연 기본 출력)
- **HLS**: `hls_fragment 1s`, `hls_window 4s`, `hls_wait_keyframe on`
- **GOP 캐시**: `gop_cache on`, 최대 30 프레임
- **TCP Nodelay**: 저지연 튜닝 활성
- **워커 스레드**: 4개 (멀티코어 활용)

#### SRS 웹훅 콜백

| 웹훅           | 엔드포인트                          | 동작                                        |
| -------------- | ----------------------------------- | ------------------------------------------- |
| `on_publish`   | `POST /api/streaming/srs-auth`      | 스트림 키 인증 + `LiveStream.status → LIVE` |
| `on_unpublish` | `POST /api/streaming/srs-done`      | `LiveStream.status → OFFLINE` + 통계 저장   |
| `heartbeat`    | `POST /api/streaming/srs-heartbeat` | 9.9초 간격 헬스체크                         |

### 프로덕션 환경 (AWS)

AWS CDK 코드: `infrastructure/aws-cdk/`

```
OBS → NLB (1935 RTMP) → ECS Fargate (Nginx RTMP + FFmpeg) → ALB (8080 HTTP) → CloudFront CDN → HLS.js
```

- **인제스트**: Network Load Balancer → ECS Fargate 컨테이너
- **배포**: CloudFront CDN으로 HLS 전달
- CDK 출력: `RTMP_SERVER_URL`, `HLS_SERVER_URL`

### 비디오 플레이어 구조

```
VideoPlayer
  ├── mpegts.js (HTTP-FLV) ← 1순위 저지연
  │     └── /live/live/{streamKey}.flv
  └── hls.js (HLS) ← 2순위 폴백
        └── /hls/{streamKey}.m3u8
```

- `onStreamStateChange`: `VideoStreamEvent` 발생 → `useLiveLayoutMachine` FSM 상태 전이
- 개발 모드: KPI 오버레이 (first-frame ms, rebuffer count, stall duration, reconnect count)

### 멀티 플랫폼 동시 송출 (ReStream)

FFmpeg 기반으로 YouTube, Instagram, TikTok, Custom RTMP 서버에 동시 송출.

- `ReStreamTarget`: 사용자별 송출 대상 관리
- `ReStreamLog`: 송출 상태 추적 (IDLE/CONNECTING/ACTIVE/FAILED/STOPPED)
- 오디오 뮤트 옵션, 자동 재시작 카운트

### Nginx 프록시 경로

| 경로                         | 대상                  | 용도                  |
| ---------------------------- | --------------------- | --------------------- |
| `/live/live/{streamKey}.flv` | `srs:8080/live/live/` | HTTP-FLV (저지연)     |
| `/hls/{streamKey}.m3u8`      | `srs:8080/live/`      | HLS (Safari/iOS 폴백) |

> `/live/live/` 경로는 Next.js `/live` 페이지 라우트와 충돌 방지를 위해 의도적으로 구체적으로 설정됨.

---

## 7. 배포 및 운영

### Docker Compose 환경

#### 로컬 개발 (`docker-compose.yml`)

| 서비스     | 이미지               | 포트                     |
| ---------- | -------------------- | ------------------------ |
| PostgreSQL | `postgres:16-alpine` | 5432                     |
| Redis      | `redis:7-alpine`     | 6379                     |
| SRS        | `ossrs/srs:6`        | 1935 (RTMP), 8080 (HTTP) |

Redis 설정: AOF 영속화, 256MB 메모리 제한, allkeys-lru 정책.

#### 스테이징 (`docker-compose.staging.yml`)

로컬 설정을 오버라이드하여 추가 서비스 포함:

- **Backend**: GHCR 이미지, PostgreSQL/Redis healthy 대기
- **Frontend**: GHCR 이미지, Backend 의존
- **Nginx**: 프록시 + ACME 인증서 경로
- **SRS**: 동일 v6 미디어 서버

네트워크: `dorami-internal` (bridge)

#### 프로덕션 (`docker-compose.prod.yml`)

스테이징과 유사하나 프로덕션 전용 환경 변수 및 리소스 설정.

### CI/CD 파이프라인

#### GitHub Actions 워크플로우

| 워크플로우                            | 트리거            | 역할                                                             |
| ------------------------------------- | ----------------- | ---------------------------------------------------------------- |
| `ci.yml`                              | PR → main/develop | 변경 감지 → 백엔드 CI + 프론트엔드 CI + Docker 빌드 + Trivy 스캔 |
| `build-images.yml`                    | -                 | Docker 이미지 빌드/푸시                                          |
| `deploy-staging.yml`                  | -                 | 스테이징 환경 배포                                               |
| `deploy-production.yml`               | -                 | 프로덕션 수동 배포                                               |
| `deploy-production-auto.yml`          | -                 | 프로덕션 자동 배포                                               |
| `deploy-production-frontend-auto.yml` | -                 | 프론트엔드만 자동 배포                                           |
| `staging-maintenance.yml`             | -                 | 스테이징 유지보수                                                |
| `prod-maintenance.yml`                | -                 | 프로덕션 유지보수                                                |
| `streaming-soak.yml`                  | -                 | 스트리밍 부하 테스트                                             |

#### CI 상세 (`ci.yml`)

1. **변경 감지** (`dorny/paths-filter`): backend / frontend / infra 별 경로 필터
2. **백엔드 CI**: PostgreSQL + Redis 서비스 컨테이너 → 의존성 설치 → Prisma generate/migrate → lint + type-check (병렬) → unit test → E2E test → build
3. **프론트엔드 CI**: 의존성 설치 → lint + type-check (병렬) → build
4. **Docker 빌드**: 매트릭스 (backend/frontend) 병렬 빌드, BuildKit 캐시
5. **보안 스캔**: Trivy (CRITICAL + HIGH)

### 환경 변수

#### 필수 (백엔드 시작 불가)

| 변수                        | 설명                   |
| --------------------------- | ---------------------- |
| `DATABASE_URL`              | PostgreSQL 연결 문자열 |
| `JWT_SECRET`                | JWT 서명 키            |
| `REDIS_HOST` / `REDIS_PORT` | Redis 연결             |

#### 주요 선택

| 변수                     | 설명                                        |
| ------------------------ | ------------------------------------------- |
| `PROFILE_ENCRYPTION_KEY` | 64자 hex, 배송지 AES-256-GCM 암호화         |
| `ADMIN_EMAILS`           | 카카오 첫 로그인 시 ADMIN 역할 자동 할당    |
| `CSRF_ENABLED=false`     | CSRF 비활성화 (개발/테스트용)               |
| `CORS_ORIGINS`           | 허용 오리진 (기본: `http://localhost:3000`) |
| `APP_ENV=production`     | Swagger 문서 비활성화                       |

#### 프론트엔드

| 변수                           | 설명                     |
| ------------------------------ | ------------------------ |
| `NEXT_PUBLIC_WS_URL`           | Socket.IO 서버 URL       |
| `BACKEND_URL`                  | Next.js 프록시 대상      |
| `MEDIA_SERVER_URL`             | SRS 미디어 서버 URL      |
| `NEXT_PUBLIC_KAKAO_JS_KEY`     | 카카오 JavaScript SDK 키 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push VAPID 공개키    |

### Pre-commit 훅

Husky + lint-staged:

- `backend/**/*.ts` → ESLint fix + Prettier
- `client-app/**/*.{ts,tsx}` → Prettier
- `*.{json,md}` → Prettier

### 커밋 컨벤션

```
feat:     새 기능
fix:      버그 수정
refactor: 동작 변경 없는 코드 수정
test:     테스트 추가/수정
docs:     문서만 수정
style:    포맷팅, 로직 변경 없음
chore:    빌드, 설정, 의존성 변경
```

---

## 8. 아키텍처 다이어그램 및 데이터 흐름

### 전체 시스템 아키텍처

```
                    ┌─────────────┐
                    │   CDN/DNS   │
                    │ doremi-live │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    Nginx    │
                    │  (Reverse   │
                    │   Proxy)    │
                    └──┬──┬──┬───┘
                       │  │  │
          ┌────────────┘  │  └────────────┐
          ▼               ▼               ▼
   ┌──────────┐    ┌──────────┐    ┌──────────┐
   │ Next.js  │    │ NestJS   │    │   SRS    │
   │ Frontend │    │ Backend  │    │  Media   │
   │ :3000    │    │ :3001    │    │  Server  │
   └──────────┘    └──┬──┬───┘    └──┬──┬────┘
                      │  │           │  │
                      │  │           │  └─── RTMP :1935 (OBS 인제스트)
                      │  │           └────── HTTP :8080 (FLV/HLS 재생)
                      │  │
              ┌───────┘  └───────┐
              ▼                  ▼
       ┌──────────┐       ┌──────────┐
       │PostgreSQL│       │  Redis   │
       │  :5432   │       │  :6379   │
       └──────────┘       └──────────┘
```

### 요청/응답 흐름

```
1. 사용자 요청
   Browser → Nginx → Next.js (SSR/CSR)
                   → Next.js Proxy → NestJS API → Prisma → PostgreSQL

2. 인증 흐름
   Browser → Kakao OAuth → Callback → NestJS → JWT 발급 → HttpOnly Cookie

3. API 응답 래핑
   Controller return → TransformInterceptor → { data, success, timestamp }
   Controller throw  → BusinessExceptionFilter → { statusCode, errorCode, message }
```

### 스트리밍 흐름

```
1. 방송 시작
   OBS (RTMP) → SRS :1935 → on_publish webhook → NestJS → DB(LIVE)
                                                        → EventEmitter('stream:started')
                                                        → Socket.IO broadcast

2. 시청
   Browser → VideoPlayer
           → HTTP-FLV: Nginx → SRS :8080/live/live/{key}.flv (저지연)
           → HLS 폴백: Nginx → SRS :8080/live/{key}.m3u8

3. 방송 종료
   OBS 중지 → SRS → on_unpublish webhook → NestJS → DB(OFFLINE)
                                                  → EventEmitter('stream:ended')
                                                  → Socket.IO('stream:ended') to room
```

### WebSocket 통신 흐름

```
1. 연결
   Browser → Socket.IO Client → Nginx (ws upgrade) → Socket.IO Server
                                                    → authenticateSocket(JWT)
                                                    → Redis Adapter (멀티 인스턴스)

2. 채팅 메시지
   Client → chat:send-message → Rate Limit Check → HTML Strip → Redis History
                              → Broadcast to Room (chat:message)

3. 시청자 추적
   Client → stream:viewer:join → Redis Set(sAdd userId)
                               → sCard → viewer count
                               → Broadcast (stream:viewer:update)
```

---

## 9. 주요 기술 결정사항 (ADR)

### Socket.IO 수동 부트스트랩

- **결정**: NestJS 표준 게이트웨이 대신 `main.ts`에서 직접 Socket.IO 서버 생성
- **이유**: NestJS 게이트웨이 DI 와이어링이 `main.ts` 이후 모듈 초기화 타이밍과 맞지 않아 Redis 어댑터 연결 제어가 어려웠음
- **Trade-off**: DI 통합 약화 vs 완전한 생명주기 제어

### SRS v6 (Nginx RTMP 대체)

- **결정**: 로컬/스테이징에서 Nginx RTMP를 SRS로 교체
- **이유**: HTTP-FLV 네이티브 지원으로 저지연 달성, 웹훅 콜백 내장, 설정 단순
- **Trade-off**: SRS 학습 곡선 vs 저지연 + 기능 통합

### 은행 송금 (무통장 입금) 결제

- **결정**: PG사 연동 없이 은행 송금 + 관리자 수동 확인
- **이유**: MVP 단계에서 PG사 수수료 회피, 빠른 출시. US 시장에서 Zelle도 병행
- **Trade-off**: 관리자 수작업 vs PG 연동 비용/복잡도

### HTTP-FLV 우선 + HLS 폴백

- **결정**: 비디오 재생 시 HTTP-FLV를 1순위로 시도
- **이유**: HTTP-FLV는 HLS 대비 1-3초 더 낮은 지연시간
- **Trade-off**: Safari/iOS 미지원 → HLS 자동 폴백 구현

### 주문 ID 포맷 (ORD-YYYYMMDD-XXXXX)

- **결정**: UUID 대신 날짜 기반 시퀀셜 ID
- **이유**: 고객/관리자가 읽기 쉽고 날짜로 정렬 용이
- **Trade-off**: 시퀀스 관리 복잡도 vs 가독성

### 배송지 암호화 (AES-256-GCM)

- **결정**: 개인정보(주소) DB 저장 시 필드 레벨 암호화
- **이유**: 한국 개인정보보호법 및 US PII 보호 요건 대응
- **Trade-off**: 조회 시 복호화 오버헤드 vs 보안 컴플라이언스

---

## 10. 개발자 가이드

### 로컬 환경 셋업

```bash
# 1. 사전 요구사항
# Node.js >= 20, npm >= 10, Docker Desktop

# 2. 저장소 클론
git clone <repository-url>
cd dorami

# 3. 인프라 실행 (PostgreSQL, Redis, SRS)
npm run docker:up

# 4. 의존성 설치 (shared-types 자동 빌드)
npm install

# 5. 환경변수 설정
# backend/.env 생성 (최소 필수):
#   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/live_commerce
#   JWT_SECRET=your-dev-secret
#   REDIS_HOST=localhost
#   REDIS_PORT=6379

# 6. 데이터베이스 마이그레이션
npm run prisma:migrate

# 7. 개발 서버 실행
npm run dev:all    # 백엔드 + 프론트엔드 동시 실행
```

### 개발 흐름

1. `develop` 브랜치에서 feature 브랜치 생성
2. 코드 작성 → lint-staged 자동 실행 (커밋 시)
3. PR 생성 → CI 자동 실행 (변경 감지 기반)
4. 코드 리뷰 → `develop` 머지
5. `develop` → `main` 머지 시 프로덕션 배포

### 주요 명령어

```bash
# 개발
npm run dev:all              # 백엔드 + 프론트엔드 동시
npm run dev:backend          # NestJS watch mode
npm run dev:client           # Next.js dev server

# 테스트
npm run test:backend                       # 유닛 테스트
cd backend && npx jest path/to/file.spec.ts  # 단일 파일
cd client-app && npx playwright test       # E2E 전체

# 데이터베이스
npm run prisma:generate      # 스키마 변경 후 클라이언트 재생성
npm run prisma:migrate       # 마이그레이션 생성/적용
npm run prisma:studio        # Prisma Studio GUI

# 빌드
npm run build:all            # shared-types → client → backend 순서

# 코드 품질
npm run lint:all             # ESLint 양쪽 워크스페이스
npm run format               # Prettier 포맷팅
npm run type-check:all       # tsc --noEmit 전체
```

### 문제 해결

| 문제                   | 해결                                                                   |
| ---------------------- | ---------------------------------------------------------------------- |
| 백엔드 시작 실패       | `DATABASE_URL`, `JWT_SECRET`, `REDIS_HOST`, `REDIS_PORT` 환경변수 확인 |
| Prisma 클라이언트 에러 | `npm run prisma:generate` 재실행                                       |
| Socket.IO 연결 실패    | Redis 실행 여부 확인 (`docker ps`), CORS 오리진 설정 확인              |
| 방송 시작 안됨         | SRS 컨테이너 실행 확인 (`docker logs live-commerce-srs`)               |
| CSRF 에러 (개발)       | `CSRF_ENABLED=false` 환경변수 설정                                     |
| 배송지 암호화 에러     | `PROFILE_ENCRYPTION_KEY` (64자 hex) 설정 확인                          |

---

## 11. 핵심 요약 및 다음 단계

### 핵심 요약

Dorami는 NestJS + Next.js + SRS를 핵심으로 하는 라이브 커머스 MVP 플랫폼이다. 모노레포(npm workspaces)로 관리되며, `@live-commerce/shared-types` 패키지로 프론트엔드-백엔드 간 타입 안전성을 보장한다.

**핵심 강점**:

- 저지연 라이브 스트리밍 (HTTP-FLV 우선 + HLS 폴백)
- Socket.IO + Redis 어댑터 기반 실시간 통신 (채팅, 시청자 수, 상품 업데이트)
- 장바구니 타이머(10분) + 대기열 시스템으로 한정 수량 상품 공정 구매
- 리워드 포인트 시스템 (적립/사용/만료)
- FFmpeg 멀티 플랫폼 동시 송출
- AES-256-GCM 개인정보 암호화

**아키텍처 특이점**:

- Socket.IO가 NestJS 표준 DI가 아닌 `main.ts` 수동 부트스트랩 (Redis 어댑터 제어 목적)
- 주문 ID가 UUID가 아닌 `ORD-YYYYMMDD-XXXXX` 시퀀셜 포맷
- 결제가 PG사 연동 없이 은행 송금 + 관리자 수동 확인
- 프론트엔드 라이브 페이지가 멀티 FSM (`useLiveLayoutMachine`)으로 복잡한 상태 관리

### 기술 부채/개선 영역

- Socket.IO 수동 부트스트랩 코드가 `main.ts`에 집중 (900+ 줄) — 모듈 분리 고려
- E2E 테스트 CI에서 `continue-on-error: true` — 안정화 필요
- PG사 연동으로 자동 결제 확인 전환
- 프로덕션 스트리밍 모니터링 및 자동 스케일링 강화
