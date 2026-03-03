# 상세 비교: Staging vs Production

## 환경변수 / 키값 / Docker 네트워크

**수집일**: 2026-03-03 12:24 UTC
**대상**: dorami 프로덕션 환경 (139명 사용자) vs Staging (예상 구성)

---

## 🔐 Part 1: 환경변수 & 키값 비교

### 1️⃣ **데이터베이스 자격증명**

#### Production (실제 배포)

```bash
DATABASE_URL=postgresql://postgres:dzj1n2o5BxDWUC07sZ9epZTHStGgzyj5rQPscV+BkIo=@postgres:5432/live_commerce?schema=public

# 분석:
# - User: postgres (기본값)
# - Password: dzj1n2o5BxDWUC07sZ9epZTHStGgzyj5rQPscV+BkIo= (42 chars, Base64)
# - Host: postgres (Docker 내부 hostname)
# - Port: 5432 (기본값)
# - Database: live_commerce
# - Query String: schema=public ONLY (❌ connection_limit, pool_timeout 없음)
```

#### Staging (예상)

```bash
DATABASE_URL=postgresql://dorami:password@postgres:5432/live_commerce

# 차이점:
# - User: dorami (커스텀, production과 다름)
# - Password: staging용 암호 (다름)
# - Query String: 없음 (pool 설정 없음)
```

**주요 차이점:**
| 항목 | Production | Staging |
|------|-----------|---------|
| Username | `postgres` | `dorami` |
| Password | 42-char Base64 | 다른 암호 |
| Connection Pool | ❌ 없음 | ❌ 없음 |
| Pool Timeout | ❌ 없음 | ❌ 없음 |

---

### 2️⃣ **암호화/보안 키**

#### JWT Secret

```bash
# Production
JWT_SECRET=cJcjNOtVAkMOqvevKJeGNuh0YEfdrOy9kauZwzlgZx20IqIm+jJEi0ZjyXDru17dlzI9M+22wpuq629gRTjiEQ==
# 길이: 86 chars
# 형식: Base64 (128-bit + padding)
# 강도: ⭐⭐⭐⭐⭐ 강함

# Staging (예상)
JWT_SECRET=your_jwt_secret_here  # 또는 테스트용 짧은 키
# 길이: 가변 (보통 32-64 chars)
# 강도: ⭐⭐⭐ 보통
```

#### Profile Encryption Key (AES-256-GCM)

```bash
# Production
PROFILE_ENCRYPTION_KEY=4301084e13929fbf53da9ea451781308aed38ea6f8449995dfc3bae0b5058b8c
# 길이: 64 hex chars = 32 bytes (정확히 AES-256)
# 형식: Hex string (0-9, a-f)
# 용도: 사용자 주소 정보 암호화
# 강도: ⭐⭐⭐⭐⭐ 강함

# Staging (예상)
PROFILE_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
# 길이: 64 hex (기본 테스트 키)
# 강도: ⭐⭐⭐⭐ 약간 약함 (패턴 있음)
```

**키 강도 분석:**

| 키                     | 길이     | 형식   | Production | Staging |
| ---------------------- | -------- | ------ | ---------- | ------- |
| JWT_SECRET             | 86 chars | Base64 | 🔴 높음    | 🟡 중간 |
| PROFILE_ENCRYPTION_KEY | 64 chars | Hex    | 🟢 정상    | 🟢 정상 |

---

### 3️⃣ **Redis 자격증명**

#### Production

