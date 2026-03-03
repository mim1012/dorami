# 환경변수 구조 비교: main(Prod) vs develop(Staging)

## 📋 개요

| 항목               | develop (Staging)            | main (Production)                   |
| ------------------ | ---------------------------- | ----------------------------------- |
| **배포 브랜치**    | `develop`                    | `main`                              |
| **서버**           | staging.doremi-live.com      | www.doremi-live.com                 |
| **환경 파일**      | `.env.staging.example`       | `.env.production.example`           |
| **Docker Compose** | `docker-compose.staging.yml` | `docker-compose.prod.yml`           |
| **데이터베이스**   | PostgreSQL (Docker local)    | PostgreSQL (Docker external volume) |
| **사용자 데이터**  | 테스트 데이터                | 139명 사용자 (보호 필수)            |

---

## 🔧 환경변수 구조 차이

### 1️⃣ **데이터베이스 설정**

#### **Staging (docker-compose.staging.yml)**

```yaml
postgres:
  environment:
    POSTGRES_USER: ${POSTGRES_USER:-dorami} # 기본값: dorami
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD} # 필수
    POSTGRES_DB: ${POSTGRES_DB:-live_commerce} # 기본값: live_commerce

DATABASE_URL: postgresql://${POSTGRES_USER:-dorami}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-live_commerce}
```

#### **Production (docker-compose.prod.yml)**

```yaml
postgres:
  environment:
    POSTGRES_USER: ${POSTGRES_USER:?POSTGRES_USER required} # 필수 (오류 처리)
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}
    POSTGRES_DB: ${POSTGRES_DB:?POSTGRES_DB required}

DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public&connection_limit=20&pool_timeout=30
```

**차이점:**

- **Staging**: 기본값 제공 (`:-`), 빠른 테스트용
- **Prod**: 명시적 필수 확인 (`:?`), 오류 시 컨테이너 시작 안함
- **Prod**: 데이터베이스 연결 풀 설정 추가 (`connection_limit=20&pool_timeout=30`)

---

### 2️⃣ **필수 vs 선택적 환경변수**

#### **Staging: 관대한 구조**

```yaml
backend:
  environment:
    NODE_ENV: production # 고정
    APP_ENV: staging # 고정
    ENABLE_DEV_AUTH: ${ENABLE_DEV_AUTH:-true} # 기본: true (개발자 로그인 활성화)
    COOKIE_SECURE: ${COOKIE_SECURE:-false} # 기본: false (HTTP 테스트용)
    CSRF_ENABLED: ${CSRF_ENABLED:-true} # 기본: true
    ADMIN_EMAILS: ${ADMIN_EMAILS:-admin@dorami.shop} # 기본값 존재
```

#### **Production: 엄격한 구조**

```yaml
backend:
  environment:
    NODE_ENV: production # 고정
    APP_ENV: production # 고정
    CSRF_ENABLED: 'true' # 고정, 선택 불가
    DISABLE_CSRF: 'false' # 고정
    COOKIE_SECURE: 'true' # 고정, 보안 필수
    ENABLE_DEV_AUTH: 'false' # 고정, 개발 기능 비활성화
    JWT_SECRET: ${JWT_SECRET:?JWT_SECRET required (64+ chars)}
    PROFILE_ENCRYPTION_KEY: ${PROFILE_ENCRYPTION_KEY:?PROFILE_ENCRYPTION_KEY required}
    KAKAO_CLIENT_ID: ${KAKAO_CLIENT_ID:?KAKAO_CLIENT_ID required}
    KAKAO_CLIENT_SECRET: ${KAKAO_CLIENT_SECRET:?KAKAO_CLIENT_SECRET required}
    KAKAO_CALLBACK_URL: ${KAKAO_CALLBACK_URL:?KAKAO_CALLBACK_URL required}
    FRONTEND_URL: ${FRONTEND_URL:?FRONTEND_URL required}
    CORS_ORIGINS: ${CORS_ORIGINS:?CORS_ORIGINS required}
```

**차이점:**

- **Staging**: 환경변수 미지정 시 기본값 사용 → 빠른 시작
- **Prod**: 환경변수 미지정 시 오류 발생 → 안전성 보장

---

### 3️⃣ **URL 구성**

#### **Staging (.env.staging.example)**

```bash
FRONTEND_URL=https://staging.doremi-live.com
WS_URL=wss://staging.doremi-live.com
KAKAO_CALLBACK_URL=https://staging.livecommerce.com/api/auth/kakao/callback
CORS_ORIGINS=https://staging.doremi-live.com,https://staging-admin.livecommerce.com
```

#### **Production (.env.production.example)**

