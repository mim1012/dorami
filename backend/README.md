# 도레미 라이브 커머스 플랫폼 - 백엔드

NestJS + Socket.IO 기반 실시간 라이브 커머스 플랫폼

## 🎯 주요 기능

### REST API

- ✅ **인증** - JWT 기반 (Access + Refresh Token)
- ✅ **사용자 관리** - Kakao OAuth, 프로필, 권한
- ✅ **상품 관리** - CRUD, 재고, 품절 처리
- ✅ **주문 관리** - 주문 생성, 예약, 취소
- ✅ **장바구니** - 10분 타이머, 실시간 업데이트
- ✅ **스트리밍** - 라이브 세션 관리, 시청자 수
- ✅ **포인트** - 적립, 차감, 히스토리
- ✅ **관리자** - 대시보드, 통계, 설정

### WebSocket (Socket.IO)

#### `/chat` - 실시간 채팅

- 라이브 방 참여/나가기
- 메시지 송수신 (XSS 방지, 500자 제한)
- 메시지 삭제 (관리자)
- Rate limiting: 20msg/10s

#### `/streaming` - 스트리밍

- 시청자 참여/나가기
- 실시간 시청자 수 업데이트
- Redis 기반 클러스터 지원

#### `/` - 루트 (범용)

- 스트림 룸 참여/나가기
- 상품 업데이트 브로드캐스트
- 사용자 입장/퇴장 알림

## 🚀 빠른 시작

### 요구사항

- Node.js 18+
- PostgreSQL 14+
- Redis 7+

### 설치

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일 수정

# Prisma 마이그레이션
npx prisma migrate dev
npx prisma generate

# 개발 서버 실행
npm run start:dev
```

서버 시작: http://localhost:3001

### API 문서

Swagger: http://localhost:3001/api/docs

## 🔧 개발 스크립트

```bash
# 개발 서버 (Hot reload)
npm run start:dev

# 빌드
npm run build

# 프로덕션 실행
npm run start:prod

# 테스트
npm run test

# E2E 테스트
npm run test:e2e

# Lint
npm run lint

# Format
npm run format
```

## 📦 프로덕션 배포

자세한 내용은 [PRODUCTION.md](./PRODUCTION.md) 참고

### 빠른 배포 (PM2)

```bash
# 빌드
npm run build

# PM2로 실행
pm2 start ecosystem.config.js --env production

# 로그 확인
pm2 logs doremi-backend
```

### Docker 배포

```bash
# 이미지 빌드
docker build -t doremi-backend .

# 컨테이너 실행
docker run -d \
  -p 3001:3001 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  --name doremi-backend \
  doremi-backend
```

## 🏥 헬스체크

```bash
# Liveness
curl http://localhost:3001/api/v1/health/live

# Readiness (DB + Redis)
curl http://localhost:3001/api/v1/health/ready
```

## 🔌 Socket.IO 연결 테스트

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3001/chat', {
  auth: { token: 'your-jwt-token' },
  transports: ['websocket'],
});

socket.on('connection:success', (data) => {
  console.log('Connected:', data);
});

socket.emit('chat:join-room', { liveId: 'test-123' });
```

## 📁 프로젝트 구조

```
backend/
├── src/
│   ├── common/              # 공통 모듈 (guards, filters, interceptors)
│   │   ├── adapters/        # Custom IoAdapter
│   │   ├── filters/         # Exception filters
│   │   ├── guards/          # Auth guards
│   │   ├── interceptors/    # Response transformers
│   │   ├── middleware/      # WebSocket auth, rate limit
│   │   └── prisma/          # Prisma service
│   ├── modules/             # 기능별 모듈
│   │   ├── auth/            # 인증 (JWT, Kakao OAuth)
│   │   ├── users/           # 사용자
│   │   ├── products/        # 상품
│   │   ├── orders/          # 주문
│   │   ├── cart/            # 장바구니
│   │   ├── streaming/       # 스트리밍
│   │   ├── chat/            # 채팅
│   │   ├── points/          # 포인트
│   │   └── admin/           # 관리자
│   ├── main.ts              # 앱 엔트리포인트 (Socket.IO 수동 설정)
│   └── app.module.ts        # 루트 모듈
├── prisma/
│   └── schema.prisma        # Database 스키마
├── ecosystem.config.js      # PM2 설정
├── PRODUCTION.md            # 프로덕션 배포 가이드
└── README.md                # 이 파일
```

## 🛡️ 보안

### 인증

- JWT Access Token (15분)
- JWT Refresh Token (7일)
- Redis 블랙리스트

### 보호 기능

- CSRF 보호 (Double Submit Cookie)
- Rate Limiting (HTTP + WebSocket)
- Helmet 보안 헤더
- Input Validation (class-validator)
- SQL Injection 방지 (Prisma)
- XSS 방지 (HTML sanitization)

### WebSocket Rate Limits

- `chat:send-message`: 20msg/10s
- 기타 이벤트: 100req/10s

## 📊 모니터링

### 로그

```bash
# PM2 로그
pm2 logs doremi-backend

# 실시간 모니터링
pm2 monit
```

### 메트릭

- HTTP 요청 수/응답 시간
- WebSocket 연결 수
- Database 쿼리 성능
- Redis 연결 상태

## 🐛 디버깅

### TypeScript 디버깅

`.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug NestJS",
  "runtimeArgs": ["-r", "ts-node/register", "-r", "tsconfig-paths/register"],
  "args": ["${workspaceFolder}/src/main.ts"],
  "env": {
    "NODE_ENV": "development"
  }
}
```

### Socket.IO 디버깅

```bash
# Socket.IO 클라이언트 디버그
DEBUG=socket.io-client:* node test-client.js

# Socket.IO 서버 디버그
DEBUG=socket.io:* npm run start:dev
```

## 🧪 테스트

### 단위 테스트

```bash
npm run test
```

### E2E 테스트

```bash
# PostgreSQL + Redis 실행 필요
npm run test:e2e
```

### Socket.IO 수동 테스트

1. JWT 토큰 획득:

```bash
curl -X POST http://localhost:3001/api/v1/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

2. Socket.IO 클라이언트 연결:

```bash
node test-chat-auth.js
```

## 📝 커밋 컨벤션

```
feat: 새로운 기능
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 코드 리팩토링
test: 테스트 추가/수정
chore: 빌드/설정 변경
```

## 🤝 기여

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 📄 라이선스

Private - All Rights Reserved

## 👤 담당자

**김훈 (Kim Hun)**

- GitHub: [@mim1012](https://github.com/mim1012)
- Email: your-email@example.com

---

**Last Updated:** 2026-02-12
**Version:** 1.0.0
