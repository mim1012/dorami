# CI/CD Pipeline Guide

**프로젝트**: Dorami Live Commerce
**작성일**: 2026-02-05

---

## 📋 목차

1. [파이프라인 개요](#파이프라인-개요)
2. [GitHub Actions 워크플로우](#github-actions-워크플로우)
3. [필수 Secrets 설정](#필수-secrets-설정)
4. [배포 프로세스](#배포-프로세스)
5. [트러블슈팅](#트러블슈팅)

---

## 🏗️ 파이프라인 개요

### 워크플로우 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    코드 푸시 (develop/main)                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  CI Workflow (.github/workflows/ci.yml)                      │
│  • 변경사항 감지 (Backend/Frontend/Infra)                      │
│  • Backend: Lint, Type Check, Unit Tests, E2E Tests, Build  │
│  • Frontend: Lint, Type Check, Build                        │
│  • Docker 이미지 빌드 테스트                                    │
│  • 보안 스캔 (Trivy)                                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├─── [develop 브랜치] ───────────────────────┐
                 │                                             ▼
                 │              ┌──────────────────────────────────────┐
                 │              │  Staging 배포                         │
                 │              │  (.github/workflows/deploy-staging.yml)│
                 │              │  • CI 테스트 재실행                    │
                 │              │  • Docker 이미지 빌드 & 푸시           │
                 │              │  • SSH로 Staging 서버 배포            │
                 │              │  • 스모크 테스트                       │
                 │              └──────────────────────────────────────┘
                 │
                 └─── [release 태그 / 수동] ──────────────────┐
                                                               ▼
                                    ┌────────────────────────────────────┐
                                    │  Production 배포                   │
                                    │  (.github/workflows/deploy-production.yml)│
                                    │  • 버전 검증                        │
                                    │  • CI 테스트 (선택)                 │
                                    │  • Docker 이미지 빌드 & 푸시        │
                                    │  • 🚨 수동 승인 게이트              │
                                    │  • DB 백업                         │
                                    │  • Blue-Green 배포                 │
                                    │  • 배포 후 검증                     │
                                    │  • Sentry 릴리즈 생성               │
                                    └────────────────────────────────────┘
```

---

## 🔧 GitHub Actions 워크플로우

### 1. CI Workflow (`ci.yml`)

**트리거**:

- Push to `main` or `develop`
- Pull Request to `main` or `develop`

**주요 작업**:

#### Backend CI

```yaml
services:
  - PostgreSQL 16
  - Redis 7

steps:
  - Checkout code
  - Setup Node.js 20
  - Install dependencies (npm ci)
  - Generate Prisma Client
  - Lint (ESLint)
  - Type Check (TypeScript)
  - Unit Tests (Jest)
  - E2E Tests (Jest + Supertest)
  - Build (NestJS)
```

#### Frontend CI

```yaml
steps:
  - Checkout code
  - Setup Node.js 20
  - Install dependencies (npm ci)
  - Lint (ESLint)
  - Type Check (TypeScript)
  - Build (Next.js)
```

#### Docker Build Test

```yaml
steps:
  - Build Backend Docker Image (test only)
  - Build Frontend Docker Image (test only)
  - Use build cache from GitHub Actions cache
```

#### Security Scan

```yaml
tool: Trivy
targets:
  - backend/ (filesystem scan)
  - client-app/ (filesystem scan)
severity: CRITICAL, HIGH
```

---

### 2. Staging Deployment (`deploy-staging.yml`)

**트리거**:

- Push to `develop` branch
- Manual workflow dispatch

**환경**: `staging`

**프로세스**:

1. **테스트 실행** (선택 가능)

   ```yaml
   uses: ./.github/workflows/ci.yml
   ```

2. **이미지 빌드 & 푸시**

   ```yaml
   registry: ghcr.io
   images:
     - ghcr.io/{owner}/dorami-backend:staging-{date}-{sha}
     - ghcr.io/{owner}/dorami-frontend:staging-{date}-{sha}
   ```

3. **SSH 배포**

   ```bash
   # Staging 서버에서 실행:
   cd /opt/dorami
   git fetch origin develop
   git reset --hard origin/develop
   docker compose -f docker-compose.staging.yml pull
   docker compose run --rm backend npx prisma migrate deploy
   docker compose up -d --remove-orphans
   docker image prune -f
   ```

4. **스모크 테스트**
   ```bash
   curl -f {STAGING_API_URL}/health
   curl -f {STAGING_URL}
   ```

---

### 3. Production Deployment (`deploy-production.yml`)

**트리거**:

- Release published (GitHub Releases)
- Manual workflow dispatch

**환경**: `production` (with approval gate)

**프로세스**:

1. **버전 검증**

   ```yaml
   version:
     - from release tag (e.g., v1.0.0)
     - or manual input
   ```

2. **CI 테스트** (선택 가능)

   ```yaml
   if: skip_tests != 'true'
   uses: ./.github/workflows/ci.yml
   ```

3. **이미지 빌드 & 푸시**

   ```yaml
   registry: ghcr.io
   images:
     - ghcr.io/{owner}/dorami-backend:{version}
     - ghcr.io/{owner}/dorami-frontend:{version}
   build-args:
     - NEXT_PUBLIC_SENTRY_DSN
     - NEXT_PUBLIC_APP_VERSION
   ```

4. **🚨 수동 승인**

   ```yaml
   environment: production-approval
   # GitHub UI에서 승인 필요
   ```

5. **사전 백업**

   ```bash
   # Production 서버에서 실행:
   docker compose exec postgres pg_dump | gzip > backup_{timestamp}.sql.gz
   # 최근 5개 백업 유지
   ```

6. **Blue-Green 배포**

   ```bash
   cd /opt/dorami
   git checkout {version}
   docker compose -f docker-compose.prod.yml pull
   docker compose run --rm backend npx prisma migrate deploy

   # Scale up (2x backend containers)
   docker compose up -d --scale backend=2
   sleep 60

   # Remove old containers
   docker compose up -d --remove-orphans
   ```

7. **배포 후 검증**

   ```bash
   # 5회 재시도로 헬스체크
   for i in {1..5}; do
     curl -sf {PRODUCTION_API_URL}/health
     curl -sf {PRODUCTION_URL}
   done
   ```

8. **Sentry 릴리즈 생성**
   ```yaml
   uses: getsentry/action-release@v1
   environment: production
   version: { version }
   ```

---

## 🔐 필수 Secrets 설정

GitHub Repository Settings → Secrets and variables → Actions에서 설정:

### Staging Secrets

| Secret 이름       | 설명                    | 예시                                 |
| ----------------- | ----------------------- | ------------------------------------ |
| `STAGING_SSH_KEY` | Staging 서버 SSH 개인키 | `-----BEGIN RSA PRIVATE KEY-----...` |
| `STAGING_HOST`    | Staging 서버 호스트     | `staging.dorami.com`                 |
| `STAGING_USER`    | Staging 서버 SSH 사용자 | `ubuntu`                             |
| `STAGING_URL`     | Staging 프론트엔드 URL  | `https://staging.dorami.com`         |
| `STAGING_API_URL` | Staging API URL         | `https://api-staging.dorami.com/api` |
| `STAGING_WS_URL`  | Staging WebSocket URL   | `wss://api-staging.dorami.com`       |
| `STAGING_CDN_URL` | Staging CDN URL         | `https://cdn-staging.dorami.com`     |

### Production Secrets

| Secret 이름          | 설명                       | 예시                                 |
| -------------------- | -------------------------- | ------------------------------------ |
| `PRODUCTION_SSH_KEY` | Production 서버 SSH 개인키 | `-----BEGIN RSA PRIVATE KEY-----...` |
| `PRODUCTION_HOST`    | Production 서버 호스트     | `prod.dorami.com`                    |
| `PRODUCTION_USER`    | Production 서버 SSH 사용자 | `ubuntu`                             |
| `PRODUCTION_URL`     | Production 프론트엔드 URL  | `https://dorami.com`                 |
| `PRODUCTION_API_URL` | Production API URL         | `https://api.dorami.com/api`         |
| `PRODUCTION_WS_URL`  | Production WebSocket URL   | `wss://api.dorami.com`               |
| `PRODUCTION_CDN_URL` | Production CDN URL         | `https://cdn.dorami.com`             |

### Sentry Secrets (Optional)

| Secret 이름         | 설명                    |
| ------------------- | ----------------------- |
| `SENTRY_AUTH_TOKEN` | Sentry API 토큰         |
| `SENTRY_ORG`        | Sentry 조직명           |
| `SENTRY_PROJECT`    | Sentry 프로젝트명       |
| `SENTRY_DSN`        | Sentry DSN (Frontend용) |

---

## 🚀 배포 프로세스

### Staging 배포

#### 자동 배포 (Develop 브랜치)

```bash
# 1. develop 브랜치에 코드 푸시
git checkout develop
git pull origin develop
git merge feature/your-feature
git push origin develop

# 2. GitHub Actions가 자동으로:
#    - CI 테스트 실행
#    - Docker 이미지 빌드
#    - Staging 서버에 배포
#    - 스모크 테스트

# 3. 결과 확인
#    - GitHub Actions 탭에서 워크플로우 상태 확인
#    - https://staging.dorami.com 접속하여 동작 확인
```

#### 수동 배포

```bash
# GitHub UI에서:
# Actions → Deploy to Staging → Run workflow
# 옵션: skip_tests (true/false)
```

---

### Production 배포

#### Release 태그를 통한 배포

```bash
# 1. 릴리즈 생성
git checkout main
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# 2. GitHub Releases에서 릴리즈 발행
#    - GitHub → Releases → Draft a new release
#    - Tag: v1.0.0
#    - Title: v1.0.0 - MVP Launch
#    - Description: 릴리즈 노트 작성
#    - Publish release

# 3. GitHub Actions가 자동으로:
#    - CI 테스트 실행
#    - Docker 이미지 빌드
#    - 수동 승인 대기 (production-approval environment)

# 4. 승인 후:
#    - DB 백업
#    - Blue-Green 배포
#    - 배포 후 검증
#    - Sentry 릴리즈 생성
```

#### 수동 배포

```bash
# GitHub UI에서:
# Actions → Deploy to Production → Run workflow
# 입력 필드:
#   - version: v1.0.0
#   - skip_tests: false
#   - rollback: false
```

#### 롤백

```bash
# GitHub UI에서:
# Actions → Deploy to Production → Run workflow
# 입력 필드:
#   - version: v0.9.0 (이전 버전)
#   - skip_tests: true
#   - rollback: true
```

---

## 📊 모니터링

### GitHub Actions 대시보드

**확인 항목**:

- ✅ 모든 CI 작업 통과
- ✅ 보안 스캔 결과 (Trivy)
- ✅ 테스트 커버리지
- ✅ 배포 상태 (Staging/Production)

**알림**:

```yaml
# .github/workflows/ci.yml
# 실패 시 GitHub 이슈 자동 생성 (선택 사항)
```

### 배포 이력

```bash
# Production 배포 이력 확인
git tag -l "v*" --sort=-v:refname | head -10

# 특정 버전의 변경사항 확인
git log v0.9.0..v1.0.0 --oneline
```

---

## 🐛 트러블슈팅

### 문제 1: CI 테스트 실패

**증상**: GitHub Actions에서 테스트 실패

**해결**:

```bash
# 로컬에서 동일한 환경으로 테스트
docker-compose -f docker-compose.test.yml up -d
cd backend && npm run test:e2e

# 로그 확인
docker-compose -f docker-compose.test.yml logs backend
```

---

### 문제 2: Docker 이미지 빌드 실패

**증상**: Docker Build 단계에서 실패

**해결**:

```bash
# 로컬에서 빌드 테스트
docker build -t dorami-backend:test ./backend
docker build -t dorami-frontend:test ./client-app

# 빌드 로그 확인
docker build --progress=plain -t dorami-backend:test ./backend 2>&1 | tee build.log
```

---

### 문제 3: SSH 배포 실패

**증상**: "Permission denied (publickey)" 오류

**해결**:

```bash
# 1. SSH 키 확인
cat ~/.ssh/id_rsa.pub

# 2. GitHub Secrets의 STAGING_SSH_KEY 확인
#    - 개인키 전체 내용 (-----BEGIN ... -----END 포함)

# 3. 서버의 authorized_keys 확인
ssh ubuntu@staging.dorami.com "cat ~/.ssh/authorized_keys"

# 4. SSH 연결 테스트
ssh -i ~/.ssh/id_rsa ubuntu@staging.dorami.com "echo Connected"
```

---

### 문제 4: Staging 배포 후 서비스 다운

**증상**: 헬스체크 실패

**해결**:

```bash
# 1. 서버 접속
ssh ubuntu@staging.dorami.com

# 2. 컨테이너 상태 확인
cd /opt/dorami
docker compose -f docker-compose.staging.yml ps

# 3. 로그 확인
docker compose -f docker-compose.staging.yml logs backend --tail 100
docker compose -f docker-compose.staging.yml logs frontend --tail 100

# 4. DB 연결 확인
docker compose exec backend npx prisma db push --preview-feature

# 5. 환경 변수 확인
docker compose exec backend env | grep DATABASE_URL
```

---

### 문제 5: Production 승인 게이트 통과 후 배포 실패

**증상**: 배포는 시작되었으나 중간에 실패

**해결**:

```bash
# 1. 워크플로우 로그 확인
#    GitHub Actions → 해당 워크플로우 → 실패한 step 로그 확인

# 2. 롤백 실행
#    Actions → Deploy to Production → Run workflow
#    - version: {이전 정상 버전}
#    - rollback: true

# 3. DB 백업에서 복구 (필요 시)
ssh ubuntu@prod.dorami.com
cd /opt/dorami/backups
ls -lt db_backup_*.sql.gz | head -1
gunzip < db_backup_20260205_143000.sql.gz | docker compose exec -T postgres psql -U postgres -d live_commerce
```

---

### 문제 6: Sentry 릴리즈 생성 실패

**증상**: "Sentry API authentication failed"

**해결**:

```bash
# 1. Sentry Secrets 확인
#    - SENTRY_AUTH_TOKEN이 유효한지 확인
#    - SENTRY_ORG, SENTRY_PROJECT가 정확한지 확인

# 2. Sentry API 토큰 재생성
#    Sentry UI → Settings → Auth Tokens → Create New Token
#    Permissions: project:write, release:write

# 3. GitHub Secrets 업데이트
#    Settings → Secrets → SENTRY_AUTH_TOKEN 업데이트

# 4. 수동으로 Sentry 릴리즈 생성
sentry-cli releases new v1.0.0 --org {org} --project {project}
sentry-cli releases set-commits v1.0.0 --auto --org {org} --project {project}
sentry-cli releases finalize v1.0.0 --org {org} --project {project}
```

---

## 📞 긴급 연락처

**DevOps 팀**: devops@dorami.com
**On-call 담당**: oncall@dorami.com

---

## 📝 참고 문서

- [DEPLOYMENT.md](./DEPLOYMENT.md) - 배포 가이드
- [MVP-LAUNCH-CHECKLIST.md](./MVP-LAUNCH-CHECKLIST.md) - MVP 론칭 체크리스트
- [AWS-INFRASTRUCTURE-GUIDE.md](./AWS-INFRASTRUCTURE-GUIDE.md) - AWS 인프라 설정 가이드

---

**작성자**: Claude (Sonnet 4.5)
**최종 업데이트**: 2026-02-05
**버전**: 1.0.0