```bash
DOMAIN=doremi-live.com                                    # 기본 도메인
FRONTEND_URL=https://www.doremi-live.com                 # www 버전
CORS_ORIGINS=https://doremi-live.com,https://www.doremi-live.com
NEXT_PUBLIC_API_URL=https://www.doremi-live.com/api
NEXT_PUBLIC_WS_URL=https://www.doremi-live.com
NEXT_PUBLIC_CDN_URL=https://www.doremi-live.com/hls
```

**차이점:**

- **Staging**: `staging.` 서브도메인 + 임시 도메인 혼재
- **Prod**: `www.` 공식 도메인 + 도메인 환경변수 중앙화

---

### 4️⃣ **리소스 제한 (Docker)**

#### **Staging**

```yaml
# 리소스 제한 없음 (로컬 테스트용)
```

#### **Production**

```yaml
postgres:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:
        cpus: '0.5'
        memory: 512M

backend:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 1G
      reservations:
        cpus: '0.5'
        memory: 256M
```

**차이점:**

- **Prod**: 엄격한 CPU/메모리 제한으로 리소스 안정화

---

### 5️⃣ **데이터 볼륨 관리**

#### **Staging (docker-compose.staging.yml)**

```yaml
volumes:
  postgres_data: # 로컬 임시 볼륨
  redis_data: # 로컬 임시 볼륨
  certbot_www:
```

#### **Production (docker-compose.prod.yml)**

```yaml
volumes:
  postgres_data_prod:
    external: true
    name: dorami_postgres_data # 139명 사용자 데이터 (CRITICAL)
  redis_data_prod:
    external: true
    name: dorami_redis_data_prod # 데이터 보존
  uploads_data:
    external: true
    name: dorami_uploads_data
```

**차이점:**

- **Staging**: `external: false` (Docker Compose 관리)
- **Prod**: `external: true` (호스트 기반 영구 저장소, 데이터 손실 방지)

---

### 6️⃣ **환경변수 스키마 예제**

#### **Staging (.env.staging.example) — 간편 버전**

```bash
# DB
DB_PASSWORD=your_strong_password_here
JWT_SECRET=your_jwt_secret_here

# OAuth
KAKAO_CLIENT_ID=your_kakao_rest_api_key
KAKAO_CLIENT_SECRET=your_kakao_client_secret
KAKAO_CALLBACK_URL=https://your-domain.com/api/auth/kakao/callback

# URLs
FRONTEND_URL=https://your-domain.com
WS_URL=wss://your-domain.com

# 뱅크 정보
APP_ENV=staging
BANK_NAME=KB국민은행
BANK_ACCOUNT_NUMBER=your_account_number
```

#### **Production (.env.production.example) — 상세 버전**

```bash
# General
NODE_ENV=production
APP_VERSION=1.0.0

# Domain & URLs [REQUIRED]
DOMAIN=doremi-live.com
FRONTEND_URL=https://www.doremi-live.com
CORS_ORIGINS=https://doremi-live.com,https://www.doremi-live.com

# Database [REQUIRED]
POSTGRES_USER=dorami_prod
POSTGRES_PASSWORD=REPLACE_WITH_STRONG_PASSWORD_MIN_32_CHARS
POSTGRES_DB=dorami_production

# Redis [REQUIRED]
REDIS_PASSWORD=REPLACE_WITH_STRONG_PASSWORD_MIN_32_CHARS

# JWT [REQUIRED]
JWT_SECRET=REPLACE_WITH_64_BYTE_RANDOM_STRING (openssl rand -base64 64)

# Encryption [REQUIRED]
PROFILE_ENCRYPTION_KEY=REPLACE_WITH_64_HEX_CHARS (openssl rand -hex 32)

# Kakao OAuth [REQUIRED]
KAKAO_CLIENT_ID=your_kakao_client_id
KAKAO_CLIENT_SECRET=your_kakao_client_secret
KAKAO_CALLBACK_URL=https://www.doremi-live.com/api/auth/kakao/callback

# Streaming
RTMP_SERVER_URL=rtmp://www.doremi-live.com:1935/live
HLS_SERVER_URL=https://www.doremi-live.com/hls

# Frontend Build
NEXT_PUBLIC_API_URL=https://www.doremi-live.com/api
NEXT_PUBLIC_WS_URL=https://www.doremi-live.com
NEXT_PUBLIC_CDN_URL=https://www.doremi-live.com/hls

# Admin Configuration
ADMIN_EMAILS=admin@doremi-live.com

# Security
CSRF_ENABLED=true
DISABLE_CSRF=false

# Logging
LOG_LEVEL=warn
```

**차이점:**

- **Staging**: 25줄, 간편한 주석
- **Prod**: 120줄, 상세한 보안 설명 및 생성 방법 명시

---

## 🚀 배포 흐름도

