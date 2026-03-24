# 도레미 마켓 (Doremi Market)

원셀러 라이브 커머스 플랫폼 — 실시간 방송으로 상품을 판매하는 한국어 이커머스 MVP.

**Production:** https://www.doremi-live.com
**Current Version:** v1.3.1

## 기술 스택

| 영역          | 기술                                                               |
| ------------- | ------------------------------------------------------------------ |
| **Frontend**  | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4.0    |
| **Backend**   | NestJS 11, Prisma 6, PostgreSQL 16, Redis 7                        |
| **Real-time** | Socket.IO 4.8 (채팅 + 재고 + 시청자 수), Redis Adapter             |
| **Streaming** | SRS v6 (RTMP ingest → HTTP-FLV + HLS), Nginx reverse proxy         |
| **State**     | Zustand (클라이언트), TanStack Query v5 (서버), Socket.IO (실시간) |
| **Auth**      | Kakao OAuth → JWT (Access 1h + Refresh 7d, HttpOnly cookies)       |
| **Infra**     | Docker Compose, GitHub Actions CI/CD, GHCR                         |
| **Shared**    | `@live-commerce/shared-types` (enums, helpers, interfaces)         |

## 모노레포 구조

```
dorami/
├── backend/                    # NestJS API (port 3001)
│   ├── src/modules/            # auth, products, cart, orders, streaming, chat, ...
│   ├── prisma/schema.prisma    # DB 스키마
│   └── Dockerfile
├── client-app/                 # Next.js (port 3000)
│   ├── src/app/                # App Router pages
│   ├── src/app/admin/          # 관리자 대시보드
│   ├── src/app/live/           # 라이브 시청 페이지
│   ├── src/components/         # UI 컴포넌트
│   ├── src/lib/                # API client, hooks, store
│   ├── src/hooks/              # WebSocket hooks
│   ├── src/middleware.ts       # 인증 + 인앱 브라우저 처리
│   └── Dockerfile
├── packages/shared-types/      # 공유 타입 + 유틸리티
├── infrastructure/
│   ├── docker/nginx/           # Nginx 설정
│   └── docker/srs/             # SRS 미디어 서버 설정
├── docker-compose.base.yml     # 공통 서비스 (postgres, redis, srs)
├── docker-compose.staging.yml  # Staging 오버레이
├── docker-compose.prod.yml     # Production 오버레이
└── .github/workflows/          # CI/CD 파이프라인
```

## 빠른 시작

```bash
# 1. 설치
npm install              # 모든 워크스페이스 의존성 + shared-types 빌드

# 2. 인프라
npm run docker:up        # PostgreSQL 16, Redis 7, SRS v6

# 3. DB
npm run prisma:migrate   # 마이그레이션 적용
npm run prisma:generate  # Prisma Client 생성

# 4. 개발 서버
npm run dev:all          # Backend(3001) + Frontend(3000) 동시 실행
```

## 주요 기능

### 사용자

- 라이브 방송 시청 (HTTP-FLV 저지연 / HLS 폴백)
- 실시간 채팅 (Socket.IO `/chat` 네임스페이스)
- 실시간 재고 + 품절 알림 (WebSocket)
- 장바구니 (10분 타이머 옵션, 품절 상품 표시)
- 카카오 OAuth 로그인
- 주문 + 결제 확인
- Web Push 알림

### 관리자

- 라이브 방송 관리 (OBS → RTMP → SRS)
- 상품 CRUD (소수점 가격, 색상/사이즈 옵션, 이미지 갤러리)
- 주문 관리 (상태 변경, 배송 추적, 엑셀 다운로드)
- 실시간 대시보드 (시청자 수, 매출, 주문)
- 채팅 관리 (메시지 삭제)
- 포인트 / 정산 시스템

## 아키텍처

### 스트리밍

```
OBS → RTMP(1935) → SRS v6 → HTTP-FLV/HLS(8080) → Nginx → Client
```

### WebSocket 네임스페이스

| 네임스페이스 | 용도                                           |
| ------------ | ---------------------------------------------- |
| `/`          | 스트림 room join/leave, 구매 알림 브로드캐스트 |
| `/chat`      | 채팅 (Redis 히스토리, rate limit 20msg/10s)    |
| `/streaming` | 시청자 수 (Redis 카운터)                       |

### 인증 흐름

```
카카오 로그인 → JWT 발급 → HttpOnly cookie (sameSite: lax)
→ Access token 만료 → auto-refresh (coalesced, deduplicated)
→ Refresh 실패 → forceLogout → /login
```

## 배포

### CI/CD 파이프라인

| Workflow                | 트리거            | 역할                                                 |
| ----------------------- | ----------------- | ---------------------------------------------------- |
| `ci.yml`                | PR, push          | lint + type-check + test + Docker build + Trivy scan |
| `build-images.yml`      | push main         | Docker 이미지 빌드 → GHCR push                       |
| `deploy-staging.yml`    | push develop      | 자동 staging 배포                                    |
| `deploy-production.yml` | workflow_dispatch | 수동 prod 배포 (version tag 필수)                    |

### Production 배포

```bash
# 1. main에 머지
git checkout main && git merge develop

# 2. 태그 생성 (main HEAD에)
git tag v1.3.1 && git push origin v1.3.1

# 3. GitHub Actions에서 수동 트리거
gh workflow run deploy-production.yml --ref main -f version="v1.3.1"
```

### 환경별 Compose

```bash
# Staging
docker compose -f docker-compose.base.yml -f docker-compose.staging.yml up -d

# Production
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml up -d
```

## 개발 명령어

| 명령어                   | 설명                           |
| ------------------------ | ------------------------------ |
| `npm run dev:all`        | Backend + Frontend 동시 실행   |
| `npm run build:all`      | 전체 빌드                      |
| `npm run test:backend`   | Jest 유닛 테스트               |
| `npm run lint:all`       | ESLint 전체                    |
| `npm run type-check:all` | TypeScript 타입 체크           |
| `npm run prisma:studio`  | Prisma Studio (localhost:5555) |
| `npm run docker:up`      | PostgreSQL + Redis + SRS 시작  |
| `npm run docker:down`    | 인프라 중지                    |

### E2E 테스트 (Playwright)

```bash
cd client-app
npx playwright test --project=user    # 사용자 플로우
npx playwright test --project=admin   # 관리자 플로우
npx playwright test --ui              # 인터랙티브 모드
```

## 포트 구성

| 포트 | 서비스                    |
| ---- | ------------------------- |
| 3000 | Next.js (사용자 + 관리자) |
| 3001 | NestJS API + WebSocket    |
| 5432 | PostgreSQL                |
| 6379 | Redis                     |
| 1935 | SRS RTMP (OBS 인제스트)   |
| 8080 | SRS HTTP-FLV/HLS          |
| 5555 | Prisma Studio             |

## 디자인 시스템

**테마:** Dark mode + Hot Pink accent (`#FF007A`)

| 토큰           | 값                   |
| -------------- | -------------------- |
| Primary Accent | `#FF007A` (Hot Pink) |
| Background     | `#121212`            |
| Content BG     | `#1E1E1E`            |
| Text Primary   | `#FFFFFF`            |
| Text Secondary | `#A0A0A0`            |
| Success        | `#34C759`            |
| Error          | `#FF3B30`            |
| Warning        | `#FF9500`            |

**폰트:** Pretendard (CDN)

## 라이선스

Private Project
