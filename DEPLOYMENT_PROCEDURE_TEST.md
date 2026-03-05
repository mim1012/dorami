# 배포 절차 테스트 — 실제 실행 및 검증

**목표:** 배포 스크립트가 실제로 정상 동작하는지 확인

---

## 테스트 실행

### 1. Staging 서버 접속

```bash
ssh ubuntu@staging.doremi-live.com
cd /opt/dorami-staging
```

### 2. IMAGE_TAG 설정

```bash
export IMAGE_TAG="sha-abc123def"  # 실제 commit SHA로 변경
echo "Deploying: $IMAGE_TAG"
```

### 3. 배포 스크립트 실행

```bash
bash scripts/safe-deploy-staging.sh
```

**예상 출력:**

```
=== STAGING DEPLOYMENT TEST
This tests the production deployment procedure in staging
Image: ghcr.io/your-org/dorami-backend:sha-abc123def

✅ STEP 1: DB Backup
✅ STEP 2: DB Connectivity Test
✅ STEP 3: Network Verification
✅ STEP 4: Migration Preview (Status Check)
✅ STEP 5: Destructive Migration Safety Check
✅ STEP 6: Deploy Backend Container
✅ STEP 7: Wait for Backend Startup
✅ STEP 8: API Health Check
✅ STEP 9: Database Connectivity from Backend

✅ STAGING DEPLOYMENT TEST SUCCESS
```

---

## 검증 항목 1️⃣: Migration 정상 실행

### 확인 명령어

```bash
# Migration 상태 확인
docker exec dorami-backend npx prisma migrate status
```

### 예상 결과

```
✅ Database schema is up to date

No migrations to apply.
```

### 실패 시 확인 사항

```bash
# 1. 마이그레이션 파일 확인
ls -la backend/prisma/migrations/ | tail -10

# 2. Backend 로그에서 migration 에러 찾기
docker logs dorami-backend | grep -i "migration\|prisma" | tail -20

# 3. 환경변수 확인
docker exec dorami-backend env | grep DATABASE_URL
```

---

## 검증 항목 2️⃣: Backend 정상 시작

### 확인 명령어

```bash
# Backend 컨테이너 실행 확인
docker ps | grep dorami-backend
```

### 예상 결과

```
CONTAINER ID   IMAGE                          STATUS              PORTS
abc123def45    ghcr.io/.../dorami-backend:sha-abc123   Up 2 minutes   3001/tcp
```

### 실패 시 확인 사항

```bash
# 1. 컨테이너 상태 확인
docker ps -a | grep dorami-backend

# 2. 컨테이너 로그 확인
docker logs dorami-backend | tail -100

# 3. 포트 바인딩 확인
docker port dorami-backend

# 4. 네트워크 확인
docker network inspect dorami-internal | grep -A 5 "dorami-backend"
```

---

## 검증 항목 3️⃣: /api/health/ready OK

### 확인 명령어

```bash
# Health check 엔드포인트 테스트
curl -v http://localhost:3001/api/health/ready
```

### 예상 결과

```
> GET /api/health/ready HTTP/1.1
> Host: localhost:3001

< HTTP/1.1 200 OK
< Content-Type: application/json

{
  "status": "ok",
  "database": "connected",
  "redis": "connected"
}
```

### 실패 시 확인 사항

```bash
# 1. 다시 시도 (초기화 중일 수 있음)
sleep 10
curl http://localhost:3001/api/health/ready

# 2. Backend 로그에서 에러 찾기
docker logs dorami-backend | grep -i "error\|database\|redis" | tail -20

# 3. 데이터베이스 연결 확인
docker exec dorami-backend npx prisma db execute --stdin << 'SQL'
SELECT 1 as test;
SQL

# 4. Redis 연결 확인
docker exec dorami-redis redis-cli ping
```

---

## 검증 항목 4️⃣: 사이트 기능 정상

### 확인 항목

#### A. 기본 API 응답

```bash
# 일반 API 엔드포인트 테스트
curl -v http://localhost:3001/api/health/live
```

**예상 결과:** `200 OK`

#### B. 데이터 바인딩 확인 (스테이징에서 브라우저로)

```
URL: http://staging.doremi-live.com
또는: https://staging.doremi-live.com
```

**확인 체크리스트:**

- [ ] 사이트 로드됨 (Network tab 에서 200 상태)
- [ ] CSS/JS 로드됨 (스타일이 적용됨)
- [ ] 로고, 헤더, 네비게이션 보임
- [ ] 상품 리스트 표시됨
- [ ] 메뉴 항목 클릭 가능
- [ ] API 호출 성공 (Network > XHR/Fetch 탭에서 200/201)
- [ ] 콘솔 에러 없음 (DevTools > Console 탭)
- [ ] 로그인 버튼 동작
- [ ] 채팅 연결 시도 (WebSocket 연결)