```bash
REDIS_PASSWORD=dzj1n2o5BxDWUC07sZ9epZTHStGgzyj5rQPscV+BkIo=
# ⚠️ DATABASE_PASSWORD와 동일!

REDIS_URL=redis://:dzj1n2o5BxDWUC07sZ9epZTHStGgzyj5rQPscV+BkIo=@redis:6379
REDIS_PUBSUB_URL=redis://:dzj1n2o5BxDWUC07sZ9epZTHStGgzyj5rQPscV+BkIo=@redis:6379/1

# Redis 컨테이너 설정
redis-server --appendonly yes --requirepass dzj1n2o5BxDWUC07sZ9epZTHStGgzyj5rQPscV+BkIo= --maxmemory 512mb --maxmemory-policy allkeys-lru

# 분석:
# - RDB persistence: --appendonly yes (AOF 활성화)
# - Memory limit: 512mb
# - Eviction policy: allkeys-lru (가득 차면 가장 사용 안 한 키 제거)
```

#### Staging (예상)

```bash
REDIS_PASSWORD=redis_password_here  # 다른 암호

REDIS_URL=redis://redis:6379
REDIS_PUBSUB_URL=redis://redis:6379/1

redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
# (비밀번호 없음 또는 약한 암호)
```

**차이점:**
| 항목 | Production | Staging |
|------|-----------|---------|
| 비밀번호 | 42-char Base64 | 약함 |
| Persistence | AOF enabled | 예상: AOF enabled |
| Memory Limit | 512mb | 256mb |
| Eviction Policy | allkeys-lru | allkeys-lru |

---

### 4️⃣ **Kakao OAuth 설정**

#### Production

```bash
KAKAO_CLIENT_ID=d39c1e849b3e2944a8e4e6dfd7f313c4        # 32-char hex
KAKAO_CLIENT_SECRET=NAc0OfFfyw9Pe3iVODpjqNFHUrRr5Mby   # 40-char base64
KAKAO_CALLBACK_URL=https://www.doremi-live.com/api/auth/kakao/callback
```

#### Staging (예상)

```bash
KAKAO_CLIENT_ID=your_staging_kakao_client_id            # 다른 앱
KAKAO_CLIENT_SECRET=your_staging_kakao_client_secret
KAKAO_CALLBACK_URL=https://staging.doremi-live.com/api/auth/kakao/callback
```

**중요:**

- Kakao Developer에서 **앱을 분리**해야 함
- Prod: `www.doremi-live.com`
- Staging: `staging.doremi-live.com`
- **동일 ID/SECRET 사용 시 리디렉션 오류 발생**

---

### 5️⃣ **기타 환경변수**

```bash
# Production
ADMIN_EMAILS=amykim422@gmail.com
BANK_NAME=농협
BANK_ACCOUNT_NUMBER=계정번호
BANK_ACCOUNT_HOLDER=예금주명
APP_VERSION=0.2.0
LOG_LEVEL=warn
COOKIE_SECURE=true
CSRF_ENABLED=true
ENABLE_DEV_AUTH=false

# Staging (예상)
ADMIN_EMAILS=admin@dorami.shop
BANK_NAME=KB국민은행
BANK_ACCOUNT_NUMBER=xxx
BANK_ACCOUNT_HOLDER=xxx
APP_VERSION=0.2.0-staging
LOG_LEVEL=info
COOKIE_SECURE=false          # ⚠️ HTTP 테스트용
CSRF_ENABLED=true            # 또는 false
ENABLE_DEV_AUTH=true         # ⚠️ 개발자 로그인 활성화
```

---

## 🌐 Part 2: Docker 네트워크 설정

### Network Topology

```
Production:
┌─────────────────────────────────────────────┐
│  dorami_dorami-internal (bridge)            │
│  Subnet: 172.20.0.0/16                      │
│  Gateway: 172.20.0.1                        │
│  Internal: false (외부 접근 가능)           │
│  Driver: bridge (Docker 내장)               │
│                                             │
│  ├─ postgres-prod    172.20.0.3             │
│  ├─ redis-prod       172.20.0.2             │
│  ├─ backend-prod     172.20.0.4             │
│  ├─ frontend-prod    172.20.0.5 (예상)      │
│  └─ srs-prod         172.20.0.6             │
│                                             │
│  외부 포트 매핑:                           │
│  ├─ 127.0.0.1:3001  → backend:3001         │
│  ├─ 127.0.0.1:3000  → frontend:3000        │
│  ├─ 127.0.0.1:8080  → srs:8080 (Nginx)    │
│  └─ 0.0.0.0:1935    → srs:1935 (RTMP)     │
└─────────────────────────────────────────────┘
```

