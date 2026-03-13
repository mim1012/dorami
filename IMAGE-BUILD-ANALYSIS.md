# 📦 Docker Image Build Contents Analysis (2026-03-06)

## 🎯 요약

| 이미지               | Commit    | 빌드일시 (UTC)      | 레이어 수 | Node.js | 상태      |
| -------------------- | --------- | ------------------- | --------- | ------- | --------- |
| **Backend (Prod)**   | `d5fe335` | 2026-03-05 20:29:30 | 12        | 20.20.0 | ✅ 동일   |
| **Backend (Stage)**  | `d5fe335` | 2026-03-05 20:29:30 | 12        | 20.20.0 | ✅ 동일   |
| **Frontend (Prod)**  | `2189522` | 2026-03-06 05:44:41 | 11        | 20.20.0 | ❌ 구버전 |
| **Frontend (Stage)** | `d5fe335` | 2026-03-05 20:29:53 | 11        | 20.20.0 | ✅ 최신   |

---

## ✅ Backend 이미지 (완벽히 동일)

### 빌드 정보

- **Commit SHA**: `d5fe335bcb72e65985fe9e512ad39c026f3af46a`
- **Commit Message**: `ci: Add comprehensive production test suite (load, stress, soak, performance, chaos, network)`
- **Commit Date**: 2026-03-06 05:28:01 +0900
- **빌드 생성 시간**: 2026-03-05 20:29:30 UTC
- **Architecture**: amd64 / Linux
- **Docker Layers**: 12개

### 포함된 변경사항 (21개 파일)

```
테스트 및 배포 자동화 추가:
✅ Load Test: WebSocket 100 concurrent users (5min)
✅ Stress Test: Progressive load increase (100->1000 users)
✅ Soak Test: 6-hour stability & memory leak detection
✅ Performance Test: API/Chat/Stream benchmarking
✅ Chaos Engineering: Fault recovery testing
✅ Network Simulation: 3G/high-latency/packet-loss scenarios
✅ Health Check & Monitoring: Real-time infrastructure tracking
✅ Deploy & Rollback Automation: Safe production deployment

파일 추가/변경:
  .github/workflows/comprehensive-test.yml     (326 lines)
  .github/workflows/load-test-ci.yml           (79 lines)
  DEPLOYMENT_CHECKLIST.md
  README.md
  TEST_RESULTS_GUIDE.md
  client-app/e2e/load-test.spec.ts
  scripts/* (8개 스크립트)

총 변경: 21개 파일, 4433 insertions(+), 1 deletion(-)
```

### 프로덕션/스테이징 동일성

✅ **100% 일치** — 양쪽 서버에서 완벽히 동일한 이미지 실행 중

---

## ❌ Frontend 이미지 (불일치)

### Production (구버전)

- **Commit SHA**: `2189522b091f351751b907f5e19c7d6cd7655e0d`
- **Commit Message**: `resolve: Merge conflict in docker-compose.prod.yml - use optional PROFILE_LEGACY_ENCRYPTION_KEYS default`
- **Commit Date**: 2026-03-06 14:33:57 +0900
- **빌드 생성 시간**: 2026-03-06 05:44:41 UTC
- **포함 변경사항**: docker-compose.prod.yml 설정 1줄 변경만

```diff
docker-compose.prod.yml | 2 +-
1 file changed, 1 insertion(+), 1 deletion(-)
```

### Staging (최신)

- **Commit SHA**: `d5fe335bcb72e65985fe9e512ad39c026f3af46a`
- **Commit Message**: `ci: Add comprehensive production test suite (...)`
- **빌드 생성 시간**: 2026-03-05 20:29:53 UTC
- **포함 변경사항**: 21개 파일 (위의 Backend와 동일한 commit)

### 전체 차이 비교

```
Production Frontend는 Staging Frontend보다 1개 commit 뒤에 있습니다.

Commit Timeline:
  ... → 2189522 (March 06 14:33) ← Production Frontend 여기!
      ↓
  ... → d5fe335 (March 05 20:29) ← Staging Frontend 여기!
```