```
main (Production)                    develop (Staging)
    ↓                                    ↓
.env.production.example          .env.staging.example
    ↓                                    ↓
docker-compose.prod.yml      docker-compose.staging.yml
    ↓                                    ↓
┌─────────────────────────┐   ┌─────────────────────────┐
│ External Volumes        │   │ Local Temporary Volumes │
│ - dorami_postgres_data  │   │ - postgres_data         │
│ - dorami_redis_data_prod│   │ - redis_data            │
│ - dorami_uploads_data   │   │ - certbot_www           │
│                         │   │                         │
│ Resource Limits:        │   │ Resource Limits:        │
│ - CPU: 2-4 cores       │   │ - CPU: Unlimited        │
│ - Memory: 1-2GB        │   │ - Memory: Unlimited     │
│                         │   │                         │
│ Dev Auth: false ❌       │   │ Dev Auth: true ✅        │
│ CSRF: true ✅            │   │ CSRF: Configurable      │
│ Logging: warn           │   │ Logging: info           │
└─────────────────────────┘   └─────────────────────────┘
   www.doremi-live.com        staging.doremi-live.com
  (139명 사용자, 무중단)         (테스트, 자유로운 재배포)
```

---

## ⚠️ 중요: 환경변수 마이그레이션 체크리스트

Staging에서 Production으로 배포 시:

- [ ] `APP_ENV`를 `production`으로 변경
- [ ] `NODE_ENV` 확인 (이미 `production`)
- [ ] `CSRF_ENABLED=true` 필수
- [ ] `COOKIE_SECURE=true` 필수
- [ ] `ENABLE_DEV_AUTH=false` 필수
- [ ] 모든 필수 환경변수 `:?` 검증 완료
- [ ] URL이 `www.doremi-live.com`으로 설정됨
- [ ] 외부 Volume이 `external: true`로 설정됨
- [ ] 리소스 제한이 명시됨
- [ ] JWT_SECRET/PROFILE_ENCRYPTION_KEY 강도 확인 (64+ hex chars)
- [ ] Kakao OAuth 앱이 프로덕션으로 설정됨
- [ ] ADMIN_EMAILS이 올바른 이메일로 설정됨

---

## 📊 환경변수 비교표 (주요 항목)

| 항목                     | Staging                   | Production        | 설명                 |
| ------------------------ | ------------------------- | ----------------- | -------------------- |
| `APP_ENV`                | `staging`                 | `production`      | 환경 식별            |
| `NODE_ENV`               | `production`              | `production`      | Node.js 환경         |
| `ENABLE_DEV_AUTH`        | `true`                    | `false`           | 개발자 로그인 활성화 |
| `CSRF_ENABLED`           | `true`                    | `true`            | CSRF 보호            |
| `COOKIE_SECURE`          | `false`                   | `true`            | HTTPS 전용 쿠키      |
| `LOG_LEVEL`              | `info`                    | `warn`            | 로그 상세도          |
| `DOMAIN`                 | `staging.doremi-live.com` | `doremi-live.com` | 기본 도메인          |
| `DATABASE_URL`           | 기본값 제공               | 필수 입력         | DB 연결              |
| `REDIS_PASSWORD`         | 필수                      | 필수              | Redis 인증           |
| `JWT_SECRET`             | 필수                      | 필수 (64+ chars)  | 토큰 서명            |
| `PROFILE_ENCRYPTION_KEY` | 필수                      | 필수 (64 hex)     | AES-256-GCM          |
| Volume Type              | Local (임시)              | External (영구)   | 데이터 지속성        |
| CPU Limit                | 없음                      | 2 cores           | 리소스 제한          |
| Memory Limit             | 없음                      | 1-2GB             | 리소스 제한          |

---

## 🔐 보안 레벨

| 항목       | Staging     | Production    |
| ---------- | ----------- | ------------- |
| **인증**   | Dev login O | Dev login X   |
| **CSRF**   | 설정 가능   | 필수 활성화   |
| **쿠키**   | HTTP O      | HTTPS만       |
| **데이터** | 테스트용    | 139명 사용자  |
| **로그**   | 상세 (info) | 경고만 (warn) |
| **Sentry** | Optional    | Optional      |

---

## 🎯 결론

**Staging (develop)**

- 개발자 친화적, 기본값 제공, 빠른 테스트
- 외부 환경변수 미지정 시에도 동작
- 개발 기능 (Dev Auth, 상세 로그) 활성화

**Production (main)**

- 엄격한 검증, 명시적 필수 확인
- 모든 환경변수를 명시적으로 지정 필수
- 보안 기능 (CSRF, HTTPS-only) 필수 활성화
- 영구 데이터 저장소, 리소스 제한으로 안정성 보장
- 139명 사용자 데이터 보호
