# 도라미 백엔드 프로덕션 배포 가이드

## 📋 개요

NestJS + Socket.IO 기반 라이브 커머스 플랫폼 백엔드

**주요 기능:**
- REST API (상품, 주문, 사용자, 스트리밍)
- WebSocket (실시간 채팅, 스트리밍, 상품 업데이트)
- JWT 인증
- Redis Pub/Sub (클러스터 지원)
- PostgreSQL 데이터베이스

## 🚀 배포 전 체크리스트

### 1. 환경 변수 설정

필수 환경 변수:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dorami

# JWT
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Redis
REDIS_URL=redis://localhost:6379

# CORS (쉼표로 구분)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Node Environment
NODE_ENV=production

# Port (optional, default: 3001)
PORT=3001
```

### 2. 보안 설정

**JWT Secret 생성:**
```bash
openssl rand -base64 32
```

**CSRF 보호:**
- 프로덕션에서는 `CSRF_ENABLED=true` (기본값)
- 개발 환경에서만 `CSRF_ENABLED=false`

**CORS:**
- 프로덕션 도메인만 허용
- 와일드카드(`*`) 사용 금지

### 3. 데이터베이스 마이그레이션

```bash
# Prisma 마이그레이션
npx prisma migrate deploy

# 연결 테스트
npx prisma db pull
```

### 4. Redis 설정

**Redis 클러스터 (권장):**
```bash
REDIS_URL=redis://primary-node:6379
```

**Redis Sentinel:**
```bash
REDIS_URL=redis-sentinel://sentinel1:26379,sentinel2:26379
```

## 🔧 빌드 및 실행

### 개발 환경

```bash
npm install
npm run start:dev
```

### 프로덕션 빌드

```bash
# TypeScript 컴파일
npm run build

# 프로덕션 실행
npm run start:prod
```

### PM2로 실행 (권장)

```bash
# PM2 설치
npm install -g pm2

# 실행
pm2 start ecosystem.config.js --env production

# 클러스터 모드 (CPU 코어 수만큼)
pm2 start ecosystem.config.js --env production -i max

# 로그 확인
pm2 logs dorami-backend

# 모니터링
pm2 monit
```

**ecosystem.config.js:**
```javascript
module.exports = {
  apps: [{
    name: 'dorami-backend',
    script: 'dist/main.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '1G',
    autorestart: true,
    watch: false
  }]
};
```

## 🏥 헬스체크 엔드포인트

### Liveness Probe
```bash
GET /api/v1/health/live
```

응답:
```json
{
  "status": "ok",
  "timestamp": "2026-02-12T17:28:31.047Z"
}
```

### Readiness Probe
```bash
GET /api/v1/health/ready
```

응답:
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

**Kubernetes 설정 예시:**
```yaml
livenessProbe:
  httpGet:
    path: /api/v1/health/live
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /api/v1/health/ready
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 5
```

## 🔌 Socket.IO 네임스페이스

### `/chat` - 실시간 채팅
- **인증:** JWT 필수
- **이벤트:**
  - `chat:join-room` - 라이브 방 참여
  - `chat:leave-room` - 라이브 방 나가기
  - `chat:send-message` - 메시지 전송 (rate limit: 20msg/10s)
  - `chat:delete-message` - 메시지 삭제 (ADMIN만)

### `/streaming` - 스트리밍
- **인증:** JWT 필수
- **이벤트:**
  - `stream:viewer:join` - 시청자 참여
  - `stream:viewer:leave` - 시청자 나가기
- **Redis 키:** `stream:{streamKey}:viewers`

### `/` - 루트 (범용)
- **인증:** JWT 필수
- **이벤트:**
  - `join:stream` - 스트림 룸 참여
  - `leave:stream` - 스트림 룸 나가기
- **브로드캐스트:**
  - `live:product:added`
  - `live:product:updated`
  - `live:product:soldout`
  - `live:product:deleted`

## 📊 모니터링

### 로그 수준
- **Production:** `warn`, `error` (default)
- **Development:** `log`, `debug`, `verbose`

### 메트릭 수집

**PM2 Plus (권장):**
```bash
pm2 link <secret> <public>
pm2 install pm2-server-monit
```

**Prometheus:**
- `/metrics` 엔드포인트 추가 필요
- `prom-client` 패키지 사용

### 주요 메트릭
- HTTP 요청 수 및 응답 시간
- WebSocket 연결 수
- Redis 연결 상태
- Database 쿼리 성능
- 메모리 사용량

## 🛡️ 보안 강화

### 1. Rate Limiting

**Socket.IO 이벤트:**
- `chat:send-message`: 20msg/10s
- 기타 이벤트: 기본 100req/10s

**HTTP API:**
- Throttler 설정 (`ThrottlerModule`)
- 기본: 10req/1min

### 2. CORS 설정

프로덕션에서는 명시적 도메인만 허용:

```typescript
CORS_ORIGINS=https://dorami.com,https://app.dorami.com
```

### 3. Helmet 보안 헤더

자동 적용됨:
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options

### 4. JWT 토큰 검증

- Access Token: 15분
- Refresh Token: 7일
- Redis 블랙리스트 확인

## 🚨 장애 대응

### Graceful Shutdown

서버는 `SIGTERM`, `SIGINT` 신호를 받으면:

1. Socket.IO 연결 종료 (클라이언트에 알림)
2. Redis 연결 종료
3. HTTP 서버 종료
4. 데이터베이스 연결 종료

**최대 종료 시간:** 30초

### 재시작 전략

**PM2:**
```bash
# 무중단 재시작
pm2 reload dorami-backend

