# Doremi DevOps 과외 문서

> 대상: DevOps를 하나도 모르는 입문자 | 기준: 실제 이 프로젝트 코드

---

## 목차

1. [Docker란 무엇인가](#1-docker란-무엇인가)
2. [docker-compose.yml 해부](#2-docker-composeyml-해부)
3. [.env 파일 완전 이해](#3-env-파일-완전-이해)
4. [환경별 설정 (dev / staging / prod)](#4-환경별-설정)
5. [.gitignore와 보안](#5-gitignore와-보안)
6. [GitHub Actions CI/CD](#6-github-actions-cicd)
7. [GitHub Secrets & Variables](#7-github-secrets--variables)
8. [Docker 이미지 빌드와 배포 흐름](#8-docker-이미지-빌드와-배포-흐름)
9. [전체 흐름 한눈에 보기](#9-전체-흐름-한눈에-보기)
10. [자주 하는 실수와 해결법](#10-자주-하는-실수와-해결법)

---

## 1. Docker란 무엇인가

### 핵심 개념 (비유)

> Docker = "내 컴퓨터에서 됩니다"를 없애주는 기술

일반 개발 방식의 문제:

- 개발자 A 맥북에서는 잘 됨
- 개발자 B 윈도우에서 안 됨
- 서버(우분투)에서 또 다름

Docker 해결책: **컨테이너**라는 독립된 실행 환경을 만들어서, 어디서나 동일하게 실행

```
[내 컴퓨터]                  [서버]
┌─────────────────┐         ┌─────────────────┐
│ Docker Engine   │         │ Docker Engine   │
│ ┌─────────────┐ │   ==    │ ┌─────────────┐ │
│ │  Container  │ │         │ │  Container  │ │
│ │  (앱 실행)  │ │         │ │  (앱 실행)  │ │
│ └─────────────┘ │         └─────────────┘ │
└─────────────────┘         └─────────────────┘
     둘 다 완전히 동일하게 동작
```

### 핵심 용어

| 용어           | 비유          | 설명                                                |
| -------------- | ------------- | --------------------------------------------------- |
| **Image**      | 레시피        | 컨테이너를 만드는 설계도 (Dockerfile로 생성)        |
| **Container**  | 요리된 음식   | Image를 실행한 실제 인스턴스                        |
| **Dockerfile** | 요리법        | Image를 어떻게 만들지 단계별로 서술한 파일          |
| **Volume**     | 외장 하드     | 컨테이너가 꺼져도 데이터가 남는 저장소              |
| **Network**    | 사내 인트라넷 | 컨테이너들끼리 통신하는 가상 네트워크               |
| **Registry**   | 앱스토어      | Image를 저장하고 배포하는 저장소 (Docker Hub, GHCR) |

---

## 2. docker-compose.yml 해부

### 이 파일이 하는 일

여러 컨테이너를 한 번에 정의하고 실행하는 설정 파일.
`npm run docker:up` 한 줄로 DB, Redis, 스트리밍 서버 전부 실행되는 이유가 이것.

### 실제 파일 (`docker-compose.yml`) 전체 해설

```yaml
version: '3.8' # docker-compose 문법 버전

services: # 실행할 컨테이너 목록
```

---

#### PostgreSQL (데이터베이스)

```yaml
postgres:
  image:
    postgres:16-alpine # Docker Hub에서 받아오는 공식 이미지
    # 16 = 버전, alpine = 가벼운 리눅스 기반
  restart:
    unless-stopped # 컨테이너가 죽으면 자동 재시작
    # (단, 내가 직접 stop한 경우는 재시작 안 함)
  ports:
    - '5432:5432' # 호스트포트:컨테이너포트
      # 내 PC의 5432번 → 컨테이너 5432번으로 연결
  environment: # 컨테이너 안에서 쓸 환경변수
    POSTGRES_USER: postgres # DB 접속 아이디
    POSTGRES_PASSWORD: postgres # DB 접속 비밀번호 (개발용이라 단순함)
    POSTGRES_DB: live_commerce # 처음 만들 DB 이름
  volumes:
    - postgres_data:/var/lib/postgresql/data
    # postgres_data = 아래 volumes 섹션에서 정의한 볼륨 이름
    # /var/lib/postgresql/data = 컨테이너 안의 DB 데이터 경로
    # 컨테이너를 지워도 데이터는 볼륨에 살아있음
  healthcheck: # 컨테이너가 정상인지 주기적으로 확인
    test: ['CMD-SHELL', 'pg_isready -U postgres']
    interval: 10s # 10초마다 체크
    timeout: 5s # 5초 안에 응답 없으면 실패
    retries: 5 # 5번 실패하면 unhealthy 처리
  networks:
    - doremi-internal # 이 가상 네트워크에 연결
```

---

#### Redis (캐시 & 메시지 브로커)

```yaml
redis:
  image: redis:7-alpine
  restart: unless-stopped
  ports:
    - '6379:6379'
  command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
  # command = 컨테이너 실행 시 기본 명령어를 이걸로 덮어씀
  # --appendonly yes : 디스크에 데이터 저장 (재시작해도 유지)
  # --maxmemory 256mb : 최대 256MB만 사용
  # --maxmemory-policy allkeys-lru : 메모리 꽉 차면 가장 오래된 것 삭제
  volumes:
    - redis_data:/data
```

---

#### Backend (NestJS)

```yaml
backend:
  build:
    context: . # Dockerfile을 찾을 기준 디렉토리 (루트)
    dockerfile: backend/Dockerfile # 사용할 Dockerfile 경로
  # image: 를 쓰면 이미 만든 이미지를 쓰고
  # build: 를 쓰면 직접 빌드함 (로컬 개발 시 후자 사용)
  ports:
    - '3001:3001'
  environment:
    NODE_ENV: development
    DATABASE_URL: postgresql://postgres:postgres@postgres:5432/live_commerce
    #                                            ^^^^^^^^
    #                                      여기서 'postgres'는 IP가 아니라
    #                                      위에서 정의한 서비스 이름!
    #                                      Docker 내부 DNS가 자동 해석함
    REDIS_URL: redis://redis:6379 # 마찬가지로 'redis' = 서비스 이름
    JWT_SECRET: dev-secret-key-...
    KAKAO_CLIENT_ID: ${KAKAO_CLIENT_ID:-dev-kakao-client-id}
    # ${변수명:-기본값} = 환경변수가 있으면 그걸 쓰고, 없으면 기본값 사용
  depends_on:
    postgres:
      condition: service_healthy # postgres가 healthy 상태일 때만 시작
    redis:
      condition: service_healthy
  volumes:
    - ./uploads:/app/uploads # ./uploads = 내 PC 경로, /app/uploads = 컨테이너 경로
      # 파일 업로드가 컨테이너 밖에 저장됨
```

---

#### 볼륨과 네트워크 정의

```yaml
volumes:
  postgres_data:
    name: doremi_postgres_data # 실제 Docker에서 사용할 볼륨 이름
  redis_data:
    name: doremi_redis_data

networks:
  doremi-internal:
    name: doremi-internal
    driver: bridge # 가상 브리지 네트워크 (기본값)
```

> **핵심**: 볼륨에 `name`을 지정하면 docker-compose를 `down` 해도 볼륨이 삭제되지 않음.
> 프로덕션에서 DB 데이터를 지우지 않는 이유가 바로 이것.

---

### Dockerfile 해부 (backend/Dockerfile)

멀티 스테이지 빌드 = 이미지 크기를 줄이는 기법

```dockerfile
# Stage 1: 의존성 설치 전용
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# package.json만 먼저 복사 → 코드가 바뀌어도 npm install 캐시 재사용 가능
RUN npm ci --omit=dev  # 프로덕션 의존성만 설치
RUN npm ci              # 빌드용 의존성도 설치 (TypeScript 등)

# Stage 2: 소스 빌드 전용
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules  # Stage 1에서 가져옴
COPY . .
RUN npm run build  # TypeScript → JavaScript 컴파일

# Stage 3: 실제 실행 이미지 (최소화)
FROM node:20-alpine AS runner
ENV NODE_ENV=production
RUN apk add --no-cache ffmpeg openssl  # 필수 시스템 패키지만
RUN adduser --system nestjs            # root가 아닌 전용 사용자로 실행 (보안)
COPY --from=deps /app/prod_node_modules ./node_modules   # 프로덕션 의존성만
COPY --from=builder /app/backend/dist ./dist             # 빌드 결과물만
USER nestjs          # 이 이후로는 nestjs 사용자로 실행
EXPOSE 3001
CMD ["node", "dist/src/main.js"]
```

> Stage 3 최종 이미지에는 TypeScript, 테스트 도구, devDependencies가 없음 → 이미지 크기 대폭 감소, 보안 향상

---

## 3. .env 파일 완전 이해

### .env 파일이란?

프로그램이 실행될 때 읽는 **환경 변수 파일**.
코드에 직접 비밀번호를 쓰는 대신, 파일로 분리해서 관리.

```
코드 (git에 올라감):     const pw = process.env.DB_PASSWORD  ← 값 없음, 변수만 참조
.env 파일 (git 제외):    DB_PASSWORD=my_secret_password       ← 실제 값
```

### 이 프로젝트의 .env 파일 구조

```
doremi/
├── backend/
│   ├── .env            ← 실제 개발용 값 (git 제외)
│   ├── .env.local      ← 로컬 오버라이드 (git 제외)
│   ├── .env.example    ← 예시 파일 (git에 포함, 실제 값 없음)
│   ├── .env.staging.example  ← 스테이징 예시
│   └── .env.production.example ← 프로덕션 예시
├── client-app/
│   ├── .env.local      ← 프론트엔드 개발용 (git 제외)
│   └── .env.example    ← 프론트엔드 예시
├── .env.staging        ← 스테이징 실제 값 (git 제외, 서버에만 존재)
└── .env.production     ← 프로덕션 실제 값 (git 제외, 서버에만 존재)
```

### backend/.env.example 핵심 변수 해설

```bash
# ==================== 앱 기본 설정 ====================
NODE_ENV=development       # 실행 환경: development | production | test
PORT=3001                  # 백엔드 HTTP 포트
APP_ENV=development        # 앱 환경: development | staging | production | test
                           # NODE_ENV와 별도 관리 (Swagger 노출 여부 등에 사용)

# ==================== 데이터베이스 ====================
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/live_commerce"
# 구조: postgresql://[유저]:[비밀번호]@[호스트]:[포트]/[DB이름]
# Docker 안에서는 @localhost 대신 @postgres (서비스 이름)

# ==================== Redis ====================
REDIS_URL="redis://localhost:6379"
REDIS_HOST=localhost
REDIS_PORT=6379

# ==================== JWT (인증 토큰) ====================
JWT_SECRET=your-jwt-secret-change-in-production-min-32-chars
# 사용자 로그인 토큰을 서명하는 비밀키
# 프로덕션에서는 최소 64자 랜덤 문자열 필요
# 생성법: openssl rand -base64 64
JWT_ACCESS_EXPIRES_IN=15m   # 액세스 토큰 만료: 15분
JWT_REFRESH_EXPIRES_IN=7d   # 리프레시 토큰 만료: 7일

# ==================== 암호화 ====================
PROFILE_ENCRYPTION_KEY=0123456789abcdef...  # 64자 hex (32바이트 AES-256 키)
# 배송지 주소 암호화에 사용
# 생성법: openssl rand -hex 32

# ==================== 카카오 OAuth ====================
KAKAO_CLIENT_ID=your-kakao-client-id          # 카카오 앱의 REST API 키
KAKAO_CLIENT_SECRET=your-kakao-client-secret  # 카카오 앱 시크릿
KAKAO_CALLBACK_URL=http://localhost:3001/api/auth/kakao/callback

# ==================== CORS ====================
CORS_ORIGINS=http://localhost:3000,http://localhost:3002
# 어떤 출처(Origin)에서 오는 요청을 허용할지
# 프로덕션: https://doremi-live.com,https://www.doremi-live.com

# ==================== CSRF 보호 ====================
CSRF_ENABLED=true   # 개발 시 false로 비활성화 가능

# ==================== 스트리밍 ====================
RTMP_SERVER_URL=rtmp://localhost:1935/live  # OBS 방송 주소
HLS_SERVER_URL=http://localhost:8080/hls    # HLS 재생 주소

# ==================== 관리자 ====================
ADMIN_EMAILS=admin@doremi.shop  # 이 이메일로 카카오 로그인하면 자동 관리자
```

### 프론트엔드 .env 특이사항: NEXT*PUBLIC* 접두사

```bash
# NEXT_PUBLIC_ 붙은 것: 브라우저에서도 읽을 수 있음 (소스에 노출됨)
NEXT_PUBLIC_WS_URL=http://localhost:3001    # 브라우저에서 WebSocket 연결할 주소
NEXT_PUBLIC_API_URL=/api                    # API 기본 경로

# NEXT_PUBLIC_ 없는 것: 서버(Next.js)에서만 읽힘 (외부 노출 안 됨)
BACKEND_URL=http://127.0.0.1:3001          # Next.js → NestJS 프록시용
MEDIA_SERVER_URL=http://127.0.0.1:8080     # Next.js → SRS 프록시용
```

> **중요**: API 키, DB 비밀번호는 절대 `NEXT_PUBLIC_` 붙이면 안 됨. 브라우저에 그대로 노출됨.

---

## 4. 환경별 설정

### 세 가지 환경의 개념

```
개발(Development)  →  테스트(Staging)  →  운영(Production)
    내 PC              테스트 서버          실제 서비스 서버
```

| 구분         | Development    | Staging                 | Production                      |
| ------------ | -------------- | ----------------------- | ------------------------------- |
| 목적         | 개발자 코딩    | 배포 전 테스트          | 실제 사용자 서비스              |
| DB           | localhost      | 스테이징 서버 DB        | 프로덕션 DB (186명 실제 데이터) |
| 도메인       | localhost:3000 | staging.doremi-live.com | www.doremi-live.com             |
| 로그 레벨    | debug          | info                    | warn (에러/경고만)              |
| Swagger      | 노출           | 노출                    | **비노출** (APP_ENV=production) |
| CSRF         | 끄기 가능      | 켬                      | **필수 켬**                     |
| 카카오 OAuth | dev 앱 키      | staging 앱 키           | prod 앱 키                      |

### 환경별 .env 파일 대응

```
내 PC 개발 시:    backend/.env 또는 backend/.env.local 을 읽음
스테이징 배포:    .env.staging 을 읽음 (서버에만 존재, git 제외)
프로덕션 배포:    .env.production 을 읽음 (서버에만 존재, git 제외)
```

### docker-compose에서 환경변수 오버라이드 방식

```yaml
# docker-compose.yml에서:
KAKAO_CLIENT_ID: ${KAKAO_CLIENT_ID:-dev-kakao-client-id}
#                 ^^^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^^
#                 shell 환경변수       없으면 쓸 기본값
```

실행 시 `.env` 파일이 있으면 자동으로 읽어서 `${변수명}`에 대입.

---

## 5. .gitignore와 보안

### .gitignore가 하는 일

Git이 추적하지 말아야 할 파일 목록. 이 파일들은 `git add` 해도 무시됨.

```
# .gitignore에 있는 환경변수 관련 항목:
.env
.env*.local
.env.production
.env.staging
```

### 왜 .env를 git에 올리면 안 되나?

```
git push → GitHub에 올라감 → 누구나 볼 수 있음 → DB 비밀번호 유출
```

GitHub에 실수로 올린 비밀번호는 **삭제해도 git 히스토리에 남아있음**.
반드시 즉시 비밀번호를 변경해야 함.

### .example 파일의 역할

```
.env.example    ← git에 올라감. 실제 값 없음. "이런 변수들이 필요해요" 알림용
.env            ← git에 안 올라감. 실제 값 있음.
```

새 개발자 온보딩 시:

```bash
cp backend/.env.example backend/.env
# .env 열어서 실제 값 채우기
```

---

## 6. GitHub Actions CI/CD

### CI/CD란?

- **CI** (Continuous Integration): 코드를 합칠 때마다 자동으로 테스트
- **CD** (Continuous Deployment): 테스트 통과 시 자동으로 배포

```
개발자가 git push  →  GitHub Actions 자동 실행  →  테스트  →  배포
```

### 이 프로젝트의 워크플로우 파일들

```
.github/workflows/
├── ci.yml                    ← PR/push 시 테스트 (모든 브랜치)
├── deploy-staging.yml        ← develop 브랜치 push 시 스테이징 배포
├── deploy-production.yml     ← main 브랜치 push 시 프로덕션 배포
├── build-images.yml          ← Docker 이미지 빌드 (재사용 가능 워크플로우)
└── backup-database.yml       ← DB 백업 (스케줄)
```

### CI 워크플로우 (.github/workflows/ci.yml) 해설

```yaml
name: CI

on:
  pull_request:
    branches: [main, develop] # main, develop으로 PR 올릴 때 실행
  workflow_call: # 다른 워크플로우에서 이 워크플로우를 호출 가능

env:
  NODE_VERSION: '20' # 전체 워크플로우에서 쓸 공통 환경변수

jobs:
  # Job 1: 어떤 파일이 바뀌었는지 감지
  changes:
    outputs:
      backend: ${{ steps.filter.outputs.backend }} # backend 파일 바뀌었나?
      frontend: ${{ steps.filter.outputs.frontend }} # frontend 파일 바뀌었나?
    steps:
      - uses: dorny/paths-filter@v3 # 파일 변경 감지 액션
        with:
          filters: |
            backend:
              - 'backend/**'          # backend/ 아래 뭐든 바뀌면 backend=true
            frontend:
              - 'client-app/**'

  # Job 2: 백엔드 CI
  backend-ci:
    needs: changes # changes job이 끝난 후 실행
    if: needs.changes.outputs.backend == 'true' # backend 파일 바뀐 경우만 실행

    services: # 이 job 실행 중에 함께 띄울 서비스 (테스트용 DB)
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready   # 이 명령어로 health 확인

    steps:
      - uses: actions/checkout@v4 # 코드 체크아웃

      - name: Setup Node.js with Cache
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }} # 위에서 정의한 20
          cache: 'npm' # npm 캐시 활성화 (빌드 속도 향상)

      - name: Install dependencies
        run: npm ci # npm install보다 빠르고 결정적

      - name: Lint & Type Check
        run: |
          npm run lint &    # & = 백그라운드 실행
          npx tsc --noEmit &
          wait              # 둘 다 끝날 때까지 대기 (병렬 실행)

      - name: Unit Tests
        run: npm test
        env: # 이 step에서만 쓸 환경변수
          NODE_ENV: test
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          JWT_SECRET: test-jwt-secret-for-ci-testing-purposes-only
          PROFILE_ENCRYPTION_KEY: 0123456789abcdef...
```

### 스테이징 배포 워크플로우 해설 (deploy-staging.yml)

```yaml
on:
  push:
    branches: [develop] # develop 브랜치에 push될 때 자동 실행
  workflow_dispatch: # GitHub UI에서 수동 실행도 가능

concurrency:
  group: staging-deployment
  cancel-in-progress: false # 배포 중 새 배포가 트리거되어도 현재 배포 완료 후 실행

jobs:
  # 1단계: CI 테스트 먼저 실행
  test:
    uses: ./.github/workflows/ci.yml # ci.yml 재사용

  # 2단계: Docker 이미지 빌드 & GHCR에 푸시
  build:
    needs: [test]
    uses: ./.github/workflows/build-images.yml

  # 3단계: 서버에 SSH로 접속해서 배포
  deploy:
    needs: [build]
    environment:
      name: staging # GitHub 환경 (Secrets 범위를 staging으로 한정)

    steps:
      - name: Setup SSH
        # secrets.STAGING_SSH_KEY = GitHub Secrets에 저장된 SSH 개인키
        # SSH로 서버에 접속하기 위한 키 파일 생성

      - name: Deploy via SSH
        run: |
          ssh $USER@$HOST << ENDSSH
            # 이 블록 안의 명령어들이 서버에서 실행됨
            cd /opt/doremi
            git reset --hard origin/develop    # 최신 코드로 리셋

            # .env.staging 파일 재생성
            # (git reset이 .env.staging을 지우기 때문)

            docker compose pull                # 새 이미지 다운로드
            docker compose up -d               # 컨테이너 재시작
            npx prisma migrate deploy          # DB 마이그레이션 실행
          ENDSSH
```

---

## 7. GitHub Secrets & Variables

### Secrets vs Variables 차이

| 구분        | Secrets                           | Variables          |
| ----------- | --------------------------------- | ------------------ |
| 용도        | 비밀값 (API 키, 비밀번호, SSH 키) | 비밀 아닌 설정값   |
| 로그 마스킹 | 자동으로 `***` 처리               | 그대로 노출        |
| 접근 방법   | `${{ secrets.NAME }}`             | `${{ vars.NAME }}` |

### 이 프로젝트에서 쓰는 Secrets 목록

```
Repository Secrets (모든 환경에서 사용):
├── GITHUB_TOKEN          ← GitHub이 자동 제공 (GHCR 로그인용)

Staging Environment Secrets:
├── STAGING_SSH_KEY       ← 스테이징 서버 SSH 개인키 (PEM 형식)
├── STAGING_HOST          ← 스테이징 서버 IP 또는 도메인
├── STAGING_USER          ← 스테이징 서버 SSH 접속 유저명
├── STAGING_KAKAO_CLIENT_ID      ← 카카오 앱 REST API 키
├── STAGING_KAKAO_CLIENT_SECRET  ← 카카오 앱 시크릿
├── STAGING_KAKAO_CALLBACK_URL   ← 카카오 콜백 URL
└── STAGING_ADMIN_EMAILS         ← 관리자 이메일 목록

Staging Environment Variables:
└── STAGING_URL           ← 스테이징 서비스 URL (비밀 아님)
```

### Secrets 사용 예시

```yaml
- name: Deploy via SSH
  env:
    SSH_KEY: ${{ secrets.STAGING_SSH_KEY }} # Secret 참조
    HOST: ${{ secrets.STAGING_HOST }}
  run: |
    echo "$SSH_KEY" > ~/.ssh/id_rsa   # 파일로 저장
    chmod 600 ~/.ssh/id_rsa           # 권한 설정
    ssh -i ~/.ssh/id_rsa $HOST "ls"   # SSH 접속
```

### GitHub Environments 개념

```
GitHub Repository
└── Settings > Environments
    ├── staging             ← 스테이징 환경 정의
    │   ├── Secrets (staging 전용 비밀)
    │   └── Variables (staging 전용 설정)
    └── production          ← 프로덕션 환경 정의
        ├── Secrets (prod 전용 비밀)
        └── Required reviewers: [관리자]  ← 배포 전 승인 필요 설정 가능
```

---

## 8. Docker 이미지 빌드와 배포 흐름

### 이미지 태그 전략

```yaml
# build-images.yml
- id: version
  run: echo "tag=sha-${GITHUB_SHA}" >> $GITHUB_OUTPUT
# GITHUB_SHA = 현재 커밋의 40자리 해시
# 예: sha-a1b2c3d4e5f6...

tags: ghcr.io/mim1012/doremi-backend:sha-${GITHUB_SHA}
```

**왜 SHA 태그를 쓰나?**
`latest` 같은 태그는 언제 바뀔지 모름. SHA는 특정 커밋과 1:1 대응되므로:

- 어떤 코드가 배포됐는지 추적 가능
- 롤백 시 정확한 버전으로 되돌아가기 쉬움

### GHCR (GitHub Container Registry)

Docker Hub의 GitHub 버전. 이 프로젝트 이미지 저장 위치:

```
ghcr.io/mim1012/doremi-backend:sha-xxxxx
ghcr.io/mim1012/doremi-frontend:sha-xxxxx
```

### 전체 배포 파이프라인

```
git push origin develop
        ↓
[GitHub Actions 시작]
        ↓
┌─────────────────────────────────────────┐
│  Job: test (ci.yml 재사용)              │
│  - Lint 검사                            │
│  - 타입 체크                            │
│  - 유닛 테스트 (PostgreSQL + Redis 서비스 포함) │
└─────────────────────────────────────────┘
        ↓ (테스트 통과 시에만)
┌─────────────────────────────────────────┐
│  Job: build (build-images.yml)          │
│  - backend Dockerfile 빌드              │
│  - frontend Dockerfile 빌드             │
│  - ghcr.io에 이미지 푸시               │
│    태그: sha-{GITHUB_SHA}              │
└─────────────────────────────────────────┘
        ↓ (빌드 성공 시에만)
┌─────────────────────────────────────────┐
│  Job: deploy (SSH로 서버 접속)          │
│  1. git reset --hard (최신 코드)        │
│  2. .env.staging 재생성                 │
│  3. docker compose pull (새 이미지)     │
│  4. docker compose up -d               │
│  5. prisma migrate deploy              │
│  6. 헬스체크 (/api/health/live)        │
└─────────────────────────────────────────┘
        ↓
  스테이징 서버 업데이트 완료
```

### 이미지 캐시 최적화

```yaml
cache-from: |
  type=gha,scope=backend          # GitHub Actions 캐시 사용
  type=registry,ref=ghcr.io/.../buildcache  # 레지스트리 캐시 사용
cache-to: |
  type=gha,scope=backend,mode=max
  type=registry,ref=ghcr.io/.../buildcache,mode=max
```

Dockerfile 레이어 중 변경 없는 레이어는 캐시에서 재사용 → 빌드 시간 대폭 단축.

---

## 9. 전체 흐름 한눈에 보기

### 로컬 개발 흐름

```
개발자 PC
├── 코드 작성
├── npm run docker:up        # PostgreSQL + Redis + SRS 컨테이너 시작
├── npm run dev:all          # NestJS + Next.js 개발 서버 시작
├── backend/.env             # 로컬 환경변수 (git 제외)
└── http://localhost:3000    # 브라우저에서 확인
```

### 스테이징 배포 흐름

```
git push origin develop
        ↓
GitHub Actions
        ↓ 테스트 → 빌드 → SSH 배포
스테이징 서버 (AWS EC2 등)
├── /opt/doremi/              # 소스코드
├── .env.staging              # 환경변수 (서버에만 존재, git 제외)
├── docker-compose.base.yml   # 기본 compose
├── docker-compose.staging.yml # 스테이징 전용 compose
└── ghcr.io 이미지 → 컨테이너 실행
```

### 환경변수가 애플리케이션에 도달하는 경로

```
GitHub Secrets
    ↓ ${{ secrets.KAKAO_CLIENT_ID }}
GitHub Actions 워크플로우 env:
    ↓ KAKAO_CLIENT_ID: ${{ secrets.STAGING_KAKAO_CLIENT_ID }}
SSH 명령어로 서버 전달
    ↓ export KAKAO_CLIENT_ID="${KAKAO_CLIENT_ID}"
.env.staging 파일 생성
    ↓ KAKAO_CLIENT_ID=실제값
docker-compose.staging.yml 읽기
    ↓ environment: KAKAO_CLIENT_ID: ${KAKAO_CLIENT_ID}
컨테이너 내 process.env.KAKAO_CLIENT_ID
    ↓
NestJS 코드에서 사용
```

---

## 10. 자주 하는 실수와 해결법

### 실수 1: .env 파일을 git에 올림

```bash
# 올리기 전에 확인
git status | grep .env

# 이미 올렸다면 캐시에서 제거
git rm --cached .env
git commit -m "remove .env from tracking"
# + 즉시 비밀번호 변경
```

### 실수 2: 포트 충돌

```bash
# 에러: Error: listen EADDRINUSE: address already in use :::3001
# 어떤 프로세스가 쓰는지 확인
lsof -i :3001

# 죽이기
kill -9 [PID]
```

### 실수 3: DB 데이터 다 날림

```bash
# 절대 금지 (프로덕션에서):
docker-compose down -v    # -v 옵션이 볼륨까지 삭제
npx prisma migrate reset  # DB 초기화

# 안전한 재시작:
docker-compose down         # 볼륨 유지
docker-compose up -d        # 재시작
```

### 실수 4: 환경변수 반영 안 됨

```bash
# .env 수정 후 반영 안 된다면:
# 개발 서버 재시작 (NestJS는 .env 변경 감지 못함)
npm run dev:backend

# Docker라면 컨테이너 재시작
docker-compose restart backend
```

### 실수 5: CI에서 "Missing required GitHub Actions secrets" 에러

GitHub Repository → Settings → Environments → staging → Secrets에
`STAGING_KAKAO_CLIENT_ID` 등 필요한 Secrets 추가.

### 실수 6: 배포 후 .env.staging이 날아감 (이 프로젝트의 실제 이슈)

```
원인: deploy-staging.yml에서 git reset --hard가
      git에 추적되지 않는 .env.staging을 삭제함

해결: git reset 직후 .env.staging을 GitHub Secrets 값으로 재생성
     (deploy-staging.yml L244-282에 이미 구현됨)
```

---

## 부록: 자주 쓰는 명령어 치트시트

```bash
# Docker
docker ps                          # 실행 중인 컨테이너 목록
docker ps -a                       # 전체 컨테이너 목록 (멈춘 것 포함)
docker logs [컨테이너이름] -f      # 로그 실시간 보기
docker exec -it [컨테이너이름] sh  # 컨테이너 안으로 들어가기
docker images                      # 로컬 이미지 목록
docker system prune -af            # 안 쓰는 이미지/컨테이너 전부 삭제

# Docker Compose
docker compose up -d               # 백그라운드로 시작
docker compose down                # 중지 (볼륨 유지)
docker compose down -v             # 중지 + 볼륨 삭제 (데이터 전부 날아감!)
docker compose logs -f backend     # 특정 서비스 로그
docker compose restart backend     # 특정 서비스만 재시작
docker compose exec backend sh     # 서비스 컨테이너 안으로 들어가기

# .env 관련
cp backend/.env.example backend/.env   # 처음 세팅 시
printenv | grep DATABASE               # 환경변수 확인

# GitHub Actions 로컬 테스트 (act 설치 필요)
act pull_request                   # PR 트리거 로컬 시뮬레이션
```

---

_이 문서는 `D:\Project\doremi` 코드베이스를 기반으로 작성되었습니다._
_파일 참조: `docker-compose.yml`, `backend/.env.example`, `.env.production.example`, `.github/workflows/ci.yml`, `.github/workflows/deploy-staging.yml`, `backend/Dockerfile`_
