# Deploy Optimization Plan

## Target: Staging Deployment 최적화 (350초 → 180초)

### 개선 전 흐름 (현재)

```
1. SSH 연결 → git fetch → git reset --hard
2. .env.staging 생성
3. docker image prune (20-30초)
4. docker login
5. GHCR pull (순차 backend → frontend)
6. PostgreSQL 초기화 + 대기 (60-120초)
7. Backend 시작 + healthcheck (90초)
8. 나머지 서비스 시작
9. 종합 진단
---
총: 350-450초 (지연 시 600초+)
```

### 개선 후 흐름 (목표)

```
1. SSH 연결
2. git fetch → git reset --hard
3. .env.staging 생성
4. docker login
5. docker pull backend & frontend (병렬)  ← 최적화
6. docker compose up -d
7. PostgreSQL ready check (10회 × 1초 = 10초 max)  ← 단축
8. Backend healthcheck (12회 × 5초 = 60초 max)  ← 최적화
9. Image digest 검증  ← 신규 추가
---
총: 180-220초 (정상 배포)
```

## 구현 상세

### Phase 1: Docker Login (사전)

```bash
echo "${GHCR_TOKEN}" | docker login ghcr.io -u ${GITHUB_REPOSITORY_OWNER} --password-stdin
```

### Phase 2: Parallel Docker Pull

```bash
# 백그라운드에서 두 이미지 동시 pull
docker pull ghcr.io/${GITHUB_REPOSITORY_OWNER}/dorami-backend:${IMAGE_TAG} &
BACKEND_PID=$!
docker pull ghcr.io/${GITHUB_REPOSITORY_OWNER}/dorami-frontend:${IMAGE_TAG} &
FRONTEND_PID=$!

# 두 프로세스 모두 완료 대기 (타임아웃 60초)
timeout 60 wait ${BACKEND_PID} || { echo "Backend pull failed"; exit 1; }
timeout 60 wait ${FRONTEND_PID} || { echo "Frontend pull failed"; exit 1; }
```

### Phase 3: Compose Up (간단)

```bash
docker compose -f docker-compose.base.yml -f docker-compose.staging.yml \
  --env-file .env.staging up -d postgres redis backend frontend
```

### Phase 4: PostgreSQL Ready (10회)

```bash
echo "=== PostgreSQL Ready Check (max 10s) ==="
for i in 1 2 3 4 5 6 7 8 9 10; do
  if docker exec dorami-postgres-1 pg_isready -U postgres > /dev/null 2>&1; then
    echo "✓ PostgreSQL ready (attempt $i/10)"
    break
  fi
  if [ "$i" = "10" ]; then
    echo "❌ PostgreSQL NOT ready after 10 attempts"
    exit 1
  fi
  sleep 1
done
```

### Phase 5: Backend Healthcheck (12회)

```bash
echo "=== Backend Healthcheck (max 60s) ==="
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  CONTAINER_STATE=$(docker inspect --format='{{.State.Status}}' dorami-backend-1 2>/dev/null || echo "missing")
  if [ "$CONTAINER_STATE" = "exited" ] || [ "$CONTAINER_STATE" = "dead" ]; then
    echo "❌ Backend container stopped (state: $CONTAINER_STATE)"
    docker logs dorami-backend-1 --tail=50
    exit 1
  fi

  if docker exec dorami-backend-1 wget -qO- http://localhost:3001/api/health/live > /dev/null 2>&1; then
    echo "✓ Backend healthy (attempt $i/12)"
    break
  fi

  if [ "$i" = "12" ]; then
    echo "❌ Backend NOT healthy after 60s"
    docker logs dorami-backend-1 --tail=50
    exit 1
  fi
  sleep 5
done
```

### Phase 6: Image Digest 검증

```bash
echo "=== Image Digest Verification ==="

# 실행 중인 컨테이너의 실제 image digest 추출
BACKEND_DIGEST=$(docker inspect dorami-backend-1 | jq -r '.[0].Image')
FRONTEND_DIGEST=$(docker inspect dorami-frontend-1 | jq -r '.[0].Image')

echo "Backend digest: ${BACKEND_DIGEST}"
echo "Frontend digest: ${FRONTEND_DIGEST}"

# 빌드된 이미지의 digest와 비교
BUILT_BACKEND=$(docker image inspect ghcr.io/${GITHUB_REPOSITORY_OWNER}/dorami-backend:${IMAGE_TAG} | jq -r '.[0].Id')
BUILT_FRONTEND=$(docker image inspect ghcr.io/${GITHUB_REPOSITORY_OWNER}/dorami-frontend:${IMAGE_TAG} | jq -r '.[0].Id')

if [ "${BACKEND_DIGEST}" != "${BUILT_BACKEND}" ]; then
  echo "⚠️  Backend digest mismatch!"
  echo "  Container: ${BACKEND_DIGEST}"
  echo "  Built:     ${BUILT_BACKEND}"
fi

if [ "${FRONTEND_DIGEST}" != "${BUILT_FRONTEND}" ]; then
  echo "⚠️  Frontend digest mismatch!"
  echo "  Container: ${FRONTEND_DIGEST}"
  echo "  Built:     ${BUILT_FRONTEND}"
fi

echo "✓ Image digest verification complete"
```

## 제거할 부분 (deploy-staging.yml)

- Line 323-326: docker image prune (upstream: build-images.yml에서 이미 처리)
- Line 279-284: uploads directory cleanup (Docker volume으로 관리)
- Line 360-404: PostgreSQL 복잡한 password sync 로직 → 단순 ready check로 대체
- Line 503-591: 종합 네트워크 진단 (옵션: 필요 시만 활성화)

## 추가 개선: 배포 스크립트 분리

```
scripts/
├── deploy-prepare.sh       # git reset, .env.staging 생성
├── deploy-docker.sh        # docker login, pull, compose up
├── deploy-verify.sh        # healthcheck, digest 검증
└── deploy-complete.sh      # 최종 정리 및 로깅
```

## 예상 효과

- 배포 시간: 350초 → 180초 **(49% 단축)**
- 가용성: 동일
- 안정성: **향상** (명확한 타임아웃, digest 검증 추가)