# 강제 재시작
pm2 restart dorami-backend
```

### 백업 및 복구

**데이터베이스:**
```bash
# 백업
pg_dump -h localhost -U user -d dorami > backup.sql

# 복구
psql -h localhost -U user -d dorami < backup.sql
```

**Redis:**
```bash
# AOF 백업 (권장)
redis-cli BGREWRITEAOF

# RDB 스냅샷
redis-cli BGSAVE
```

## 📈 성능 최적화

### 1. Database Connection Pool

Prisma 기본 설정:
- Pool size: 20 connections

조정:
```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  connection_limit = 50
}
```

### 2. Redis Connection Reuse

Socket.IO Redis Adapter는 connection pool 사용:
- Pub client: 1개
- Sub client: 1개

### 3. Socket.IO 최적화

```typescript
// Transports 우선순위
transports: ['websocket', 'polling']

// Ping 간격
pingInterval: 25000
pingTimeout: 60000
```

## 🐳 Docker 배포

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma
RUN npx prisma generate

COPY dist ./dist

EXPOSE 3001

CMD ["node", "dist/main.js"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/dorami
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=dorami
      - POSTGRES_PASSWORD=password

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

volumes:
  postgres_data:
  redis_data:
```

## 📚 추가 리소스

- [NestJS 공식 문서](https://docs.nestjs.com/)
- [Socket.IO 문서](https://socket.io/docs/v4/)
- [Prisma 문서](https://www.prisma.io/docs/)
- [PM2 문서](https://pm2.keymetrics.io/docs/)

## 🆘 문제 해결

### Socket.IO 연결 실패

1. CORS 설정 확인
2. JWT 토큰 유효성 확인
3. Redis 연결 상태 확인
4. 방화벽 설정 (포트 3001 오픈)

### Database 연결 오류

1. `DATABASE_URL` 확인
2. PostgreSQL 서비스 상태 확인
3. Connection pool 크기 확인
4. 네트워크 연결 확인

### Redis 연결 오류

1. `REDIS_URL` 확인
2. Redis 서비스 상태 확인
3. 메모리 사용량 확인
4. Maxmemory policy 설정 (`allkeys-lru` 권장)

---

**마지막 업데이트:** 2026-02-12
**버전:** 1.0.0
**담당자:** 김훈 (kim hun)
