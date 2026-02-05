# 환경 설정 가이드 (Environment Setup Guide)

이 문서는 Dorami Live Commerce 프로젝트의 환경별 설정 및 배포 방법을 설명합니다.

## 📋 목차

- [Quick Start](#quick-start)
- [환경별 설정](#환경별-설정)
- [데이터베이스 설정](#데이터베이스-설정)
- [테스트 실행](#테스트-실행)
- [배포 가이드](#배포-가이드)
- [트러블슈팅](#트러블슈팅)

---

## Quick Start

### 1. 로컬 개발 환경 설정

```bash
# 1. 환경 변수 파일 생성
cp backend/.env.example backend/.env
cp client-app/.env.example client-app/.env.local

# 2. Docker 컨테이너 시작 (PostgreSQL + Redis)
docker-compose up -d

# 3. 데이터베이스 마이그레이션
cd backend
npm run prisma:migrate:dev

# 4. Seed 데이터 삽입 (선택사항)
npm run prisma:seed

# 5. 백엔드 서버 시작
npm run dev

# 6. 프론트엔드 서버 시작 (새 터미널)
cd ../client-app
npm run dev
```

**접속 URL**:

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Adminer (DB UI): http://localhost:8081
- Redis Commander: http://localhost:8082

---

## 환경별 설정

### 환경 목록

| 환경           | Branch              | 데이터베이스       | 배포 방식    | URL                      |
| -------------- | ------------------- | ------------------ | ------------ | ------------------------ |
| **Local**      | feature/\*, develop | 로컬 Docker        | 수동         | localhost:3000           |
| **Test**       | -                   | 테스트 전용 DB     | CI/CD        | -                        |
| **Staging**    | develop             | AWS RDS            | 자동 (CI/CD) | staging.livecommerce.com |
| **Production** | main                | AWS RDS (Multi-AZ) | 승인 후 배포 | livecommerce.com         |

---

### Local Development (로컬 개발)

**환경 변수**: `backend/.env`, `client-app/.env.local`

**Docker Compose 사용**:

```bash
# 모든 서비스 시작 (PostgreSQL + Redis + RTMP)
docker-compose up -d

# 특정 서비스만 시작
docker-compose up -d postgres redis

# 로그 확인
docker-compose logs -f postgres

# 서비스 중지
docker-compose down

# 데이터 볼륨까지 삭제 (주의!)
docker-compose down -v
```

**데이터베이스 관리**:

```bash
# Prisma Studio 실행 (GUI)
npm run prisma:studio

# 마이그레이션 생성
npm run prisma:migrate:dev

# 데이터베이스 리셋 (모든 데이터 삭제 후 재생성)
npm run prisma:migrate:reset
```

---

### Test Environment (테스트)

**환경 변수**: `backend/.env.test`

**테스트 전용 Docker Compose**:

```bash
# 테스트 DB 시작 (별도 포트 5433)
docker-compose -f docker-compose.test.yml up -d

# 테스트 실행
cd backend
npm run test              # Unit tests
npm run test:e2e          # E2E tests
npm run test:cov          # Coverage report

# 테스트 DB 정리
docker-compose -f docker-compose.test.yml down -v
```

**CI/CD에서 자동 실행**:

- Pull Request 생성 시 자동으로 모든 테스트 실행
- GitHub Actions가 PostgreSQL/Redis 서비스 자동 설정

---

### Staging Environment (스테이징)

**환경 변수**: AWS Secrets Manager (`live-commerce/staging/env`)

**수동 배포** (권장하지 않음):

```bash
# AWS CLI 설정 확인
aws sts get-caller-identity

# Secrets Manager에서 환경 변수 다운로드
aws secretsmanager get-secret-value \
  --secret-id live-commerce/staging/env \
  --query SecretString \
  --output text > backend/.env.staging

# Docker 이미지 빌드
docker build -t live-commerce-backend:staging \
  --build-arg NODE_ENV=staging \
  ./backend

# ECR에 푸시
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin <ECR_REGISTRY>
docker tag live-commerce-backend:staging <ECR_REGISTRY>/live-commerce-backend:staging
docker push <ECR_REGISTRY>/live-commerce-backend:staging

# ECS 서비스 업데이트
aws ecs update-service \
  --cluster live-commerce-staging \
  --service backend \
  --force-new-deployment
```

**자동 배포** (권장):

- `develop` 브랜치에 push하면 자동으로 Staging 배포
- GitHub Actions Workflow: `.github/workflows/deploy-staging.yml`

**Staging 접속**:

- Frontend: https://staging.livecommerce.com
- Backend API: https://staging-api.livecommerce.com
- Admin: https://staging-admin.livecommerce.com

**Staging 모니터링**:

```bash
# CloudWatch Logs 확인
aws logs tail /ecs/live-commerce-backend-staging --follow

# ECS 서비스 상태 확인
aws ecs describe-services \
  --cluster live-commerce-staging \
  --services backend

# RDS 연결 상태 확인
aws rds describe-db-instances \
  --db-instance-identifier live-commerce-staging-db
```

---

### Production Environment (프로덕션)

**환경 변수**: AWS Secrets Manager (`live-commerce/production/env`)

⚠️ **중요 보안 규칙**:

- ✅ Production 시크릿은 절대 로컬에 저장하지 않음
- ✅ 모든 배포는 CI/CD를 통해서만 실행
- ✅ 긴급 상황 외 직접 DB 접속 금지
- ✅ 시크릿 로테이션 자동화 (90일마다)

**자동 배포** (유일한 방법):

1. `develop` → `main` PR 생성
2. Code Review 및 승인
3. `main` 브랜치에 merge
4. GitHub Actions가 자동으로 배포 시작
5. Canary Deployment (10% 트래픽)
6. 5분간 모니터링 후 Full Rollout (100%)

**Production 모니터링**:

```bash
# CloudWatch Logs
aws logs tail /ecs/live-commerce-backend-prod --follow

# Alarms 확인
aws cloudwatch describe-alarms \
  --alarm-name-prefix live-commerce-prod

# RDS Performance Insights
aws rds describe-db-instances \
  --db-instance-identifier live-commerce-prod-db \
  --query 'DBInstances[0].PerformanceInsightsEnabled'
```

**긴급 Rollback**:

```bash
# 이전 버전으로 즉시 롤백
aws ecs update-service \
  --cluster live-commerce-prod \
  --service backend \
  --task-definition backend:previous \
  --force-new-deployment

# 롤백 완료 확인
aws ecs wait services-stable \
  --cluster live-commerce-prod \
  --services backend
```

---

## 데이터베이스 설정

### Prisma 마이그레이션

**로컬 개발**:

```bash
# 마이그레이션 생성 (스키마 변경 후)
npx prisma migrate dev --name add_user_status_field

# 마이그레이션 적용
npx prisma migrate deploy

# 스키마 리셋 (개발 중 필요시)
npx prisma migrate reset
```

**Staging/Production**:

```bash
# 배포 전 마이그레이션 확인
npx prisma migrate status

# Dry-run (실제 적용 없이 확인)
npx prisma migrate deploy --preview-feature

# 프로덕션 마이그레이션 (CI/CD에서 자동)
DATABASE_URL=$PROD_DATABASE_URL npx prisma migrate deploy
```

### 데이터베이스 백업

**로컬**:

```bash
# 백업 생성
docker exec live-commerce-postgres pg_dump -U postgres live_commerce > backup_$(date +%Y%m%d_%H%M%S).sql

# 백업 복원
docker exec -i live-commerce-postgres psql -U postgres live_commerce < backup_20260204_120000.sql
```

**Production** (AWS RDS):

- 자동 백업: 매일 03:00 UTC
- 보관 기간: 30일
- Point-in-Time Recovery: 지원

```bash
# 수동 스냅샷 생성
aws rds create-db-snapshot \
  --db-instance-identifier live-commerce-prod-db \
  --db-snapshot-identifier manual-backup-$(date +%Y%m%d)

# 스냅샷 복원 (새 DB 인스턴스 생성)
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier live-commerce-prod-db-restored \
  --db-snapshot-identifier manual-backup-20260204
```

---

## 테스트 실행

### Unit Tests (단위 테스트)

```bash
cd backend

# 모든 Unit Tests 실행
npm run test

# Watch 모드 (파일 변경 감지)
npm run test:watch

# 특정 파일만 테스트
npm run test orders.service.spec.ts

# Coverage 리포트 생성
npm run test:cov

# Coverage HTML 보기
open coverage/lcov-report/index.html
```

### E2E Tests (통합 테스트)

```bash
cd backend

# 테스트 DB 시작
docker-compose -f ../docker-compose.test.yml up -d

# 모든 E2E Tests 실행
npm run test:e2e

# 특정 E2E Test 실행
npm run test:e2e -- orders.e2e-spec.ts

# 테스트 DB 정리
docker-compose -f ../docker-compose.test.yml down -v
```

### Frontend Tests (프론트엔드 테스트)

```bash
cd client-app

# Playwright E2E Tests
npm run test:e2e

# Playwright UI 모드
npm run test:e2e:ui

# 특정 브라우저만 테스트
npm run test:e2e -- --project=chromium
```

---

## 배포 가이드

### Branch Strategy (Git Flow)

```
main (production)
 │
 ├─── develop (staging)
 │     │
 │     ├─── feature/user-authentication
 │     ├─── feature/payment-integration
 │     └─── bugfix/cart-calculation
 │
 └─── hotfix/critical-security-patch
```

### 배포 프로세스

#### 1. Feature 개발 → Staging 배포

```bash
# 1. Feature 브랜치 생성
git checkout develop
git pull origin develop
git checkout -b feature/new-feature

# 2. 개발 및 커밋
git add .
git commit -m "feat: Add new feature"

# 3. PR 생성
git push origin feature/new-feature
# GitHub에서 develop으로 PR 생성

# 4. Code Review 및 Merge
# PR 승인 후 merge하면 자동으로 Staging 배포
```

#### 2. Staging → Production 배포

```bash
# 1. develop에서 main으로 PR 생성
git checkout main
git pull origin main

# GitHub에서 develop → main PR 생성

# 2. Production 배포 체크리스트 확인
# - [ ] 모든 테스트 통과
# - [ ] Staging에서 충분히 검증
# - [ ] DB 마이그레이션 확인
# - [ ] 롤백 계획 수립
# - [ ] 모니터링 대시보드 준비

# 3. PR 승인 및 Merge
# 자동으로 Production 배포 시작 (Canary → Full Rollout)

# 4. 배포 모니터링
# - CloudWatch Alarms 확인
# - Error Rate 모니터링
# - Response Time 확인
# - 사용자 피드백 모니터링
```

### Hotfix (긴급 패치)

```bash
# 1. main에서 hotfix 브랜치 생성
git checkout main
git pull origin main
git checkout -b hotfix/critical-security-patch

# 2. 긴급 수정 및 테스트
git add .
git commit -m "fix: Critical security patch"
git push origin hotfix/critical-security-patch

# 3. main과 develop 양쪽에 PR 생성 및 Merge
# GitHub에서 승인 후 바로 배포

# 4. 배포 후 모니터링 및 검증
```

---

## 트러블슈팅

### 데이터베이스 연결 실패

```bash
# PostgreSQL 컨테이너 상태 확인
docker ps | grep postgres

# PostgreSQL 로그 확인
docker logs live-commerce-postgres

# PostgreSQL 재시작
docker restart live-commerce-postgres

# 연결 테스트
psql -h localhost -p 5432 -U postgres -d live_commerce
```

### Redis 연결 실패

```bash
# Redis 컨테이너 상태 확인
docker ps | grep redis

# Redis 연결 테스트
redis-cli ping
# 응답: PONG

# Redis 재시작
docker restart live-commerce-redis
```

### Prisma 마이그레이션 오류

```bash
# 마이그레이션 상태 확인
npx prisma migrate status

# 마이그레이션 히스토리 확인
npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma/schema.prisma

# 마이그레이션 롤백 (개발 환경만)
npx prisma migrate reset

# 프로덕션 마이그레이션 수동 수정
# 1. 마이그레이션 SQL 파일 직접 수정
# 2. 수동으로 DB에 적용
# 3. 마이그레이션 테이블 업데이트
```

### 테스트 실패 디버깅

```bash
# Verbose 모드로 테스트 실행
npm run test -- --verbose

# 특정 테스트만 실행
npm run test -- -t "should create order"

# 디버그 모드로 실행
node --inspect-brk node_modules/.bin/jest --runInBand
# Chrome DevTools에서 chrome://inspect 접속
```

### Production 장애 대응

#### 1. 즉시 확인 사항

```bash
# ECS 서비스 상태
aws ecs describe-services --cluster live-commerce-prod --services backend

# CloudWatch Alarms
aws cloudwatch describe-alarms --state-value ALARM

# 최근 에러 로그
aws logs filter-log-events \
  --log-group-name /ecs/live-commerce-backend-prod \
  --filter-pattern ERROR \
  --start-time $(date -u -d '5 minutes ago' +%s)000
```

#### 2. 긴급 조치

```bash
# 옵션 1: 이전 버전으로 롤백
aws ecs update-service \
  --cluster live-commerce-prod \
  --service backend \
  --task-definition backend:previous

# 옵션 2: 스케일 업 (부하 문제 시)
aws ecs update-service \
  --cluster live-commerce-prod \
  --service backend \
  --desired-count 10

# 옵션 3: 서비스 재시작
aws ecs update-service \
  --cluster live-commerce-prod \
  --service backend \
  --force-new-deployment
```

#### 3. 사후 분석

- 장애 발생 시간 및 지속 시간 기록
- 영향 받은 사용자 수 파악
- CloudWatch Insights 쿼리로 원인 분석
- 포스트모템(Post-mortem) 작성
- 재발 방지 대책 수립

---

## 환경 변수 참조

### 필수 환경 변수

모든 환경에서 반드시 설정해야 하는 변수:

```bash
NODE_ENV=development|test|staging|production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=... (64+ bytes)
PROFILE_ENCRYPTION_KEY=... (32 bytes)
FRONTEND_URL=https://...
```

### 선택적 환경 변수

환경에 따라 선택적으로 설정하는 변수:

```bash
# 모니터링
SENTRY_DSN=...
ENABLE_PERFORMANCE_LOGGING=true|false

# AWS (Staging/Production)
AWS_REGION=ap-northeast-2
S3_BUCKET_NAME=...

# 외부 서비스
KAKAO_CLIENT_ID=...
KAKAOTALK_API_KEY=...
```

---

## 참고 자료

- [Prisma Docs](https://www.prisma.io/docs)
- [NestJS Docs](https://docs.nestjs.com)
- [Next.js Docs](https://nextjs.org/docs)
- [Docker Compose Docs](https://docs.docker.com/compose)
- [AWS ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide)
- [환경 분리 전략 문서](_bmad-output/implementation-artifacts/environment-separation-strategy.md)

---

**작성일**: 2026-02-04
**최종 수정일**: 2026-02-04
**작성자**: Claude (BMad Master Agent)
