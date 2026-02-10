# Dorami Live Commerce - Staging 테스트 & Production 분리 가이드

## 목차
1. [인프라 현황](#1-인프라-현황)
2. [환경 분리 (Staging vs Production)](#2-환경-분리)
3. [DB 분리 방안](#3-db-분리-방안)
4. [Staging 초기 설정](#4-staging-초기-설정)
5. [전체 기능 테스트 가이드](#5-전체-기능-테스트-가이드)
6. [배포 프로세스](#6-배포-프로세스)
7. [트러블슈팅](#7-트러블슈팅)

---

## 1. 인프라 현황

### 서비스 구성 (Docker Compose)
| 서비스 | 이미지 | 포트 | 역할 |
|--------|--------|------|------|
| postgres | postgres:16-alpine | 5432 | 메인 DB |
| redis | redis:7-alpine | 6379 | 캐시, 세션, WebSocket |
| backend | dorami-backend | 3001 | NestJS API |
| frontend | dorami-frontend | 3000 | Next.js SSR |
| nginx | nginx:alpine | 80, 443 | 리버스 프록시 |
| rtmp | tiangolo/nginx-rtmp | 1935, 8080 | 라이브 스트리밍 |

### Staging 서버
- **IP**: 54.180.94.30
- **SSH**: `ssh -i dorami-staging.pem ubuntu@54.180.94.30`
- **접속 URL**: http://54.180.94.30
- **API**: http://54.180.94.30/api/v1
- **RTMP**: rtmp://54.180.94.30:1935/live/{stream_key}
- **HLS**: http://54.180.94.30:8080/hls/{stream_key}.m3u8

---

## 2. 환경 분리

### 2.1 환경별 구성표

| 항목 | Staging | Production |
|------|---------|------------|
| 서버 | EC2 t3.medium (54.180.94.30) | EC2 t3.large 또는 ECS Fargate |
| 도메인 | staging.dorami.kr | dorami.kr |
| DB | Docker PostgreSQL (같은 서버) | **RDS PostgreSQL** (별도 인스턴스) |
| Redis | Docker Redis (같은 서버) | **ElastiCache Redis** (별도) |
| 스토리지 | 로컬 디스크 (/uploads) | **S3 버킷** |
| SSL | Let's Encrypt | ACM (AWS Certificate Manager) |
| CDN | 없음 | **CloudFront** |
| 브랜치 | `main` (자동) | `release/*` 태그 |
| env 파일 | `.env.staging` | `.env.production` |
| Docker Compose | `docker-compose.staging.yml` | `docker-compose.production.yml` |

### 2.2 환경변수 전체 목록

```bash
# ═══════════════════════════════════
# .env.staging (Staging 환경)
# ═══════════════════════════════════

# ── Database ──
DB_PASSWORD=<staging_db_password>

# ── Redis ──
REDIS_PASSWORD=<staging_redis_password>

# ── JWT ──
JWT_SECRET=<최소32자_staging_jwt_secret>
# JWT_REFRESH_SECRET 는 더이상 사용 안 함 (코드리뷰에서 제거됨)

# ── 암호화 ──
PROFILE_ENCRYPTION_KEY=<32자_hex_암호화키>
# 생성: openssl rand -hex 16

# ── Kakao OAuth ──
KAKAO_CLIENT_ID=<카카오_REST_API_키>
KAKAO_CLIENT_SECRET=<카카오_Client_Secret>
KAKAO_CALLBACK_URL=http://54.180.94.30/api/v1/auth/kakao/callback
KAKAO_JS_KEY=<카카오_JavaScript_키>

# ── URLs ──
FRONTEND_URL=http://54.180.94.30
WS_URL=ws://54.180.94.30

# ── 입금 계좌 ──
BANK_NAME=KB국민은행
BANK_ACCOUNT_NUMBER=<계좌번호>
BANK_ACCOUNT_HOLDER=<예금주>

# ── Push Notifications (선택) ──
# VAPID_PUBLIC_KEY=<vapid_public_key>
# VAPID_PRIVATE_KEY=<vapid_private_key>
# VAPID_SUBJECT=mailto:admin@dorami.kr
```

### 2.3 Production 추가 변수

```bash
# ═══ Production 전용 ═══
NODE_ENV=production
DOMAIN=dorami.kr
CORS_ORIGINS=https://dorami.kr

# ── RDS (외부 DB) ──
DATABASE_URL=postgresql://dorami:<password>@dorami-prod.xxx.ap-northeast-2.rds.amazonaws.com:5432/live_commerce

# ── ElastiCache (외부 Redis) ──
REDIS_URL=redis://:${REDIS_PASSWORD}@dorami-prod.xxx.cache.amazonaws.com:6379

# ── S3 이미지 업로드 ──
AWS_S3_BUCKET=dorami-uploads
AWS_REGION=ap-northeast-2

# ── Sentry 에러 추적 ──
SENTRY_DSN=https://xxx@sentry.io/xxx

# ── 로깅 ──
LOG_LEVEL=warn
```

---

## 3. DB 분리 방안

### 3.1 현재 상태 (Staging)
- PostgreSQL이 Docker 컨테이너 내부에서 실행
- 데이터는 Docker volume `postgres_data`에 저장
- 서버 재시작해도 데이터 유지

### 3.2 Production DB 분리: AWS RDS

**왜 분리하는가?**
- 자동 백업 (Point-in-time Recovery)
- Multi-AZ 고가용성
- 성능 모니터링 (CloudWatch)
- 서버와 독립적 스케일링

**RDS 설정:**
```
엔진: PostgreSQL 16
인스턴스: db.t3.micro (시작) → db.t3.medium (스케일업)
스토리지: 20GB gp3 (자동확장)
Multi-AZ: 비활성 (비용절감) → 활성 (프로덕션)
백업: 7일 보관
VPC: backend와 같은 VPC 내 private subnet
```

**docker-compose.production.yml 변경:**
```yaml
services:
  # postgres 서비스 제거 (RDS 사용)
  # redis 서비스 제거 (ElastiCache 사용)

  backend:
    environment:
      DATABASE_URL: postgresql://dorami:${DB_PASSWORD}@${RDS_ENDPOINT}:5432/live_commerce
      REDIS_URL: redis://:${REDIS_PASSWORD}@${REDIS_ENDPOINT}:6379
```

### 3.3 Staging ↔ Production DB 데이터 이관

```bash
# Staging DB 덤프
docker compose -f docker-compose.staging.yml --env-file .env.staging \
  exec postgres pg_dump -U dorami live_commerce > dump_staging.sql

# Production RDS에 복원
psql -h dorami-prod.xxx.rds.amazonaws.com -U dorami -d live_commerce < dump_staging.sql
```

### 3.4 DB 마이그레이션 관리

현재 `prisma db push`를 사용 중. Production에서는 마이그레이션 파일 관리 필요:

```bash
# 1. 마이그레이션 파일 생성 (로컬)
npx prisma migrate dev --name add_new_feature

# 2. Staging 적용
docker compose exec backend npx prisma migrate deploy

# 3. Production 적용 (RDS)
DATABASE_URL=postgresql://... npx prisma migrate deploy
```

---

## 4. Staging 초기 설정

### 4.1 EC2 서버 접속

```bash
ssh -i dorami-staging.pem ubuntu@54.180.94.30
cd /home/ubuntu/dorami
```

### 4.2 DB 시드 (초기 데이터)

```bash
# Seed 실행 — Admin 유저 + 테스트 상품 10개 + 라이브 스트림 2개 생성
docker compose -f docker-compose.staging.yml --env-file .env.staging \
  exec backend npx prisma db seed
```

시드로 생성되는 데이터:
| 항목 | 내용 |
|------|------|
| Admin 유저 | admin@dorami.shop / ADMIN 역할 |
| 테스트 유저 | test@example.com / USER 역할 |
| 라이브 스트림 | 2개 (PENDING 상태) |
| 상품 | 10개 (뷰티 5, 패션/테크 5) |
| 알림 템플릿 | 4개 (주문확인, 입금독촉, 입금확인, 예약알림) |
| 시스템 설정 | 공지 배너 기본값 |

### 4.3 카카오 OAuth 설정

1. [Kakao Developers](https://developers.kakao.com/) 접속
2. 앱 생성 → REST API 키, JavaScript 키, Client Secret 확인
3. 카카오 로그인 활성화
4. Redirect URI 등록: `http://54.180.94.30/api/v1/auth/kakao/callback`
5. `.env.staging` 업데이트:
```bash
KAKAO_CLIENT_ID=<REST_API_키>
KAKAO_CLIENT_SECRET=<Client_Secret>
KAKAO_CALLBACK_URL=http://54.180.94.30/api/v1/auth/kakao/callback
KAKAO_JS_KEY=<JavaScript_키>
```
6. 서비스 재시작: `./scripts/deploy-staging.sh restart`

### 4.4 카카오 없이 테스트 (임시)

카카오 API 키가 없는 경우, DB에 직접 유저를 만들어 쿠키를 수동 설정:

```bash
# Admin 유저 직접 생성
docker compose -f docker-compose.staging.yml --env-file .env.staging \
  exec backend node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.upsert({
  where: { kakaoId: 'admin-test-001' },
  update: {},
  create: {
    kakaoId: 'admin-test-001',
    name: '관리자',
    email: 'admin@test.com',
    role: 'ADMIN',
    status: 'ACTIVE'
  }
}).then(u => { console.log('Admin created:', u.id); p.\$disconnect(); });
"
```

---

## 5. 전체 기능 테스트 가이드

### 5.1 인증 (Epic 2)

| # | 테스트 항목 | 방법 | 확인 포인트 |
|---|-----------|------|------------|
| 1 | 카카오 로그인 | `/login` → 카카오 로그인 버튼 클릭 | 카카오 인증 후 리디렉트 |
| 2 | 프로필 완성 | 로그인 후 `/profile/register` | Instagram ID, 입금자명 입력 |
| 3 | 토큰 갱신 | 15분 이상 대기 후 API 호출 | 자동으로 refresh |
| 4 | 로그아웃 | 프로필 → 로그아웃 | 쿠키 삭제, 홈으로 이동 |
| 5 | 관리자 접근 | `/admin` 접속 | ADMIN 역할이면 대시보드, 아니면 홈으로 |

**API 테스트:**
```bash
# 헬스체크
curl http://54.180.94.30/api/v1/health

# 현재 유저 (인증 필요 - 쿠키)
curl -b "access_token=<jwt>" http://54.180.94.30/api/v1/auth/me
```

---

### 5.2 라이브 스트리밍 (Epic 3)

| # | 테스트 항목 | 방법 | 확인 포인트 |
|---|-----------|------|------------|
| 1 | 스트림 생성 | Admin → 방송관리 → 새 방송 | stream key 생성됨 |
| 2 | OBS 연결 | OBS에 RTMP URL 입력 | 방송 시작, HLS 생성 |
| 3 | 라이브 시청 | `/live/{streamKey}` 접속 | 비디오 재생, 시청자수 |
| 4 | 방송 종료 | Admin에서 방송 종료 | 상태 → OFFLINE |

**OBS 설정:**
```
서버: rtmp://54.180.94.30:1935/live
스트림 키: <admin에서 생성한 키>
```

**HLS 확인:**
```bash
# 방송 중일 때
curl http://54.180.94.30:8080/hls/<stream_key>.m3u8
```

---

### 5.3 실시간 채팅 (Epic 4)

| # | 테스트 항목 | 방법 | 확인 포인트 |
|---|-----------|------|------------|
| 1 | 채팅 입장 | 라이브 화면에서 자동 | "입장" 메시지 표시 |
| 2 | 메시지 전송 | 채팅 입력창에 메시지 입력 | 실시간 전달 |
| 3 | XSS 방지 | `<script>alert(1)</script>` 입력 | HTML 태그 제거 |
| 4 | 글자수 제한 | 500자 초과 메시지 | 에러 반환 |

**WebSocket 테스트 (wscat):**
```bash
# 설치
npm i -g wscat

# 연결
wscat -c "ws://54.180.94.30/socket.io/?transport=websocket"
```

---

### 5.4 상품 관리 (Epic 5)

| # | 테스트 항목 | 방법 | 확인 포인트 |
|---|-----------|------|------------|
| 1 | 상품 등록 | Admin → 상품관리 → 새 상품 | 이름/가격/재고/이미지 |
| 2 | 이미지 업로드 | 상품 등록 시 이미지 선택 | 5MB 이하, jpg/png/webp |
| 3 | 상품 수정 | 상품 목록 → 수정 | 모든 필드 수정 가능 |
| 4 | 품절 처리 | 상품 → 품절 버튼 | 상태 SOLD_OUT |
| 5 | 라이브 상품 | 라이브 중 상품 연결 | 실시간 상품 표시 |
| 6 | Featured 상품 | 라이브 중 핀 고정 | 하단 바에 표시 |

**API:**
```bash
# 상품 목록 (공개)
curl http://54.180.94.30/api/v1/products?streamKey=<key>

# Featured 상품
curl http://54.180.94.30/api/v1/products/featured?limit=6

# 스토어 상품 (종료된 방송의 상품)
curl http://54.180.94.30/api/v1/products/store?page=1&limit=20
```

---

### 5.5 장바구니 & 타이머 (Epic 6)

| # | 테스트 항목 | 방법 | 확인 포인트 |
|---|-----------|------|------------|
| 1 | 장바구니 추가 | 상품 → 장바구니 담기 | 색상/사이즈 선택, 수량 |
| 2 | 타이머 상품 | timerEnabled 상품 담기 | 카운트다운 시작 |
| 3 | 타이머 만료 | 타이머 종료까지 대기 | 자동 제거 (Cron 1분 주기) |
| 4 | 수량 변경 | 장바구니 → +/- 버튼 | 재고 초과 불가 |
| 5 | 삭제 | 장바구니 → X 버튼 | 재고 복구 |

---

### 5.6 주문 & 결제 (Epic 8)

| # | 테스트 항목 | 방법 | 확인 포인트 |
|---|-----------|------|------------|
| 1 | 주문 생성 | 장바구니 → 주문하기 | 주문번호 ORD-YYYYMMDD-XXXXX |
| 2 | 포인트 사용 | 주문 시 포인트 차감 선택 | 최소/최대 제한 확인 |
| 3 | 주문 확인 | `/orders/{orderId}` | 주문 상세, 입금 계좌 정보 |
| 4 | 결제 확인 | Admin → 주문관리 → 입금확인 | 상태 PAYMENT_CONFIRMED |
| 5 | 배송 처리 | Admin → 주문 → 배송처리 | 상태 SHIPPED |
| 6 | 주문 취소 | 주문상세 → 취소 | 재고 복구, 포인트 환불 |
| 7 | 자동 만료 | 48시간 미입금 | 자동 취소 (Cron 1분 주기) |
| 8 | CSV 일괄 알림 | Admin → 배송관리 → CSV 업로드 | 대량 배송알림 |

**입금 계좌 정보 설정:**
```bash
# .env.staging에 설정
BANK_NAME=KB국민은행
BANK_ACCOUNT_NUMBER=123-456-789012
BANK_ACCOUNT_HOLDER=도라미
```

---

### 5.7 예약 큐 (Epic 7)

| # | 테스트 항목 | 방법 | 확인 포인트 |
|---|-----------|------|------------|
| 1 | 예약 등록 | 품절 상품 → 예약하기 | 대기번호 부여 |
| 2 | 예약 순번 확인 | `/my-page/reservations` | FIFO 순서 |
| 3 | 자동 승격 | 재고 추가 시 | 1번 → PROMOTED 전환 |
| 4 | 승격 만료 | 승격 후 미구매 대기 | 30초 주기 체크, 자동 만료 |
| 5 | 예약 취소 | 예약 목록 → 취소 | 다음 순번 자동 승격 |

---

### 5.8 알림 시스템 (Epic 9)

| # | 테스트 항목 | 방법 | 확인 포인트 |
|---|-----------|------|------------|
| 1 | 알림 구독 | 홈 → 알림 버튼 | 브라우저 Push 권한 요청 |
| 2 | 라이브 알림 | 방송 시작 5분 전 | Push 알림 수신 |
| 3 | 공지 배너 | Admin → 설정 → 공지 | 홈 상단에 배너 표시 |
| 4 | 알림 템플릿 | Admin → 알림 설정 | 주문확인/입금독촉/배송 템플릿 |

---

### 5.9 포인트 시스템 (Epic 13)

| # | 테스트 항목 | 방법 | 확인 포인트 |
|---|-----------|------|------------|
| 1 | 포인트 설정 | Admin → 설정 → 포인트 | 적립률, 최소사용, 최대비율 |
| 2 | 자동 적립 | 주문 완료 시 | 주문금액 × 적립률 |
| 3 | 포인트 사용 | 주문 시 포인트 차감 | 최소 1000P, 최대 50% |
| 4 | 포인트 환불 | 주문 취소 시 | 사용 포인트 복구 |
| 5 | 수동 조정 | Admin → 유저 → 포인트 조정 | 관리자가 직접 추가/차감 |
| 6 | 포인트 만료 | 매일 02:00 Cron | 설정 개월 후 만료 |
| 7 | 이력 확인 | `/my-page/points` | 전체 적립/사용/만료 내역 |

---

### 5.10 관리자 기능 (Epic 12)

| # | 테스트 항목 | 방법 | 확인 포인트 |
|---|-----------|------|------------|
| 1 | 대시보드 | `/admin/dashboard` | 매출, 주문수, 시청자 통계 |
| 2 | 유저 관리 | `/admin/users` | 목록, 상태변경, 정지 |
| 3 | 주문 관리 | `/admin/orders` | 필터, 입금확인, 배송처리 |
| 4 | 상품 관리 | `/admin/products` | CRUD, 재고, 품절 |
| 5 | 방송 관리 | `/admin/broadcasts` | 스트림 생성, 라이브 모니터 |
| 6 | 정산 관리 | `/admin/settlement` | 기간별 정산, 엑셀 다운로드 |
| 7 | 시스템 설정 | `/admin/settings` | 공지, 배송메시지, 포인트 |
| 8 | 감사 로그 | `/admin/audit-log` | 관리자 모든 행동 기록 |

---

### 5.11 사용자 페이지

| 페이지 | 경로 | 테스트 포인트 |
|--------|------|-------------|
| 홈 | `/` | 추천상품, 예정 라이브, 카테고리 |
| 로그인 | `/login` | 카카오 OAuth |
| 프로필 등록 | `/profile/register` | Instagram ID, 입금자명 |
| 라이브 목록 | `/live` | 현재 방송, 예정 방송 |
| 라이브 시청 | `/live/{key}` | 비디오, 채팅, 상품, 하트 |
| 스토어 | `/shop` | 검색, 필터, 상품 목록 |
| 상품 상세 | `/products/{id}` | 이미지, 옵션, 장바구니 |
| 장바구니 | `/cart` | 수량, 타이머, 삭제 |
| 체크아웃 | `/checkout` | 주소, 포인트, 결제 |
| 주문 완료 | `/order-complete` | 주문번호, 입금 안내 |
| 주문 목록 | `/orders` | 주문 내역 |
| 주문 상세 | `/orders/{id}` | 상태, 취소 |
| 마이페이지 | `/my-page` | 프로필, 정보 수정 |
| 포인트 | `/my-page/points` | 잔액, 이력 |
| 예약 | `/my-page/reservations` | 예약 목록, 취소 |
| 알림 | `/alerts` | 공지사항 목록 |

---

## 6. 배포 프로세스

### 6.1 배포 스크립트 사용

```bash
ssh -i dorami-staging.pem ubuntu@54.180.94.30

cd /home/ubuntu/dorami

# 상태 확인
./scripts/deploy-staging.sh status

# 빌드 & 재시작
./scripts/deploy-staging.sh build
./scripts/deploy-staging.sh up

# 로그 확인
./scripts/deploy-staging.sh logs

# DB 시드
./scripts/deploy-staging.sh db-seed
```

### 6.2 수동 배포 (코드 업데이트)

```bash
cd /home/ubuntu/dorami

# 1. 코드 pull
git pull origin main

# 2. 로컬 Dockerfile 변경사항 보존 (stash에 있는 경우)
# git stash pop  # 필요시

# 3. 빌드 & 재시작
docker compose -f docker-compose.staging.yml --env-file .env.staging build --no-cache backend frontend
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d

# 4. DB 스키마 동기화 (schema.prisma 변경 시)
docker compose -f docker-compose.staging.yml --env-file .env.staging \
  exec backend npx prisma db push

# 5. 서비스 확인
docker compose -f docker-compose.staging.yml --env-file .env.staging ps
curl http://localhost:3001/api/v1/health
```

### 6.3 Production 배포 플로우

```
1. develop 브랜치에서 기능 개발
2. main에 PR → 코드 리뷰 → merge
3. staging 자동 배포 → QA 테스트
4. release/v1.x.x 태그 생성
5. production 수동 배포 (승인 후)
```

### 6.4 Staging 전용 주의사항

EC2 서버에는 Docker 빌드용으로 수정된 Dockerfile이 있습니다 (monorepo 대응):

| 파일 | 로컬 (Git) | EC2 서버 (로컬 수정) |
|------|-----------|-------------------|
| backend/Dockerfile | `context: ./backend` | `context: .` (monorepo 대응) |
| client-app/Dockerfile | `context: ./client-app` | `context: .` (shared-types 포함) |
| docker-compose.staging.yml | 원본 | build context 수정됨 |

**git pull 후 stash 충돌이 날 수 있습니다.** 이 경우:
```bash
git stash pop
# 충돌 시 EC2 로컬 버전(stash)을 우선 채택
```

---

## 7. 트러블슈팅

### 7.1 컨테이너 로그 확인

```bash
# 전체 로그
docker compose -f docker-compose.staging.yml --env-file .env.staging logs -f

# 특정 서비스
docker compose -f docker-compose.staging.yml --env-file .env.staging logs -f backend
docker compose -f docker-compose.staging.yml --env-file .env.staging logs -f frontend
docker compose -f docker-compose.staging.yml --env-file .env.staging logs -f nginx
```

### 7.2 DB 직접 접속

```bash
docker compose -f docker-compose.staging.yml --env-file .env.staging \
  exec postgres psql -U dorami -d live_commerce

# 유용한 쿼리
SELECT id, email, name, role, status FROM users;
SELECT id, status, "stream_key" FROM live_streams;
SELECT id, name, price, status FROM products LIMIT 10;
SELECT id, status, total, "created_at" FROM orders ORDER BY "created_at" DESC LIMIT 5;
```

### 7.3 Redis 접속

```bash
docker compose -f docker-compose.staging.yml --env-file .env.staging \
  exec redis redis-cli -a <REDIS_PASSWORD>

# 유용한 명령
KEYS *
INFO memory
```

### 7.4 DB 초기화 (데이터 전체 리셋)

```bash
# 주의: 모든 데이터 삭제됨
docker compose -f docker-compose.staging.yml --env-file .env.staging \
  exec backend npx prisma db push --force-reset

# 시드 데이터 재투입
docker compose -f docker-compose.staging.yml --env-file .env.staging \
  exec backend npx prisma db seed
```

### 7.5 컨테이너 전체 재시작

```bash
docker compose -f docker-compose.staging.yml --env-file .env.staging down
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d
```

### 7.6 디스크 정리

```bash
# Docker 이미지/캐시 정리
docker system prune -a --volumes

# 사용량 확인
df -h
docker system df
```

### 7.7 Cron Job 상태 확인

백엔드 로그에서 Cron 실행 확인:
```bash
docker compose -f docker-compose.staging.yml --env-file .env.staging \
  logs backend | grep -i "cron\|expired\|cleanup"
```

| Cron Job | 주기 | 기능 |
|----------|------|------|
| 장바구니 만료 | 매 1분 | 타이머 만료된 장바구니 제거 |
| 주문 만료 | 매 1분 | 48시간 미입금 주문 취소 |
| 예약 만료 | 매 30초 | 승격 후 미구매 예약 만료 |
| 포인트 만료 | 매일 02:00 | 만료일 지난 포인트 차감 |
| 라이브 알림 | 매 5분 | 방송 5~10분 전 Push 알림 |

---

## 부록: API 엔드포인트 전체 목록

### 인증 (`/auth`)
- `GET /auth/kakao` - 카카오 로그인
- `GET /auth/kakao/callback` - 카카오 콜백
- `POST /auth/refresh` - 토큰 갱신
- `POST /auth/logout` - 로그아웃
- `GET /auth/me` - 내 정보

### 유저 (`/users`)
- `GET /users/me` - 내 기본 정보
- `PATCH /users/me` - 프로필 수정
- `DELETE /users/me` - 계정 삭제
- `POST /users/complete-profile` - 프로필 완성
- `GET /users/profile/me` - 전체 프로필 (주소 포함)
- `PATCH /users/profile/address` - 주소 수정
- `GET /users/check-instagram` - Instagram ID 중복 확인
- `GET /users/:id` - 유저 조회 (Admin)

### 상품 (`/products`)
- `POST /products` - 상품 생성 (Admin)
- `GET /products` - 상품 목록 (streamKey 필터)
- `GET /products/featured` - 추천 상품
- `GET /products/store` - 스토어 상품
- `GET /products/:id` - 상품 상세
- `PATCH /products/:id` - 상품 수정 (Admin)
- `PATCH /products/:id/sold-out` - 품절 처리 (Admin)
- `PATCH /products/:id/stock` - 재고 변경 (Admin)
- `DELETE /products/:id` - 상품 삭제 (Admin)

### 스트리밍 (`/streaming`)
- `POST /streaming/start` - 스트림 생성
- `POST /streaming/generate-key` - 스트림 키 생성
- `PATCH /streaming/:id/go-live` - 라이브 시작
- `PATCH /streaming/:id/stop` - 방송 종료
- `GET /streaming/active` - 현재 라이브 목록
- `GET /streaming/upcoming` - 예정 방송
- `GET /streaming/:id/status` - 상태 조회
- `GET /streaming/key/:key/status` - 키로 상태 조회
- `GET /streaming/key/:key/featured-product` - Featured 상품
- `POST /streaming/:key/featured-product` - Featured 설정 (Admin)
- `GET /streaming/history` - 방송 이력 (Admin)
- `GET /streaming/live-status` - 라이브 현황 (Admin)
- `POST /streaming/auth` - RTMP 인증 (nginx 콜백)
- `POST /streaming/done` - RTMP 종료 (nginx 콜백)

### 장바구니 (`/cart`)
- `POST /cart` - 장바구니 추가
- `GET /cart` - 장바구니 조회
- `PATCH /cart/:id` - 수량 변경
- `DELETE /cart/:id` - 항목 삭제
- `DELETE /cart` - 전체 비우기

### 주문 (`/orders`)
- `POST /orders/from-cart` - 장바구니에서 주문
- `POST /orders` - 직접 주문
- `GET /orders` - 내 주문 목록
- `GET /orders/:id` - 주문 상세
- `PATCH /orders/:id/confirm` - 주문 확인
- `PATCH /orders/:id/cancel` - 주문 취소

### 예약 (`/reservations`)
- `POST /reservations` - 예약 등록
- `GET /reservations` - 내 예약 목록
- `DELETE /reservations/:id` - 예약 취소

### 포인트 (`/users/me/points`)
- `GET /users/me/points` - 내 포인트 잔액
- `GET /users/me/points/history` - 포인트 이력

### 알림 (`/notifications`)
- `POST /notifications/subscribe` - Push 구독
- `DELETE /notifications/unsubscribe` - 구독 해제
- `GET /notifications/subscriptions` - 구독 목록

### 공지 (`/notices`)
- `GET /notices/current` - 현재 공지
- `GET /notices` - 공지 목록

### 업로드 (`/upload`)
- `POST /upload/image` - 이미지 업로드 (5MB, jpg/png/webp)

### 헬스체크 (`/health`)
- `GET /health` - 전체 헬스체크
- `GET /health/live` - Liveness
- `GET /health/ready` - Readiness

### 관리자 (`/admin`)
- `GET /admin/dashboard/stats` - 대시보드 통계
- `GET /admin/activities/recent` - 최근 활동
- `GET /admin/users` - 유저 목록
- `GET /admin/users/:id` - 유저 상세
- `PATCH /admin/users/:id/status` - 유저 상태 변경
- `GET /admin/orders` - 주문 목록
- `GET /admin/orders/:id` - 주문 상세
- `PATCH /admin/orders/:id/confirm-payment` - 입금 확인
- `PATCH /admin/orders/:id/send-reminder` - 입금 독촉
- `POST /admin/orders/bulk-notify` - CSV 일괄 배송알림
- `GET /admin/config` - 시스템 설정 조회
- `PUT /admin/config` - 시스템 설정 수정
- `GET /admin/config/shipping-messages` - 배송 메시지
- `PUT /admin/config/shipping-messages` - 배송 메시지 수정
- `GET /admin/config/points` - 포인트 설정
- `PUT /admin/config/points` - 포인트 설정 수정
- `POST /admin/users/:id/points/adjust` - 포인트 수동 조정
- `GET /admin/notification-templates` - 알림 템플릿
- `PATCH /admin/notification-templates/:id` - 템플릿 수정
- `GET /admin/settlement` - 정산 리포트
- `GET /admin/settlement/download` - 정산 엑셀 다운로드
- `GET /admin/audit-logs` - 감사 로그