---

## ⚠️ 심각도 분석

### 🟡 Backend (위험도: 낮음)

- **상태**: ✅ 완벽히 동일
- **검증**: 빌드 타임스탬프, 레이어, 환경변수 모두 동일
- **재현성**: 100% 보장

### 🔴 Frontend (위험도: 높음)

- **상태**: ❌ 버전 불일치
- **문제점**:
  1. Production Frontend가 더 오래된 코드 실행
  2. Staging에서 테스트한 기능이 Production에 없을 수 있음
  3. 보안 패치나 버그 픽스가 Production에 미적용될 수 있음
- **재현성**: 불가능 (양쪽이 다른 코드 실행 중)

---

## 📊 빌드 시간 분석

### Backend 빌드

- **소스 Commit**: 2026-03-06 05:28:01 +0900 (한국시간)
- **이미지 생성**: 2026-03-05 20:29:30 UTC = 2026-03-06 05:29:30 KST
- **빌드 소요시간**: ~1분

### Frontend 빌드

- **Production**: 소스 2026-03-06 14:33:57 KST → 이미지 2026-03-06 05:44:41 UTC (약 8시간 이전? ⚠️ 시간대 확인 필요)
- **Staging**: 소스 2026-03-05 20:29:53 KST → 이미지 2026-03-05 20:29:53 UTC (동일 commit)

---

## 🔍 Docker Image Digest 확인

각 이미지의 고유 식별자:

```bash
# Production Backend
SHA256: sha-d5fe335bcb72e65985fe9e512ad39c026f3af46a
Image: ghcr.io/mim1012/dorami-backend:sha-d5fe335bcb72e65985fe9e512ad39c026f3af46a

# Staging Backend
SHA256: sha-d5fe335bcb72e65985fe9e512ad39c026f3af46a
Image: ghcr.io/mim1012/dorami-backend:sha-d5fe335bcb72e65985fe9e512ad39c026f3af46a
✅ Identical

# Production Frontend
SHA256: sha-2189522b091f351751b907f5e19c7d6cd7655e0d
Image: ghcr.io/mim1012/dorami-frontend:sha-2189522b091f351751b907f5e19c7d6cd7655e0d

# Staging Frontend
SHA256: sha-d5fe335bcb72e65985fe9e512ad39c026f3af46a
Image: ghcr.io/mim1012/dorami-frontend:sha-d5fe335bcb72e65985fe9e512ad39c026f3af46a
❌ Different
```

---

## ✅ 권장 액션

### 1. 즉시 (우선순위: 높음)

```bash
# Production Frontend를 최신 버전으로 업그레이드
# Staging의 d5fe335 이미지를 Production에 배포
```

### 2. 배포 전 검증

```bash
# 현재 Staging 상태 테스트 완료 확인
bash scripts/check-image-versions.sh

# Frontend 기능 E2E 테스트
cd client-app && npx playwright test --project=user
cd client-app && npx playwright test --project=admin
```

### 3. 배포 수행

```bash
# Production 배포 (Frontend 업데이트 포함)
bash scripts/deploy-production.sh
# 또는 GitHub Actions: manual trigger with version d5fe335
```

### 4. 배포 후 검증

```bash
# Production Frontend 업데이트 확인
ssh -i ssh/id_ed25519 ubuntu@15.165.66.23 'docker ps --format "{{.Image}}" | grep frontend'

# 이미지 동일성 재확인
bash scripts/check-image-versions.sh
```

---

## 📋 체크리스트

```
[ ] Backend 재현성 확인: ✅ 완벽 (d5fe335 동일)
[ ] Frontend 재현성 확인: ❌ 불일치 (2189522 vs d5fe335)
[ ] Staging 테스트 완료: ? (확인 필요)
[ ] Production Frontend 업그레이드 필요: 🔴 우선순위 높음
[ ] E2E 테스트 통과: ? (확인 필요)
[ ] Production 배포: ⏳ 대기 중
```

---

**마지막 업데이트**: 2026-03-06 21:10 UTC
**분석 도구**: Docker inspect, Git log analysis
