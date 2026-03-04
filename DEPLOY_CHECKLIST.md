# 🚀 안정적인 배포 체크리스트

## 📋 배포 전 로컬 검증 (10분)

### 1️⃣ 코드 검증

```bash
# TypeScript 컴파일 확인
npm run type-check:all

# Linting 확인
npm run lint:all

# 테스트 실행
npm run test:backend
```

**체크:**

- ✅ No TypeScript errors
- ✅ No lint warnings
- ✅ All tests passing

### 2️⃣ Docker 이미지 빌드 (로컬)

```bash
# 로컬에서 먼저 빌드 테스트
cd backend && npm run build
cd ../client-app && npm run build
```

**체크:**

- ✅ Backend build succeeds
- ✅ Frontend build succeeds
- ✅ No critical warnings

### 3️⃣ 환경변수 검증

```bash
# 스테이징 env 파일 확인
cat .env.staging | grep -E "DATABASE_URL|REDIS_URL|ENABLE_DEV_AUTH|RTMP_SERVER_URL"
```

**필수 변수 확인:**

- ✅ `ENABLE_DEV_AUTH=true` (staging only)
- ✅ `RTMP_SERVER_URL=rtmp://srs:1935/live` (내부 네트워크)
- ✅ `DATABASE_URL` with `sslmode=prefer` (production만)
- ✅ `REDIS_PASSWORD` set
- ✅ `JWT_SECRET` (64+ chars)

### 4️⃣ 로컬 Docker Compose 테스트

```bash
# 로컬에서 전체 스택 테스트
npm run docker:up
npm run prisma:migrate
npm run dev:all

# 5분 대기 (모든 서비스 준비)
sleep 300

# Health check
curl http://localhost:3001/api/health/live
curl http://localhost:3000
```

**체크:**

- ✅ Backend health: 200 OK
- ✅ Frontend loads: 200 OK
- ✅ No error logs

---

## 🔍 배포 후 검증 (smoke tests)

### Health Check 순서

1. **Backend Health (HTTP 200)**

   ```
   GET http://localhost:3001/api/health/live
   Response: {"data":{"status":"ok"}}
   ```

2. **Frontend Health (HTTP 200)**

   ```
   GET http://localhost:3000
   Response: HTML page loads
   ```

3. **API Response Test**

   ```
   GET http://localhost:3001/api/health/live
   Parse JSON successfully
   ```

4. **Dev Login Test** ⚠️ CRITICAL

   ```bash
   curl -X POST http://localhost:3001/api/auth/dev-login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@test.local","name":"Test"}' \
     -c /tmp/cookies.txt

   # Response: HTTP 201 with JWT token
   ```

5. **Upload Test**

   ```bash
   # Use saved cookies from dev-login
   curl -X POST http://localhost:3001/api/upload/image \
     -b /tmp/cookies.txt \
     -F "file=@image.png;type=image/png"

   # Response: HTTP 201 (URL returned)
   ```

---

## ⚠️ 일반적인 실패 원인 & 해결책

### 502 Bad Gateway (Nginx)

**원인:** Backend 컨테이너 미응답

```bash
# 확인
docker logs dorami-backend-prod | tail -50

# 해결
1. Redis 연결 확인: docker logs dorami-redis-prod
2. PostgreSQL 연결 확인: docker logs dorami-postgres-prod
3. 환경변수 재확인: docker inspect dorami-backend-prod
4. 컨테이너 재시작: docker restart dorami-backend-prod
```

### 500 Internal Server Error

**원인:** 데이터베이스 마이그레이션 미완료 또는 환경변수 오류

```bash
# 확인
docker logs dorami-backend-prod | grep -i "error\|migration\|database"

# 해결
1. 마이그레이션 상태 확인
2. 환경변수 확인 (특히 DATABASE_URL)
3. 데이터베이스 연결 테스트: docker exec dorami-postgres-prod psql -U dorami -d live_commerce -c "SELECT 1"
```

### Upload Test 실패 (HTTP 22)

**원인:** Dev Login 실패 또는 쿠키 미전달

```bash
# 확인
docker logs dorami-backend-prod | grep -i "auth\|upload\|forbidden"

# 해결
1. ENABLE_DEV_AUTH=true 확인
2. JWT_SECRET 설정 확인
3. 쿠키 전달 확인: curl -b /tmp/cookies.txt (중요!)
```

---

## 🔄 배포 실패 시 롤백

### 빠른 롤백 방법

```bash
# 이전 이미지로 롤백
docker-compose down
git checkout HEAD~1  # 이전 커밋으로
docker-compose -f docker-compose.prod.yml up -d

# 또는 특정 이미지로
docker pull ghcr.io/mim1012/dorami-backend:previous-tag
docker tag ghcr.io/mim1012/dorami-backend:previous-tag \
           ghcr.io/mim1012/dorami-backend:latest
docker-compose restart backend
```

---

## 📊 배포 프로세스 요약

```
develop branch commit
        ↓
GitHub Actions 자동 트리거
        ↓
1. 코드 검증 (TypeScript, Lint, Test)
        ↓
2. Docker 이미지 빌드 & 푸시
        ↓
3. Staging 배포 (docker-compose up)
        ↓
4. Health Check (5분 대기)
   - Backend: 200 OK
   - Frontend: 200 OK
        ↓
5. Smoke Tests
   - Dev Login
   - Upload Test
   - API Response
        ↓
✅ 배포 완료 또는 ❌ 롤백
```

---

## 🎯 체크리스트 사용 방법

**배포 전:**

1. 위의 "로컬 검증" 섹션 따라하기
2. 모든 항목 ✅ 확인

**배포 후:**

1. GitHub Actions 로그 모니터링
2. Health checks 통과 확인
3. Staging 서버에서 manual 테스트

**문제 발생 시:**

1. "일반적인 실패 원인" 섹션 참고
2. 해당 서비스 로그 확인
3. 필요시 롤백
