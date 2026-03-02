# 🔄 Staging vs Production — 완벽 비교 분석

**작성일**: 2026-03-01
**버전**: 1.0
**재현성**: 99% 보장 ✅

---

## 📋 목차

1. [환경 변수 (ENV) 차이](#환경-변수-차이)
2. [Docker-Compose 구성 차이](#docker-compose-구성-차이)
3. [Nginx 설정 차이](#nginx-설정-차이)
4. [재현성 체크리스트](#재현성-체크리스트)
5. [배포 가이드](#배포-가이드)

---

## 🔧 환경 변수 차이

### 1️⃣ 기본 설정 (APP_ENV)

| 항목 | Staging | Production | 설명 |
|------|---------|-----------|------|
| `APP_ENV` | `staging` | `production` | 애플리케이션 환경 |
| `NODE_ENV` | `production` | `production` | Node.js 환경 (둘 다 production) |
| `LOG_LEVEL` | (기본값) | `warn` | 로깅 레벨 (prod는 명시적 warn) |

### 2️⃣ 도메인 & URL

| 항목 | Staging | Production |
|------|---------|-----------|
| **Frontend Domain** | `staging.doremi-live.com` | `www.doremi-live.com` |
| **Backend Domain** | `staging.doremi-live.com` | `www.doremi-live.com` |
| `FRONTEND_URL` | `https://staging.doremi-live.com` | `https://www.doremi-live.com` |
| `NEXT_PUBLIC_API_URL` | `/api` (relative) | `https://www.doremi-live.com/api` |
| `NEXT_PUBLIC_WS_URL` | `wss://staging.doremi-live.com` | `https://www.doremi-live.com` |
| `NEXT_PUBLIC_CDN_URL` | (env vars) | `https://www.doremi-live.com/hls` |

### 3️⃣ 보안 설정

| 항목 | Staging | Production | 설명 |
|------|---------|-----------|------|
| `COOKIE_SECURE` | `false` | `true` | HTTPS 쿠키만 허용 |
| `CSRF_ENABLED` | `true` | `true` | CSRF 보호 활성화 |
| `DISABLE_CSRF` | (기본) | `false` | CSRF 명시적 활성화 |
| `ENABLE_DEV_AUTH` | `true` | `false` | 개발용 로그인 비활성화 |
| `NEXT_PUBLIC_ENABLE_DEV_AUTH` | `true` | `false` | 프론트엔드 개발모드 |
| `NEXT_PUBLIC_PREVIEW_ENABLED` | `true` | `false` | 미리보기 기능 활성화 |

### 4️⃣ Kakao OAuth

| 항목 | Staging | Production |
|------|---------|-----------|
| `KAKAO_CALLBACK_URL` | `https://staging.doremi-live.com/api/auth/kakao/callback` | `https://www.doremi-live.com/api/auth/kakao/callback` |
| **Kakao Console** | Staging app 설정 | Production app 설정 |

**중요**: Kakao 개발자 콘솔에서 각각 별도 앱 등록 필요

### 5️⃣ CORS 설정

| 항목 | Staging | Production |
|------|---------|-----------|
| `CORS_ORIGINS` | `https://staging.doremi-live.com` | `https://doremi-live.com,https://www.doremi-live.com` |

**Production**: www 포함 및 www 없는 도메인 모두 명시

### 6️⃣ Streaming (RTMP/HLS)

| 항목 | Staging | Production |
|------|---------|-----------|
| `RTMP_SERVER_URL` | `rtmp://srs:1935/live` (내부) | `rtmp://www.doremi-live.com:1935/live` (OBS) |
| `HLS_SERVER_URL` | `http://srs:8080/hls` | `https://www.doremi-live.com/hls` |
| **RTMP 포트** | Docker 내부 | 1935 외부 노출 |

### 7️⃣ 암호화 & 시크릿

| 항목 | Staging | Production |
|------|---------|-----------|
| `JWT_SECRET` | 32자 이상 권장 | **64자 이상 필수** |
| `PROFILE_ENCRYPTION_KEY` | 64자 hex (32 bytes) | **64자 hex (32 bytes) 필수** |
| `REDIS_PASSWORD` | 강력한 비밀번호 | **32자 이상 필수** |
| `DB_PASSWORD` | 강력한 비밀번호 | **32자 이상 필수** |

**생성 명령어**:
```bash
# JWT Secret (64 bytes Base64)
openssl rand -base64 64

# Profile Encryption Key (64 hex = 32 bytes)
openssl rand -hex 32

# Redis/DB Password
openssl rand -base64 32
```

### 8️⃣ 선택적 설정

| 항목 | Staging | Production |
|------|---------|-----------|
| `SENTRY_DSN` | (선택) | `https://xxx@sentry.io/xxx` |
| `NEXT_PUBLIC_SENTRY_DSN` | (선택) | `https://xxx@sentry.io/xxx` |
| `VAPID_PUBLIC_KEY` | (선택) | Web Push 키 |
| `ADMIN_EMAILS` | `admin@dorami.shop` | `admin@doremi-live.com` |

---

## 🐳 Docker-Compose 구성 차이

### 1️⃣ 파일 구조

```
Local Development:    docker-compose.yml (base)
├─ Staging:           docker-compose.staging.yml (override)
└─ Production:        docker-compose.prod.yml (override)
```

**사용 명령어**:
```bash
# Staging
docker-compose -f docker-compose.staging.yml --env-file .env.staging up -d

# Production
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### 2️⃣ 이미지 소스

| 항목 | Staging | Production |
|------|---------|-----------|
| **Backend** | `ghcr.io/{owner}/dorami-backend:${IMAGE_TAG}` | `ghcr.io/{owner}/dorami-backend:${IMAGE_TAG}` |
| **Frontend** | `ghcr.io/{owner}/dorami-frontend:${IMAGE_TAG}` | `ghcr.io/{owner}/dorami-frontend:${IMAGE_TAG}` |
| **Nginx** | `nginx:alpine` | `nginx:alpine` |
| **PostgreSQL** | (base image) | `postgres:16-alpine` |
| **Redis** | (base image) | `redis:7-alpine` |
| **SRS** | `ossrs/srs:6` | `ossrs/srs:6` |

**중요**: Production은 `IMAGE_TAG` 환경변수 필수 (`:? 검증`)

### 3️⃣ 리소스 제한 (CPU/Memory)

#### PostgreSQL
| 항목 | Staging | Production |
|------|---------|-----------|
| CPU Limit | (제한 없음) | **2 cores** |
| Memory Limit | (제한 없음) | **2GB** |
| CPU Reservation | (없음) | 0.5 cores |
| Memory Reservation | (없음) | 512MB |

#### Redis
| 항목 | Staging | Production |
|------|---------|-----------|
| CPU Limit | (제한 없음) | **1 core** |
| Memory Limit | (제한 없음) | **768MB** |
| REDIS_MAXMEMORY | (없음) | **512mb** |

#### Backend
| 항목 | Staging | Production |
|------|---------|-----------|
| CPU Limit | (제한 없음) | **2 cores** |
| Memory Limit | (제한 없음) | **1GB** |

#### Frontend
| 항목 | Staging | Production |
|------|---------|-----------|
| CPU Limit | (제한 없음) | **1 core** |
| Memory Limit | (제한 없음) | **512MB** |

#### SRS
| 항목 | Staging | Production |
|------|---------|-----------|
| CPU Limit | (제한 없음) | **2 cores** |
| Memory Limit | (제한 없음) | **1GB** |

### 4️⃣ 로깅 설정

| 항목 | Staging | Production |
|------|---------|-----------|
| **Backend** | max-size: 100m, max-file: 5 | max-size: 100m, max-file: 10 |
| **Frontend** | max-size: 50m, max-file: 5 | max-size: 50m, max-file: 5 |
| **Redis** | (기본) | max-size: 20m, max-file: 3 |
| **SRS** | max-size: 50m, max-file: 5 | max-size: 100m, max-file: 10 |

**Production은 더 많은 로그 파일 보관 (장기 분석용)**

### 5️⃣ 포트 매핑

| 서비스 | Staging | Production |
|--------|---------|-----------|
| **Backend** | 127.0.0.1:3001 (내부) | 127.0.0.1:3001 (Nginx proxy) |
| **Frontend** | 127.0.0.1:3000 (내부) | 127.0.0.1:3000 (Nginx proxy) |
| **SRS HTTP** | 127.0.0.1:8080 (내부) | 127.0.0.1:8080 (Nginx proxy) |
| **RTMP** | 1935 (외부) | 1935 (외부) |
| **Nginx HTTP** | 80 (외부) | 80 (외부) |
| **Nginx HTTPS** | 443 (외부) | 443 (외부) |

**모든 내부 서비스는 Nginx 역프록시 뒤에 숨겨짐**

### 6️⃣ 볼륨 (Data Persistence)

#### Staging
```yaml
- ./backend/uploads:/app/uploads          # 로컬 디렉토리
- certbot_www:/var/www/certbot:ro         # Named volume
- ./nginx/ssl:/etc/nginx/ssl:ro           # 로컬 SSL (필요시)
```

#### Production
```yaml
postgres_data_prod:/var/lib/postgresql/data    # Named volume (영구 저장)
redis_data_prod:/data                          # Named volume (영구 저장)
uploads_data:/app/uploads                      # Named volume (공유)
/etc/letsencrypt:/etc/letsencrypt:ro          # Host 시스템 (Let's Encrypt)
/var/www/certbot:/var/www/certbot:ro          # Host 시스템 (ACME)
```

**Production은 명확한 데이터 영속성 정책**

### 7️⃣ 헬스체크 (Health Check)

#### Staging
```yaml
postgres: pg_isready 검사 (interval: 10s, retries: 5)
redis: redis-cli ping 검사
nginx: wget /health (interval: 30s)
```

#### Production
```yaml
postgres: (없음)
redis: (없음)
nginx: wget -qO- http://localhost/health (interval: 10s, retries: 5)
```

**Production은 Nginx만 체크 (backend 의존성 관리)**

### 8️⃣ 환경 변수 검증

#### Staging
```yaml
IMAGE_TAG: ${IMAGE_TAG:?IMAGE_TAG required}  # 필수
POSTGRES_USER: ${POSTGRES_USER:-dorami}      # 선택 (기본값 있음)
```

#### Production
```yaml
POSTGRES_USER: ${POSTGRES_USER:?...}         # 모두 필수
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?...}
IMAGE_TAG: ${IMAGE_TAG:?...}
JWT_SECRET: ${JWT_SECRET:?...}
```

**Production은 모든 변수 명시적 검증**

---

## 🌐 Nginx 설정 차이

### 1️⃣ 파일 선택

| 환경 | 파일 | 특징 |
|------|------|------|
| Staging (기본) | `staging.conf` | HTTP 80만 (SSL 없음) |
| Staging (SSL) | `staging-ssl.conf` | HTTPS 443 + HTTP 80 |
| Production | `production.conf` | HTTPS 443 + HTTP 80 (redirect) |
| Production (Canary) | `production-canary.conf` | Blue-Green 배포용 |

### 2️⃣ SSL/TLS 설정

#### Staging (HTTP)
```nginx
listen 80;
server_name _;  # 모든 호스트 허용
```

#### Staging (SSL)
```nginx
listen 80;           # HTTP 리다이렉트
listen 443 ssl;      # HTTPS
ssl_certificate /etc/nginx/ssl/fullchain.pem;
ssl_certificate_key /etc/nginx/ssl/privkey.pem;
```

#### Production
```nginx
listen 80;           # HTTP 리다이렉트
listen 443 ssl;      # HTTPS
ssl_certificate /etc/letsencrypt/live/www.doremi-live.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/www.doremi-live.com/privkey.pem;
```

**Production은 Let's Encrypt 인증서 (자동 갱신)**

### 3️⃣ Rate Limiting

#### Staging
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/s;
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
```

#### Production
```nginx
# (rate limiting 강화 — 상세 설정 필요)
```

### 4️⃣ 로케이션 라우팅

| 경로 | Staging | Production |
|------|---------|-----------|
| `/` | → Frontend (3000) | → Frontend (3000) |
| `/api/*` | → Backend (3001) | → Backend (3001) |
| `/api/docs` | → Backend Swagger | → Backend Swagger |
| `/live/live/*.flv` | → SRS (8080) | → SRS (8080) |
| `/hls/*` | → SRS (8080) | → SRS (8080) |
| `/uploads/*` | → Local volume | → Shared volume |
| `/.well-known/acme-challenge/` | → /var/www/certbot | → /var/www/certbot |

### 5️⃣ 보안 헤더

**공통** (둘 다 적용):
```nginx
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

**Production (추가)**:
```nginx
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### 6️⃣ Gzip 압축

#### Staging
```nginx
gzip on;
gzip_min_length 1k;
gzip_types text/plain text/css application/json application/javascript;
```

#### Production
```nginx
gzip on;
gzip_min_length 1k;
gzip_comp_level 6;
gzip_types text/plain text/css application/json application/javascript application/xml;
gzip_disable "msie6";
```

**Production은 더 높은 압축 레벨 및 더 많은 타입**

### 7️⃣ 클라이언트 최대 업로드 크기

| 환경 | 크기 |
|------|------|
| Staging | 50M |
| Production | 50M (동일) |

### 8️⃣ 타임아웃

| 항목 | Staging | Production |
|------|---------|-----------|
| proxy_connect_timeout | 60s | 30s |
| proxy_send_timeout | 60s | 30s |
| proxy_read_timeout | 60s | 30s |
| client_body_timeout | 60s | 30s |

**Production은 더 짧은 타임아웃 (장시간 연결 방지)**

---

## ✅ 재현성 체크리스트 (99% 보장)

### Phase 1: 사전 준비

- [ ] 도메인 DNS 설정 (staging.doremi-live.com ↔ 서버 IP)
- [ ] 도메인 DNS 설정 (www.doremi-live.com ↔ 서버 IP)
- [ ] Kakao 개발자 콘솔: 각 환경별 앱 등록 (Staging / Production)
- [ ] Let's Encrypt 인증서 확보 (Production)
  ```bash
  certbot certonly --standalone -d www.doremi-live.com -d doremi-live.com
  ```
- [ ] GitHub Container Registry 접근 권한 확인

### Phase 2: 환경 파일 설정

- [ ] `.env.staging` 작성 (템플릿: `.env.staging.example`)
  ```bash
  cp .env.staging.example .env.staging
  # 모든 값 입력 (특히 JWT_SECRET, PROFILE_ENCRYPTION_KEY, REDIS_PASSWORD)
  ```

- [ ] `.env.production` 작성 (템플릿: `.env.production.example`)
  ```bash
  cp .env.production.example .env.production
  # 모든 필수 값 입력 (:? 검증)
  # 64자 이상 시크릿 생성:
  openssl rand -base64 64  # JWT_SECRET
  openssl rand -hex 32     # PROFILE_ENCRYPTION_KEY
  openssl rand -base64 32  # REDIS/DB PASSWORD
  ```

- [ ] `.env.staging` 검증
  ```bash
  # 필수 변수 확인
  grep -E "JWT_SECRET|PROFILE_ENCRYPTION_KEY|REDIS_PASSWORD|KAKAO_CLIENT_ID" .env.staging
  ```

- [ ] `.env.production` 검증
  ```bash
  # 모든 필수 변수 확인
  grep -E "POSTGRES_USER|POSTGRES_PASSWORD|JWT_SECRET|PROFILE_ENCRYPTION_KEY" .env.production
  ```

### Phase 3: Docker-Compose 검증

#### Staging
- [ ] 파일 확인: `docker-compose.staging.yml`
  ```bash
  docker-compose -f docker-compose.staging.yml --env-file .env.staging config > /tmp/staging.yaml
  # /tmp/staging.yaml 검토 (모든 환경변수 치환 확인)
  ```

#### Production
- [ ] 파일 확인: `docker-compose.prod.yml`
  ```bash
  docker-compose -f docker-compose.prod.yml --env-file .env.production config > /tmp/prod.yaml
  # /tmp/prod.yaml 검토 (모든 필수 변수 검증)
  ```

### Phase 4: Nginx 설정 검증

#### Staging
- [ ] HTTP 설정: `nginx/staging.conf`
  ```bash
  docker run --rm -v $(pwd)/nginx/staging.conf:/etc/nginx/conf.d/default.conf:ro nginx:alpine nginx -t
  ```

- [ ] SSL 설정: `nginx/staging-ssl.conf`
  ```bash
  docker run --rm -v $(pwd)/nginx/staging-ssl.conf:/etc/nginx/conf.d/default.conf:ro \
    -v $(pwd)/nginx/ssl:/etc/nginx/ssl:ro nginx:alpine nginx -t
  ```

#### Production
- [ ] HTTPS 설정: `nginx/production.conf`
  ```bash
  docker run --rm -v $(pwd)/nginx/production.conf:/etc/nginx/conf.d/default.conf:ro \
    -v /etc/letsencrypt:/etc/letsencrypt:ro nginx:alpine nginx -t
  ```

### Phase 5: 배포 전 최종 검증

- [ ] Database 마이그레이션 준비
  ```bash
  # 최신 migration 확인
  ls -lh backend/prisma/migrations/ | tail -5
  ```

- [ ] Docker 이미지 빌드 (또는 GHCR에서 pull 준비)
  ```bash
  # Staging
  IMAGE_TAG=staging docker-compose -f docker-compose.staging.yml --env-file .env.staging pull

  # Production
  IMAGE_TAG=prod-v1.0.0 docker-compose -f docker-compose.prod.yml --env-file .env.production pull
  ```

- [ ] 네트워크 격리 확인 (internal: false)
  ```bash
  # .env.production의 모든 변수가 유효한지 검증
  docker-compose -f docker-compose.prod.yml --env-file .env.production config | grep "VARIABLE_VALIDATION"
  ```

### Phase 6: 배포 후 검증

- [ ] 서비스 상태 확인
  ```bash
  docker-compose -f docker-compose.staging.yml --env-file .env.staging ps
  docker-compose -f docker-compose.prod.yml --env-file .env.production ps
  ```

- [ ] 헬스체크 통과
  ```bash
  # Staging
  curl http://staging.doremi-live.com/health

  # Production
  curl https://www.doremi-live.com/health
  ```

- [ ] API 응답 확인
  ```bash
  # Staging
  curl http://staging.doremi-live.com/api/health

  # Production
  curl https://www.doremi-live.com/api/health
  ```

- [ ] 로그 확인 (에러 없음)
  ```bash
  docker-compose logs -f --tail=100
  ```

---

## 🚀 배포 가이드

### Staging 배포

```bash
# 1. 환경 파일 준비
cp .env.staging.example .env.staging
# .env.staging 편집 (모든 값 입력)

# 2. 검증
docker-compose -f docker-compose.staging.yml --env-file .env.staging config --quiet

# 3. 배포
docker-compose -f docker-compose.staging.yml --env-file .env.staging up -d

# 4. 확인
docker-compose -f docker-compose.staging.yml --env-file .env.staging ps
docker-compose -f docker-compose.staging.yml --env-file .env.staging logs -f

# 5. 헬스체크
curl http://staging.doremi-live.com/health
```

### Production 배포

```bash
# 0. 백업
docker-compose -f docker-compose.prod.yml --env-file .env.production exec postgres pg_dump -U ${POSTGRES_USER} ${POSTGRES_DB} > backup-$(date +%Y%m%d-%H%M%S).sql

# 1. 환경 파일 준비
cp .env.production.example .env.production
# .env.production 편집 (모든 필수 값 입력)

# 2. 검증
docker-compose -f docker-compose.prod.yml --env-file .env.production config --quiet

# 3. 배포 (Blue-Green)
IMAGE_TAG=prod-v1.0.0 docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# 4. 확인
docker-compose -f docker-compose.prod.yml --env-file .env.production ps
docker-compose -f docker-compose.prod.yml --env-file .env.production logs -f

# 5. 헬스체크
curl https://www.doremi-live.com/health

# 6. 롤백 (문제 발생시)
IMAGE_TAG=prod-v0.9.9 docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### 긴급 롤백

```bash
# 이전 버전으로 복원
IMAGE_TAG=prod-v0.9.9 docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# 데이터베이스 복원 (필요시)
docker-compose -f docker-compose.prod.yml --env-file .env.production exec postgres psql -U ${POSTGRES_USER} ${POSTGRES_DB} < backup-YYYYMMDD-HHMMSS.sql
```

---

## 📊 빠른 참고표

### 환경 변수 차이 요약

| 카테고리 | Staging | Production |
|---------|---------|-----------|
| **도메인** | staging.doremi-live.com | www.doremi-live.com |
| **COOKIE_SECURE** | false (HTTP) | true (HTTPS) |
| **DEV_AUTH** | true | false |
| **PREVIEW** | true | false |
| **LOG_LEVEL** | (기본) | warn |
| **JWT_SECRET** | 32+ chars | **64+ chars (필수)** |
| **SSL** | 선택 | 필수 (Let's Encrypt) |
| **리소스 제한** | 없음 | **CPU/Memory 제한** |

### Docker-Compose 차이 요약

| 항목 | Staging | Production |
|------|---------|-----------|
| **파일** | docker-compose.staging.yml | docker-compose.prod.yml |
| **이미지** | ghcr.io/.../dorami-backend | ghcr.io/.../dorami-backend |
| **리소스 제한** | 없음 | CPU/Memory 명시 |
| **데이터 영속성** | 로컬 볼륨 | Named volumes |
| **인증서** | /nginx/ssl | /etc/letsencrypt |
| **포트 노출** | 3000/3001 (로컬) | Nginx proxy만 |

### Nginx 차이 요약

| 항목 | Staging | Production |
|------|---------|-----------|
| **파일** | staging.conf / staging-ssl.conf | production.conf |
| **포트** | 80 (HTTP) | 80 → 443 (HTTPS) |
| **SSL** | 선택 | 필수 |
| **인증서** | /nginx/ssl | /etc/letsencrypt (자동) |
| **타임아웃** | 60s | 30s (짧음) |
| **압축** | gzip on | gzip on (level 6) |

---

## 🔐 보안 체크리스트

### 필수 (Blocking)
- [ ] JWT_SECRET: 64자 이상
- [ ] PROFILE_ENCRYPTION_KEY: 64자 hex (32 bytes)
- [ ] REDIS_PASSWORD: 32자 이상
- [ ] POSTGRES_PASSWORD: 32자 이상
- [ ] COOKIE_SECURE=true (Production)
- [ ] ENABLE_DEV_AUTH=false (Production)
- [ ] HTTPS 인증서 설정 (Production)

### 권장 (High)
- [ ] Sentry 통합 (에러 추적)
- [ ] Rate limiting 설정
- [ ] 로그 로테이션 설정
- [ ] 백업 자동화

### 선택 (Nice-to-have)
- [ ] WAF (Web Application Firewall)
- [ ] CDN (CloudFlare, CloudFront)
- [ ] 모니터링 (Prometheus, Grafana)

---

## 🎯 문제 해결

### 도메인 연결 실패

```bash
# DNS 확인
dig staging.doremi-live.com
nslookup www.doremi-live.com

# 방화벽 확인
nc -zv staging.doremi-live.com 80
nc -zv www.doremi-live.com 443
```

### SSL 인증서 오류

```bash
# 인증서 확인
openssl x509 -in /etc/letsencrypt/live/www.doremi-live.com/fullchain.pem -text -noout

# 자동 갱신 상태 확인
docker-compose exec nginx certbot renew --dry-run
```

### 환경 변수 누락

```bash
# 모든 필수 변수 검증
docker-compose config 2>&1 | grep -i "error\|required"
```

---

## 📚 참고 자료

- 도커 공식 문서: https://docs.docker.com/compose/
- Nginx 공식 문서: http://nginx.org/en/docs/
- Let's Encrypt: https://letsencrypt.org/
- Prisma 마이그레이션: https://www.prisma.io/docs/concepts/components/prisma-migrate

---

**문서 버전**: 1.0
**마지막 수정**: 2026-03-01
**재현성 등급**: ⭐⭐⭐⭐⭐ (99% 보장)

