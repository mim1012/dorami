# Live Commerce Platform

실시간 라이브 커머스 플랫폼 - 모노레포 프로젝트

## 프로젝트 개요

실시간 스트리밍, 채팅, 상품 판매가 통합된 라이브 커머스 플랫폼입니다. 시청자는 라이브 방송을 시청하면서 실시간으로 상품을 구매하고, 판매자와 소통할 수 있습니다.

## 기술 스택

### Frontend (Client App)
- **Framework**: Next.js 16.1+ with Turbopack
- **React**: 19.0.0
- **Language**: TypeScript 5.7+ (strict mode)
- **Styling**: Tailwind CSS 4.0
- **State Management**: Zustand 5.0
- **Server State**: TanStack Query v5
- **Real-time**: Socket.IO Client 4.8

### Frontend (Admin App)
- **Framework**: Next.js 16.1+ with Turbopack
- **React**: 19.0.0
- **Admin Tools**: React Datepicker, ExcelJS

### Backend API
- **Framework**: NestJS 11.1.12+
- **Language**: TypeScript 5.7+ (strict mode)
- **Database ORM**: Prisma 6.19.0+
- **Authentication**: Passport JWT, Kakao OAuth
- **Real-time**: Socket.IO 4.8, Redis Adapter
- **Logging**: Winston, nest-winston

### Infrastructure
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Container**: Docker & Docker Compose

## 프로젝트 구조

```
live-commerce-platform/
├── packages/
│   └── shared-types/         # 공유 타입 정의
├── client-app/               # 사용자 클라이언트 앱 (port 3000)
├── admin-app/                # 관리자 대시보드 (port 3002)
├── backend/                  # NestJS API 서버 (port 3001)
├── docs/                     # 프로젝트 문서
├── docker-compose.yml        # Docker 서비스 구성
└── package.json              # 모노레포 워크스페이스 설정
```

## 시작하기

### 필수 요구사항

- Node.js 20+
- npm 10+
- Docker & Docker Compose

### 설치 및 실행

```bash
# 1. 저장소 클론
git clone <repository-url>
cd dorami

# 2. 의존성 설치 (모든 워크스페이스)
npm install

# 3. 환경 변수 설정
cp client-app/.env.example client-app/.env.local
cp admin-app/.env.example admin-app/.env.local
cp backend/.env.example backend/.env

# 4. Docker 서비스 시작 (PostgreSQL, Redis)
npm run docker:up

# 5. Prisma 마이그레이션 및 생성
npm run prisma:generate
npm run prisma:migrate

# 6. 모든 앱 개발 서버 실행
npm run dev:all
```

### 개별 앱 실행

```bash
# 클라이언트 앱만 실행 (http://localhost:3000)
npm run dev:client

# 관리자 앱만 실행 (http://localhost:3002)
npm run dev:admin

# 백엔드 API만 실행 (http://localhost:3001)
npm run dev:backend
```

## NPM Scripts

### 개발
- `npm run dev:all` - 모든 앱 동시 실행 (concurrently)
- `npm run dev:client` - 클라이언트 앱 실행
- `npm run dev:admin` - 관리자 앱 실행
- `npm run dev:backend` - 백엔드 API 실행

### 빌드
- `npm run build:all` - 모든 워크스페이스 빌드
- `npm run build:client` - 클라이언트 앱 빌드
- `npm run build:admin` - 관리자 앱 빌드
- `npm run build:backend` - 백엔드 API 빌드
- `npm run build:shared` - 공유 타입 빌드

### 타입 체크
- `npm run type-check:all` - 모든 워크스페이스 타입 체크
- `npm run type-check:client` - 클라이언트 타입 체크
- `npm run type-check:admin` - 관리자 타입 체크
- `npm run type-check:backend` - 백엔드 타입 체크
- `npm run type-check:shared` - 공유 타입 체크

### 테스트
- `npm run test:all` - 모든 테스트 실행
- `npm run test:backend` - 백엔드 유닛 테스트
- `npm run test:e2e` - E2E 테스트

### Lint
- `npm run lint:all` - 모든 워크스페이스 린트
- `npm run lint:client` - 클라이언트 린트
- `npm run lint:admin` - 관리자 린트
- `npm run lint:backend` - 백엔드 린트

### Docker
- `npm run docker:up` - Docker 서비스 시작 (백그라운드)
- `npm run docker:down` - Docker 서비스 중지
- `npm run docker:logs` - Docker 로그 확인

### Prisma
- `npm run prisma:generate` - Prisma Client 생성
- `npm run prisma:migrate` - 마이그레이션 실행
- `npm run prisma:studio` - Prisma Studio 실행

### 기타
- `npm run clean` - node_modules 및 빌드 아티팩트 삭제

## 포트 구성

- **Client App**: 3000
- **Admin App**: 3002
- **Backend API**: 3001
- **PostgreSQL**: 5432
- **Redis**: 6379
- **Prisma Studio**: 5555

## 디자인 시스템

### 컬러 팔레트 (Hot Pink Theme)
- **Hot Pink**: `#FF007A` - Primary accent
- **Primary Black**: `#121212` - Background
- **Content BG**: `#1E1E1E` - Cards, panels
- **Primary Text**: `#FFFFFF` - Main text
- **Secondary Text**: `#A0A0A0` - Secondary text
- **Success**: `#34C759` - Success states
- **Error**: `#FF3B30` - Error states

### 타이포그래피
- **Font**: Pretendard (via CDN)
- **Display**: 28px / Bold
- **H1**: 22px / Bold
- **H2**: 18px / SemiBold
- **Body**: 16px / Regular
- **Caption**: 14px / Medium

## 개발 가이드라인

### 코딩 스타일
- TypeScript strict mode 사용
- Feature-based 컴포넌트 구조
- 테스트 파일은 소스 파일과 함께 위치
- 유틸리티는 `/lib` 폴더에 작성 (NOT `/utils`)
- 컴포넌트: PascalCase
- 함수/변수: camelCase
- 상수: UPPER_SNAKE_CASE

### Prisma 네이밍 규칙
- **Models**: PascalCase (User, Product)
- **Fields**: camelCase (userId, productName)
- **DB Tables**: snake_case plural (users, products)
- **DB Columns**: snake_case (user_id, product_name)
- `@@map()` 및 `@map()` 사용하여 매핑

### Git 커밋 규칙
```
feat(scope): 새로운 기능 추가
fix(scope): 버그 수정
docs(scope): 문서 수정
style(scope): 코드 포맷팅
refactor(scope): 코드 리팩토링
test(scope): 테스트 추가/수정
chore(scope): 빌드/설정 변경
```

## 문서

상세한 프로젝트 문서는 `/docs` 폴더를 참고하세요:
- PRD (Product Requirements Document)
- 아키텍처 문서
- API 설계 문서
- UX 디자인 가이드
- 개발 가이드

## 라이선스

Private Project
