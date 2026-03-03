# ⚠️ Staging ≠ Production: 재현성 문제 분석 보고서

**작성일**: 2026-03-03
**대상**: dorami 프로덕션 환경 (139명 사용자)

---

## 🔴 핵심 발견: 100% 재현성은 거짓

Staging에서 테스트한 이미지가 Production에서 **동일하게 동작하지 않습니다.**

### 이유: 환경변수 + 리소스 설정 차이

```
Stage 1: Image는 동일 ✅
  dorami-backend:sha-76c6b4a10597d6a2c6255f745d317517a6e4b2a4

Stage 2: 하지만 실행 환경은 다름 ❌
  - DATABASE_URL 옵션 차이
  - 리소스 제한 차이
  - LOG_LEVEL 차이
  - CSRF/AUTH 정책 차이
```

---

## 📊 비교: Staging vs Production (실제 배포 환경)

### 1️⃣ **DATABASE_URL 차이**

#### Staging (.env.staging.example)

```bash
DATABASE_URL=postgresql://dorami:password@postgres:5432/live_commerce
# ❌ connection_limit 없음
# ❌ pool_timeout 없음
```

#### Production (실제 배포)

```bash
DATABASE_URL=postgresql://postgres:dzj1n2o5BxDWUC07sZ9epZTHStGgzyj5rQPscV+BkIo=@postgres:5432/live_commerce?schema=public
# ❌ connection_limit=20 없음 (docker-compose.prod.yml에는 있어야 함)
# ❌ pool_timeout=30 없음 (docker-compose.prod.yml에는 있어야 함)
```

**문제점:**

- 문서상: `connection_limit=20&pool_timeout=30` 명시
- 실제 환경: **둘 다 없음**
- 결과: PostgreSQL 연결 풀이 무제한 상태로 동작
- 부하 시나리오: 200+ 동시 접속 시 연결 고갈 위험

---

### 2️⃣ **리소스 제한 차이**

#### docker-compose.prod.yml (설정상)

```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '2' # 2 CPU 코어
        memory: 1G # 1GB 메모리
      reservations:
        cpus: '0.5'
        memory: 256M
```

#### Production 실제 실행 환경

```bash
CpuQuota: 0          # ❌ CPU 제한 없음 (무제한)
CpuPeriod: 0         # ❌ 무제한 상태
CpuShares: 0         # ❌ CPU 공유 정책 없음
Memory: 1073741824   # ✅ 1GB (설정됨)
```

**문제점:**

- CPU 제한이 **적용되지 않음** (CpuQuota=0)
- Staging: CPU 무제한 → 100-200명 동시 가능
- Production: 의도상 2core 제한이지만, 실제로는 **무제한**
- 결과: 예상한 성능 프로필이 아님

**왜 CPU 제한이 적용 안 됨?**

```yaml
# ❌ deploy.resources.limits가 docker-compose v3.8에서는 Swarm 모드에서만 작동
# Standalone Docker Compose에서는 --cpus 옵션을 직접 사용해야 함
```

---

### 3️⃣ **로그 레벨 차이**

| 항목                 | Staging | Production |
| -------------------- | ------- | ---------- |
| LOG_LEVEL            | `info`  | `warn` ✅  |
| Connection Pool 로그 | 상세    | 최소       |
| 에러 추적 용이성     | 쉬움    | 어려움     |

**문제점:**

- Production에서 `WARN` 레벨이면 정상적인 DB 연결 로그는 안 나타남
- Connection 문제 발생 시 디버깅 어려움
- Staging에서는 상세 로그로 문제 감지 가능

---

## 🎯 실제 부하 시나리오에서의 동작 차이

### 시나리오: 100명 → 150명 → 200명 동시 사용자

#### Staging (예상 결과)

```
100명: ✅ OK (정상)
150명: ✅ OK (메모리 여유)
200명: ⚠️ 느려짐 (메모리 부족)
```

#### Production (실제)

```
100명: ✅ OK (정상)
150명: ✅ OK (메모리 여유)

⚠️ 200명: ???
  - CPU 제한이 없으므로 예상과 다름
  - Connection Pool 무제한이므로 예상과 다름
  - Staging과 다른 패턴으로 실패할 가능성 높음
```

---

## 📋 발견된 불일치 목록

### 🔴 Critical (즉시 수정 필요)

| 항목                          | 설정 파일   | 실제 환경 | 영향                |
| ----------------------------- | ----------- | --------- | ------------------- |
| DATABASE_URL connection_limit | `20`        | 없음      | 연결 고갈 위험      |
| DATABASE_URL pool_timeout     | `30s`       | 없음      | 타임아웃 처리 안 됨 |
| Backend CPU Limit             | `2 cores`   | 무제한    | 성능 예측 불가      |
| Backend CPU Reservation       | `0.5 cores` | 무제한    | 리소스 격리 실패    |

### 🟡 High (다음 배포에서 수정)

