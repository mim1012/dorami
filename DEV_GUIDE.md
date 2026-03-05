# 🚀 로컬 개발 환경 설정 가이드

## 📋 빠른 시작

### 1️⃣ 호스트에서 직접 실행 (추천 - HMR 지원)

```bash
cd D:\Project\dorami

# 한 번만 실행 (Docker 백그라운드)
npm run docker:up

# 개발 시작 (Node.js 직접 실행)
npm run dev:host
```

✅ **장점:**

- Next.js HMR (Hot Module Reload) 즉시 반영
- 빌드 없이 수정 후 바로 테스트
- 브라우저 새로고침만으로 코드 반영
- 디버깅 용이

📍 **접속:**

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Live Preview: http://localhost:3000/live/preview
- Swagger: http://localhost:3001/api/docs

---

### 2️⃣ Docker로 실행 (프로덕션 유사 환경)

```bash
# docker-compose.override.yml이 자동으로 applied됨
npm run dev:docker
```

✅ **언제 사용:**

- 도커 환경 테스트 필요
- 데이터베이스/Redis 격리 필요
- 프로덕션 빌드 이미지 테스트

⚠️ **주의:**

- 코드 변경 후 이미지 재빌드 필요: `npm run docker:rebuild`
- 브라우저 캐시 비우기 필수

---

## 🏗️ 환경별 설정

### 로컬 개발 (`docker-compose.override.yml`)

```yaml
# 자동 적용됨 (별도 명령 불필요)
- NODE_ENV: development
- NEXT_PUBLIC_PREVIEW_ENABLED: true # /live/preview 접근 가능
- Frontend 볼륨 마운트 (HMR 지원)
```

### Staging 배포

```bash
# Staging 구성으로 컨테이너 재시작
npm run docker:staging
```

### Production 확인

```bash
# Production 이미지로 빌드 (실행 안 함)
docker-compose build --no-cache frontend
```

---

## 🔄 일반적인 작업 흐름

### 1. 로컬 개발

```bash
# 터미널 1: Docker 기반 DB/Redis 시작
npm run docker:up

# 터미널 2: 호스트에서 개발 서버 시작
npm run dev:host

# 코드 수정 → 브라우저 새로고침 → 즉시 반영
```

### 2. 코드 검토 및 테스트

```bash
# Linting
npm run lint:all

# Type checking
npm run type-check:all

# 테스트
npm run test:backend
npm run test:e2e
```

### 3. 커밋 전 확인

```bash
# 빌드 가능한지 확인
npm run build:all

# 형식 정렬
npm run format
```

### 4. Docker로 최종 확인

```bash
# 프로덕션 환경과 동일하게 재빌드
npm run docker:rebuild

# 브라우저에서 확인
# http://localhost:3000
```

---

## 🛠️ 문제 해결

### Q: 코드 수정이 반영 안 됨

**A: 호스트/Docker 실행 모드 확인**

```bash
# 호스트 모드 사용 중?
npm run dev:host  ✅ (즉시 반영)

# Docker 모드 사용 중?
npm run docker:rebuild  # 이미지 재빌드 후 테스트
```

### Q: `/live/preview` 404

**A: `NEXT_PUBLIC_PREVIEW_ENABLED=true` 확인**

```bash
# 로컬 환경: docker-compose.override.yml에서 자동 설정
# Docker 환경에서 볼거면: docker-compose.yml에 추가
NEXT_PUBLIC_PREVIEW_ENABLED: 'true'
```

### Q: 포트 충돌

```bash
# 기본 포트:
# 3000  - Frontend
# 3001  - Backend
# 5432  - PostgreSQL
# 6379  - Redis
# 8080  - SRS Media

# 변경 필요 시:
docker-compose down  # 기존 정리
# docker-compose.yml에서 포트 변경
docker-compose up -d
```

### Q: 데이터베이스 초기화

```bash
# 모든 데이터 삭제 후 마이그레이션
docker-compose down -v
docker-compose up -d
npm run prisma:migrate
```

---

## 📊 명령어 요약

| 용도              | 명령어                   | 상황                           |
| ----------------- | ------------------------ | ------------------------------ |
| **로컬 개발**     | `npm run dev:host`       | 코드 수정 시 즉시 반영 필요    |
| **Docker 테스트** | `npm run dev:docker`     | 도커 환경 테스트               |
| **Docker 재빌드** | `npm run docker:rebuild` | 코드 변경 후 Docker에서 테스트 |
| **DB 시작**       | `npm run docker:up`      | 백그라운드 DB/Redis 필요       |
| **DB 중지**       | `npm run docker:down`    | 정리 및 포트 해제              |
| **로그 확인**     | `npm run docker:logs`    | 컨테이너 오류 디버깅           |
| **Staging 실행**  | `npm run docker:staging` | Staging 환경 테스트            |

---

## ✨ 모범 사례

1. **개발 중:** `npm run dev:host` 사용 (빠름)
2. **커밋 전:** 한 번 `npm run docker:rebuild`로 검증
3. **배포 전:** `npm run docker:staging`으로 최종 확인
4. **문제 발생 시:** Docker 로그 확인 → `npm run docker:logs`

---

## 🔗 관련 문서

- `CLAUDE.md` - 전체 프로젝트 가이드
- `.github/workflows/ci.yml` - CI/CD 설정
- `docker-compose.yml` - Production 구성
- `docker-compose.override.yml` - 로컬 개발 override

---

**마지막 업데이트:** 2026-03-05