#### C. 데이터베이스 조회

```bash
# 실제 데이터 확인
docker exec dorami-postgres psql -U dorami -d live_commerce -c \
  "SELECT COUNT(*) as product_count FROM products;"
```

**예상 결과:**

```
 product_count
───────────────
      N (N > 0)
```

---

## 빠른 검증 체크리스트

아래 명령어들을 순서대로 실행하고 모두 ✅이면 배포 성공:

```bash
# ✅ 1. Backend 실행 확인
docker ps | grep dorami-backend && echo "✅ Backend running" || echo "❌ Backend not running"

# ✅ 2. Migration 확인
docker exec dorami-backend npx prisma migrate status | grep -q "schema is up to date" && echo "✅ Migrations OK" || echo "❌ Migration issue"

# ✅ 3. Health check 확인
curl -s http://localhost:3001/api/health/ready | grep -q "ok" && echo "✅ Health check OK" || echo "❌ Health check failed"

# ✅ 4. 데이터베이스 연결 확인
docker exec dorami-backend npx prisma db execute --stdin < /dev/null > /dev/null 2>&1 && echo "✅ Database connected" || echo "❌ Database connection failed"

# ✅ 5. 로그 에러 확인
docker logs dorami-backend | grep -i "error" | wc -l
# 결과 = 0이면 ✅ (에러 없음), > 0이면 내용 확인
```

---

## 배포 성공 기준

아래 4가지 **모두** 확인되어야 배포 성공:

### 1️⃣ Migration 정상 실행 ✅

```
prisma migrate status → "schema is up to date"
```

### 2️⃣ Backend 정상 시작 ✅

```
docker ps → dorami-backend Up X minutes
```

### 3️⃣ Health Check OK ✅

```
curl /api/health/ready → 200 OK
```

### 4️⃣ 사이트 기능 정상 ✅

```
브라우저 접속 → 페이지 로드
API 호출 → 200 상태 코드
콘솔 → 에러 없음
```

---

## 실패 시 대응

### 시나리오 1: Migration 실패

```bash
# 1️⃣ 마이그레이션 파일 확인
cat backend/prisma/migrations/*/migration.sql | head -50

# 2️⃣ 데이터베이스 상태 확인
docker exec dorami-postgres psql -U dorami -d live_commerce -c "\dt"

# 3️⃣ 롤백
docker compose -f docker-compose.base.yml -f docker-compose.staging.yml down
# 백업에서 복구하거나 다시 시도
```

### 시나리오 2: Backend 시작 실패

```bash
# 1️⃣ 로그 확인
docker logs dorami-backend | tail -100

# 2️⃣ 환경변수 확인
cat .env.staging | head -20

# 3️⃣ 컨테이너 재시작
docker restart dorami-backend
sleep 10
curl http://localhost:3001/api/health/ready
```

### 시나리오 3: Health Check 실패

```bash
# 1️⃣ Backend 초기화 대기
sleep 30
curl http://localhost:3001/api/health/ready

# 2️⃣ 데이터베이스 연결 확인
docker exec dorami-backend npx prisma db execute --stdin << 'SQL'
SELECT NOW();
SQL

# 3️⃣ Redis 연결 확인
docker exec dorami-redis redis-cli ping
```

### 시나리오 4: API 에러

```bash
# 1️⃣ Network tab에서 응답 코드 확인
curl -v http://localhost:3001/api/health/ready

# 2️⃣ Backend 로그에서 상세 에러 확인
docker logs dorami-backend | grep -A 5 "error\|exception" | tail -30

# 3️⃣ 콘솔 에러 확인 (브라우저 DevTools)
# F12 → Console → 빨간 에러 메시지 확인
```

---

## 최종 결과

### ✅ 성공

모든 검증 항목을 통과하면:

```
✅ Migration 정상 실행
✅ Backend 정상 시작
✅ /api/health/ready OK
✅ 사이트 기능 정상

→ 프로덕션 배포 준비 완료!
```

### ❌ 실패

하나라도 실패하면:

```
❌ 해당 항목 문제 해결
❌ 로그에서 원인 파악
❌ 수정 후 배포 스크립트 재실행
❌ 다시 검증
```

---

## 다음 단계

### ✅ 스테이징 테스트 성공 시

→ 프로덕션 배포 준비 완료
→ `safe-deploy-production.sh`를 동일한 IMAGE_TAG로 실행

### ❌ 스테이징 테스트 실패 시

→ 스테이징에서 문제 해결
→ 수정 후 스테이징 재테스트
→ 성공 후 프로덕션 배포