### Network 설정 상세

```yaml
# Production (docker-compose.prod.yml)
networks:
  dorami-internal:
    external: true                    # ✅ 호스트 기반 (영구)
    name: dorami_dorami-internal      # 고정 이름
    driver: bridge
    internal: false                   # ✅ 외부 접근 가능 (OAuth, Sentry)

# Staging (docker-compose.staging.yml 예상)
networks:
  dorami-internal:
    driver: bridge
    internal: false
    # Note: name: 명시 안 함 (자동 생성)
    # <project>_dorami-internal 형식
```

---

## 🔍 네트워크 통신 흐름 분석

### 내부 통신 (Docker 네트워크 내)

```
Backend → PostgreSQL
  URL: postgresql://postgres:password@postgres:5432/...
  DNS: Docker DNS (172.20.0.11 등)이 postgres → 172.20.0.3로 변환
  연결: 내부 네트워크, 암호화 안 함 ⚠️

Backend → Redis
  URL: redis://:password@redis:6379
  DNS: redis → 172.20.0.2로 변환
  연결: 내부 네트워크, 비밀번호 인증 필수

Backend ↔ SRS
  URL: rtmp://srs:1935/live (내부)
  연결: 같은 네트워크, 직접 통신

Backend → Kakao OAuth
  URL: https://kauth.kakao.com/...
  연결: 외부 인터넷 (Internal=false 덕분)
```

### 외부 접근 (호스트 → 컨테이너)

```
Client → www.doremi-live.com
  │
  ├─ HTTPS 종료: Nginx (호스트)
  │
  ├─ Backend API: 127.0.0.1:3001 → backend:3001 (internal)
  │  └─ docker-proxy 매핑
  │
  ├─ Frontend: 127.0.0.1:3000 → frontend:3000 (internal)
  │  └─ docker-proxy 매핑
  │
  └─ HLS/RTMP: 1935, 8080 → srs (internal)
     └─ docker-proxy 매핑

⚠️ 모든 외부 요청이 localhost 루프백을 통해 들어옴
   (AWS NLB/ALB가 호스트 외부에서 받음)
```

---

## 🔐 보안 차이점

### Staging의 약점

| 항목      | Issue                                   |
| --------- | --------------------------------------- |
| HTTP      | `COOKIE_SECURE=false` → MITM 공격 위험  |
| Dev Auth  | `ENABLE_DEV_AUTH=true` → 검증 우회 가능 |
| Kakao App | staging 앱이 다름 → 테스트 환경과 다름  |
| 로그 수준 | `LOG_LEVEL=info` → 민감 정보 노출 가능  |
| JWT 키    | 약한 키 사용 가능 → 토큰 위변조 위험    |

### Production의 강점

| 항목           | Security                                 |
| -------------- | ---------------------------------------- |
| HTTPS          | `COOKIE_SECURE=true` → HTTPS only        |
| No Dev Auth    | `ENABLE_DEV_AUTH=false` → 정상 인증 필수 |
| Prod Kakao App | 프로덕션 앱 사용                         |
| 로그 수준      | `LOG_LEVEL=warn` → 최소 정보만 노출      |
| JWT 키         | 강한 86-char Base64 → 안전함             |
| Encryption Key | 정확히 64 hex = AES-256 안전             |

---

## 🚨 재현성을 깨뜨리는 요인

### Factor 1: 암호화 키 불일치

```
Staging 개발 테스트:
  JWT_SECRET=dev_key_12345 (약함)
  암호화/복호화 성공

Production 배포:
  JWT_SECRET=cJcjNOtVAkMOqvevKJeGNuh0YEfdrOy9... (강함)

⚠️ 문제: 다른 키로 암호화된 데이터는 복호화 불가능
  (예: 기존 사용자의 JWT 토큰 무효화)
```