| 항목            | Staging | Production | 영향             |
| --------------- | ------- | ---------- | ---------------- |
| ENABLE_DEV_AUTH | `true`  | `false`    | 테스트 방식 다름 |
| COOKIE_SECURE   | `false` | `true`     | HTTPS 여부 다름  |
| LOG_LEVEL       | `info`  | `warn`     | 디버깅 어려움    |

---

## 📍 현재 상태 요약

### Production 서버 정보

```
✅ 시스템 안정성: 7일 가동 무중단
✅ 메모리 사용: 32% (여유 있음)
✅ 디스크 사용: 67% (안전)
✅ 컨테이너 상태: 모두 healthy
⚠️ DB 활성 연결: 5개 (정상)
⚠️ CPU 사용: 0.11 load average (낮음)

❌ CPU 제한: 미적용
❌ Connection Pool: 무제한
```

### Staging 서버 정보

```
❌ 접속 실패: staging-key 권한 문제
   (별도 조치 필요)
```

---

## 🔧 문제 원인 분석

### 원인 1: docker-compose v3.8 deploy 설정의 한계

```yaml
# ❌ v3.8에서 deploy.resources는 Swarm 모드에서만 작동
deploy:
  resources:
    limits:
      cpus: '2' # Swarm 모드 전용, Standalone에서는 무시됨

# ✅ Standalone에서는 이렇게 해야 함
services:
  backend:
    cpus: '2' # docker-compose v3.9+
    mem_limit: 1g # 또는 이 옵션
```

**현재 상황:** docker-compose v5.0.2 사용 중이므로 최신 문법 지원 가능

### 원인 2: .env.production 파일의 DATABASE_URL이 불완전

```bash
# .env.production에 설정해야 함
DATABASE_URL="postgresql://...?schema=public&connection_limit=20&pool_timeout=30"

# 하지만 현재는 schema=public만 있음
DATABASE_URL="postgresql://...?schema=public"
```

### 원인 3: docker-compose.base.yml과 docker-compose.prod.yml의 합성 시 누락

```yaml
# docker-compose.prod.yml에서 명시해야 함
services:
  backend:
    environment:
      DATABASE_URL: ${DATABASE_URL} # .env.production에서 주입


# 문제: .env.production에 connection_limit/pool_timeout 없음
```

---

## 🚀 수정 방안

### Step 1: .env.production 수정

```bash
# Before
DATABASE_URL=postgresql://user:pass@postgres:5432/live_commerce?schema=public

# After
DATABASE_URL=postgresql://user:pass@postgres:5432/live_commerce?schema=public&connection_limit=20&pool_timeout=30
```

### Step 2: docker-compose.prod.yml의 CPU 제한 수정

```yaml
# Option A: 최신 docker-compose (v3.9+)
services:
  backend:
    cpus: '2'
    mem_limit: 1g
    memswap_limit: 2g

# Option B: --cpus 플래그 사용
# docker-compose -f docker-compose.prod.yml up --cpus 2

# Option C: docker run 직접 사용
# docker run --cpus 2 --memory 1g ...
```

### Step 3: 검증 방법

```bash
# 배포 후 확인
docker inspect dorami-backend-prod | jq '.[0].HostConfig | {Memory, CpuQuota, CpuPeriod}'

# 예상 결과
# {
#   "Memory": 1073741824,      # 1GB
#   "CpuQuota": 200000,        # 2 CPUs
#   "CpuPeriod": 100000
# }
```

---

## 📈 예상 영향 분석

### 현재 상태 (재현성 없음)

- **Staging**: CPU 무제한, Connection Pool 무제한
- **Production**: 의도상 CPU 2core, Connection Pool 20
- **실제 Production**: CPU 무제한, Connection Pool 무제한 ❌

### 수정 후 (재현성 향상)

- **Staging**: CPU 무제한, Connection Pool 무제한 (개발용)
- **Production**: CPU 2core, Connection Pool 20 (안정화)
- **기대 효과**:
  - 부하 테스트 결과의 신뢰성 ⬆️
  - Production 성능 예측 가능성 ⬆️
  - 139명 사용자 데이터 안전성 ⬆️

---

## ⚠️ 결론

> **Develop 브랜치에서 100명을 테스트해도, Main 브랜치는 다르게 동작할 수 있습니다.**

### 근본 원인

1. **docker-compose 설정과 실제 실행 환경의 불일치**
2. **DATABASE_URL의 불완전한 옵션**
3. **리소스 제한이 적용되지 않음**

### 해결책

1. ✅ `.env.production`에 `connection_limit=20&pool_timeout=30` 추가
2. ✅ `docker-compose.prod.yml`의 CPU 제한을 현대식으로 수정
3. ✅ 배포 후 `docker inspect`로 검증
4. ✅ Staging과 Production을 동일한 리소스 제한으로 테스트

### 다음 액션

- [ ] `.env.production.example` 수정
- [ ] `docker-compose.prod.yml` 수정
- [ ] 마이그레이션 스크립트 작성
- [ ] Production에서 재배포 후 검증
- [ ] 로드 테스트 재실행 (동일한 조건)
