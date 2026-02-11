# Dorami Live Commerce - 배포 가이드

**프로젝트**: Dorami Live Commerce
**버전**: 1.0.0 (MVP)
**작성일**: 2026-02-05

---

## 📋 목차

1. [사전 요구사항](#사전-요구사항)
2. [환경별 배포](#환경별-배포)
3. [데이터베이스 마이그레이션](#데이터베이스-마이그레이션)
4. [배포 체크리스트](#배포-체크리스트)
5. [롤백 절차](#롤백-절차)
6. [트러블슈팅](#트러블슈팅)

---

## 🔧 사전 요구사항

### 필수 도구

- Node.js 18+
- npm 9+
- Docker & Docker Compose
- AWS CLI (배포 시)
- Git

### AWS 리소스 (Production)

- **RDS PostgreSQL 16** (db.t3.micro 이상)
- **ElastiCache Redis** (cache.t3.micro 이상)
- **ECS Fargate** (Backend API)
- **S3 + CloudFront** (Frontend static files)
- **Secrets Manager** (환경 변수)
- **EC2 (선택)** (RTMP 스트리밍 서버)

---

## 🚀 환경별 배포

### 1️⃣ Local Development

```bash
# 1. 환경 변수 설정
cp backend/.env.example backend/.env
cp client-app/.env.local.example client-app/.env.local

# 2. Docker 서비스 시작
docker-compose up -d

# 3. 패키지 설치
cd backend && npm install
cd ../client-app && npm install

# 4. Prisma 마이그레이션
cd ../backend
npx prisma migrate dev
npx prisma generate

# 5. 시드 데이터 (선택)
npx prisma db seed

# 6. 개발 서버 시작
npm run start:dev  # Backend (localhost:3001)
cd ../client-app && npm run dev  # Frontend (localhost:3000)
```

---

### 2️⃣ Test Environment

E2E 테스트를 위한 격리된 환경:

```bash
# 1. 테스트 DB 시작
docker-compose -f docker-compose.test.yml up -d

# 2. 테스트 환경 변수
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/live_commerce_test"
export REDIS_URL="redis://localhost:6380"

# 3. 테스트 DB 마이그레이션
cd backend
npx prisma migrate deploy

# 4. E2E 테스트 실행
npm run test:e2e
```

---

### 3️⃣ Staging Environment (AWS)

#### Backend 배포 (ECS Fargate)

**1. Docker 이미지 빌드 & 푸시**

```bash
cd backend

# ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com

# 이미지 빌드
docker build -t dorami-backend:staging .

# ECR에 태그 & 푸시
docker tag dorami-backend:staging <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/dorami-backend:staging
docker push <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/dorami-backend:staging
```

**2. 환경 변수 설정 (Secrets Manager)**

```bash
# Secrets Manager에 환경 변수 저장
aws secretsmanager create-secret \
  --name dorami/staging/backend \
  --secret-string file://backend/.env.staging \
  --region ap-northeast-2
```

**3. ECS 태스크 업데이트**

```bash
# ECS 서비스 업데이트 (새 이미지 배포)
aws ecs update-service \
  --cluster dorami-staging \
  --service dorami-backend-service \
  --force-new-deployment \
  --region ap-northeast-2
```

**4. 배포 확인**

```bash
# 헬스체크
curl https://api-staging.dorami.com/api/health

# 로그 확인
aws logs tail /ecs/dorami-backend-staging --follow
```

#### Frontend 배포 (S3 + CloudFront)

```bash
cd client-app

# 1. 환경 변수 설정
export NEXT_PUBLIC_API_URL=https://api-staging.dorami.com

# 2. 프로덕션 빌드
npm run build

# 3. S3에 업로드
aws s3 sync out/ s3://dorami-staging-frontend/ --delete

# 4. CloudFront 캐시 무효화
aws cloudfront create-invalidation \
  --distribution-id E1234EXAMPLE \
  --paths "/*"
```

---

### 4️⃣ Production Environment (AWS)

**Production 배포는 Staging 검증 후 진행**

#### 배포 전 체크리스트

- [ ] Staging 환경 테스트 완료
- [ ] DB 백업 완료
- [ ] 롤백 계획 수립
- [ ] 모니터링 대시보드 준비
- [ ] 긴급 연락망 공유

#### Backend 배포

```bash
# 1. Production 이미지 빌드
cd backend
docker build -t dorami-backend:v1.0.0 .

# 2. ECR 푸시
docker tag dorami-backend:v1.0.0 <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/dorami-backend:v1.0.0
docker push <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/dorami-backend:v1.0.0

# 3. Blue-Green 배포 (ECS)
aws ecs update-service \
  --cluster dorami-production \
  --service dorami-backend-service \
  --task-definition dorami-backend:v1.0.0 \
  --deployment-configuration "maximumPercent=200,minimumHealthyPercent=100" \
  --region ap-northeast-2
```

#### Frontend 배포

```bash
cd client-app

# 1. Production 빌드
export NEXT_PUBLIC_API_URL=https://api.dorami.com
npm run build

# 2. S3 업로드
aws s3 sync out/ s3://dorami-production-frontend/ --delete

# 3. CloudFront 캐시 무효화
aws cloudfront create-invalidation \
  --distribution-id E5678PRODUCTION \
  --paths "/*"
```

---

## 🗄️ 데이터베이스 마이그레이션

### Staging/Production 마이그레이션

```bash
# 1. DB 백업 (중요!)
pg_dump -h <RDS_ENDPOINT> -U postgres -d live_commerce > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 마이그레이션 실행
cd backend
export DATABASE_URL="postgresql://postgres:<PASSWORD>@<RDS_ENDPOINT>:5432/live_commerce"
npx prisma migrate deploy

# 3. Prisma Client 재생성
npx prisma generate

# 4. 마이그레이션 확인
npx prisma migrate status
```

### 마이그레이션 롤백

```bash
# 이전 버전으로 복구
psql -h <RDS_ENDPOINT> -U postgres -d live_commerce < backup_20260205_143000.sql
```

---

## ✅ 배포 체크리스트

### 배포 전

- [ ] 코드 빌드 성공 (Backend + Frontend)
- [ ] 단위 테스트 통과
- [ ] E2E 테스트 통과
- [ ] 환경 변수 검증
- [ ] DB 마이그레이션 스크립트 검토
- [ ] 백업 완료
- [ ] 롤백 계획 수립

### 배포 중

- [ ] Backend 컨테이너 시작
- [ ] 헬스체크 통과
- [ ] DB 마이그레이션 완료
- [ ] Frontend 빌드 & 업로드
- [ ] CloudFront 캐시 무효화

### 배포 후

- [ ] 헬스체크 API 확인
- [ ] 주요 기능 스모크 테스트
  - [ ] 로그인
  - [ ] 상품 조회
  - [ ] 장바구니 담기
  - [ ] 주문 생성
  - [ ] 관리자 대시보드
- [ ] 로그 모니터링 (5분간)
- [ ] 에러율 확인 (CloudWatch)
- [ ] 응답 시간 확인 (평균 < 500ms)

---

## 🔄 롤백 절차

### Backend 롤백

```bash
# 1. 이전 태스크 정의로 롤백
aws ecs update-service \
  --cluster dorami-production \
  --service dorami-backend-service \
  --task-definition dorami-backend:<PREVIOUS_VERSION> \
  --force-new-deployment

# 2. DB 롤백 (필요 시)
psql -h <RDS_ENDPOINT> -U postgres -d live_commerce < backup_<TIMESTAMP>.sql
```

### Frontend 롤백

```bash
# 1. S3에서 이전 버전 복구
aws s3 sync s3://dorami-production-frontend-backup/ s3://dorami-production-frontend/ --delete

# 2. CloudFront 캐시 무효화
aws cloudfront create-invalidation --distribution-id E5678PRODUCTION --paths "/*"
```

---

## 🐛 트러블슈팅

### 문제 1: Backend 컨테이너가 시작되지 않음

**증상**: ECS 태스크가 계속 재시작됨

**해결**:

```bash
# 1. 로그 확인
aws logs tail /ecs/dorami-backend-production --follow

# 2. 환경 변수 확인
aws secretsmanager get-secret-value --secret-id dorami/production/backend

# 3. DB 연결 확인
psql -h <RDS_ENDPOINT> -U postgres -d live_commerce
```

### 문제 2: Frontend가 API를 호출하지 못함

**증상**: CORS 오류 또는 404

**해결**:

```bash
# 1. API URL 확인
echo $NEXT_PUBLIC_API_URL

# 2. Backend CORS 설정 확인 (backend/src/main.ts)
# 3. CloudFront → ALB 연결 확인
```

### 문제 3: DB 마이그레이션 실패

**증상**: Prisma migrate 오류

**해결**:

```bash
# 1. 현재 마이그레이션 상태 확인
npx prisma migrate status

# 2. 수동으로 마이그레이션 SQL 실행
psql -h <RDS_ENDPOINT> -U postgres -d live_commerce < prisma/migrations/<MIGRATION_NAME>/migration.sql

# 3. 마이그레이션 테이블 수동 업데이트
```

### 문제 4: Redis 연결 실패

**증상**: Backend 로그에 Redis 연결 오류

**해결**:

```bash
# 1. ElastiCache 엔드포인트 확인
aws elasticache describe-cache-clusters --cache-cluster-id dorami-production

# 2. 보안 그룹 확인 (6379 포트 개방)
# 3. Redis 연결 테스트
redis-cli -h <ELASTICACHE_ENDPOINT> ping
```

---

## 📊 모니터링

### CloudWatch Metrics

**주요 지표**:

- ECS CPU/Memory 사용률
- RDS 연결 수
- ElastiCache Hit Rate
- ALB 응답 시간
- 5xx 에러율

### 알람 설정

```bash
# 예시: CPU 사용률 80% 초과 시 알람
aws cloudwatch put-metric-alarm \
  --alarm-name dorami-backend-high-cpu \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold
```

---

## 📞 긴급 연락처

**개발팀**: dev@dorami.com
**인프라팀**: infra@dorami.com
**온콜 담당**: oncall@dorami.com

---

**작성자**: Claude (Sonnet 4.5)
**최종 업데이트**: 2026-02-05
**버전**: 1.0.0