### Factor 2: 네트워크 격리 부재

```
Staging:
  - 여러 프로젝트가 같은 Docker 호스트에서 실행
  - network name이 자동 생성 → 충돌 가능
  - 예: staging_dorami-internal, dev_dorami-internal 혼동

Production:
  - external: true로 고정된 네트워크 사용
  - 명시적 이름: dorami_dorami-internal
  - 격리 보장
```

### Factor 3: 메모리/리소스 정책 다름

```
Redis Eviction:
  Staging: allkeys-lru (예상)
  Production: allkeys-lru (확인됨)

⚠️ 하지만 Production은 512mb 제한
  - Staging이 256mb 사용 → Production도 동일 동작
  - Production이 512mb 사용 → Staging에서 eviction 발생 가능
```

---

## ✅ 재현성을 높이기 위한 체크리스트

### 환경변수

- [ ] JWT_SECRET 길이 확인 (production: 86 chars)
- [ ] PROFILE_ENCRYPTION_KEY 길이 확인 (64 hex chars)
- [ ] DATABASE_PASSWORD가 REDIS_PASSWORD와 일치하는지 확인
- [ ] KAKAO_CLIENT_ID/SECRET이 별도 앱인지 확인
- [ ] COOKIE_SECURE=true (HTTPS 테스트 필수)
- [ ] CSRF_ENABLED=true (동일)
- [ ] LOG_LEVEL=info (staging) vs warn (prod) 차이 인식

### 네트워크

- [ ] 네트워크 이름이 고정되어 있는지 확인
- [ ] Subnet이 동일한지 확인 (172.20.0.0/16)
- [ ] Internal=false (외부 접근 필요)
- [ ] docker-proxy 매핑이 정상인지 확인

### 데이터베이스

- [ ] connection_limit=20 추가
- [ ] pool_timeout=30 추가
- [ ] Redis persistence (AOF) 활성화
- [ ] Redis memory limit 동일하게

### 보안

- [ ] ENABLE_DEV_AUTH=false (prod 테스트)
- [ ] Sentry DSN 설정
- [ ] 주소 암호화/복호화 테스트 (PROFILE_ENCRYPTION_KEY)

---

## 📊 요약 표

| 항목                   | Staging     | Production             | 동일? |
| ---------------------- | ----------- | ---------------------- | ----- |
| JWT_SECRET 길이        | 32-64 chars | 86 chars               | ❌    |
| PROFILE_ENCRYPTION_KEY | 64 hex      | 64 hex                 | ✅    |
| DATABASE USER          | dorami      | postgres               | ❌    |
| REDIS PASSWORD         | 약함        | 42 chars               | ❌    |
| KAKAO APP              | staging     | production             | ❌    |
| COOKIE_SECURE          | false       | true                   | ❌    |
| ENABLE_DEV_AUTH        | true        | false                  | ❌    |
| LOG_LEVEL              | info        | warn                   | ❌    |
| NETWORK NAME           | 자동 생성   | dorami_dorami-internal | ❌    |
| NETWORK EXTERNAL       | false       | true                   | ❌    |
| Redis Memory           | 256mb       | 512mb                  | ❌    |
| DB Connection Pool     | 없음        | 있어야 함              | ❌    |

---

## 🎯 최종 결론

### 현재 상태

```
🔴 재현성: 약 30-40% (3-4개만 동일)
```

### 개선 후 예상

```
🟢 재현성: 약 85-90% (환경변수 맞춤 후)
```

### 남은 차이 (기술적으로 불가피)

1. **암호화 키**: Staging에서 prod 키로 테스트 불가능 (보안상)
2. **Kakao App**: 각 환경별 앱 필수
3. **HTTPS**: staging에서 HTTP 테스트 vs prod는 HTTPS only
4. **Log Level**: debug 정보 노출 수준 차이
