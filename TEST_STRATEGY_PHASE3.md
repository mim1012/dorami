# Phase 3: 테스트 전략 및 실시간 성능 검증

**작성일**: 2026-02-28
**상태**: ✅ 완료
**범위**: 테스트 커버리지 평가, 실시간 테스트 개선, 배포 재현성

---

## 1️⃣ 현재 테스트 커버리지 평가

### 1.1 라이브 스트리밍 관련 테스트 (✅ 존재함)

#### Frontend E2E 테스트 (Playwright)

**라이브 페이지 기본**:

- `live-page.spec.ts` — 라이브 페이지 렌더링, 빈 상태, 예정 방송
  - ✅ 헤더 표시 확인
  - ✅ 라이브 목록/빈 상태 처리
  - ✅ 예정된 라이브 표시
  - ⚠️ 실제 비디오 플레이백 테스트 없음

**라이브 상품 구매**:

- `live-featured-product-purchase.spec.ts` — 주요 상품 구매 흐름
- `live-cart-pickup.spec.ts` — 라이브 중 장바구니 픽업

**실시간 상품 업데이트**:

- `admin-live-product-realtime.spec.ts` — 관리자 상품 등록 → 라이브 페이지 즉시 반영
  - ✅ 상품 추가 시 관리자 UI 갱신
  - ✅ 라이브 페이지 상태 검증
  - ✅ WebSocket 실시간 메시지 확인
  - ⚠️ 스트림 상태 전환 테스트 제한적

**채팅 기능**:

- `chat.spec.ts` — 채팅 UI 요소 검증
- `chat-send-message.spec.ts` — 메시지 전송
- `chat-delete-test.spec.ts`, `chat-delete-manual.spec.ts` — 메시지 삭제
  - ✅ 채팅 UI 렌더링
  - ✅ 메시지 송수신 기본 흐름
  - ⚠️ 메시지 순서 보장 테스트 없음
  - ⚠️ 채팅 히스토리 로드 테스트 없음
  - ⚠️ 동시 메시지 처리 테스트 없음

#### Backend E2E 테스트 (Jest)

**스트리밍 기본**:

- `backend/test/app.e2e-spec.ts` — 헬스체크 엔드포인트
- 스트리밍 서버 상호작용 테스트 **부재**

**채팅/WebSocket**:

- ❌ **WebSocket 통합 테스트 없음** (Socket.IO 클라이언트 없음)
- ❌ **실시간 메시지 전달 검증 없음**
- ❌ **Redis 어댑터 재연결 테스트 없음**

### 1.2 WebSocket 연결 및 메시지 송수신 테스트

#### 현재 상태

**Frontend에서의 WebSocket 사용**:

```typescript
// client-app/src/hooks/useCartActivity.ts
const socket = io(baseUrl + '/', {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
});

socket.on('connect', () => {
  /* ... */
});
socket.on('cart:item-added', (data) => {
  /* ... */
});
```

**Backend에서의 WebSocket 구현**:

```typescript
// backend/src/modules/chat/chat.gateway.ts
@WebSocketGateway({ namespace: '/chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  async handleConnection(client: Socket) {
    // JWT 인증
    client.emit('connection:success', {
      /* ... */
    });
  }

  @SubscribeMessage('chat:send')
  async handleSendMessage(client: Socket, payload) {
    this.server.to(roomName).emit('chat:message', data);
  }
}
```

**테스트 커버리지**:

- ✅ E2E 테스트에서 UI 요소 검증
- ✅ 메시지 전송 기본 흐름
- ❌ **WebSocket 프로토콜 레벨 테스트 없음**
- ❌ **재연결 시나리오 테스트 없음**
- ❌ **메시지 손실 감지 테스트 없음**

### 1.3 E2E 테스트 범위 (User/Admin 프로젝트 커버리지)

#### User 프로젝트 (일반 사용자)

**포함된 테스트** (admin-\* 제외):

- 홈, 라이브, 채팅, 장바구니, 주문
- 사용자 여정, 마이페이지, 예약 시스템
- 회원가입, Kakao 인증
- **카운트**: ~23개

**제외된 테스트**:

- admin-\* (관리자 전용)

#### Admin 프로젝트 (관리자)

**포함된 테스트**:

- admin-management, admin-orders, admin-users
- admin-products-crud, admin-payment-confirmation
- admin-settlement, admin-audit-log, admin-broadcasts
- admin-live-product-realtime, admin-restream
- **카운트**: ~14개

**분리 효과**:

- ✅ 병렬 실행 가능
- ✅ 다른 인증 상태 사용
- ✅ CI에서 선택적 실행 가능

### 1.4 통합 테스트 (Backend + Frontend + WebSocket)

**현재 상태**: ❌ **부재**

**이유**:

- WebSocket 프로토콜 테스트를 위해 Node.js 클라이언트 필요
- Backend E2E에서 Socket.IO 클라이언트 연결 없음
- Frontend Playwright에서 실제 스트리밍 서버 연결 어려움

**예시 부족 시나리오**:

1. 관리자가 상품 추가 → Backend 이벤트 발행
2. Socket.IO 메시지 브로드캐스트
3. 라이브 페이지 클라이언트 수신 및 UI 업데이트
4. 전체 흐름 검증 불가능

### 1.5 데이터베이스 마이그레이션 테스트

**현재 상태**:

- ✅ CI에서 마이그레이션 자동 실행 (`prisma migrate deploy`)
- ✅ 14개 마이그레이션 히스토리 유지
- ⚠️ **마이그레이션 롤백 테스트 없음**
- ⚠️ **데이터 손실 시나리오 테스트 없음**
- ⚠️ **마이그레이션 순서 겹침** (20260224, 20260225)

**마이그레이션 검증**:

```bash
# CI에서 실행
npx prisma migrate deploy
# 하지만 롤백 또는 검증 없음
```

---

## 2️⃣ 실시간 테스트 개선 방안

### 2.1 WebSocket 테스트 방법론

#### 옵션 A: Mock Socket.IO (빠름, 제한적)

**장점**:

- 단위 테스트 속도 빠름
- 네트워크 지연 없음
- 격리된 테스트 환경

**단점**:

- 실제 프로토콜 동작 검증 불가
- Redis 어댑터 동작 확인 불가
- 재연결 로직 검증 불가

**사용 사례**:

```typescript
// 메시지 포맷, 이벤트 순서 검증
const mockSocket = {
  emit: jest.fn(),
  on: jest.fn(),
};
chatService.sendMessage(mockSocket, data);
expect(mockSocket.emit).toHaveBeenCalledWith('chat:message', expect.any(Object));
```

#### 옵션 B: 실제 Socket.IO 서버 (정확함, 느림)

**장점**:

- 전체 프로토콜 동작 검증
- Redis 어댑터 테스트 가능
- 재연결 로직 실제 동작 확인

**단점**:

- 테스트 시간 오래 걸림 (초 단위)
- 외부 의존성 (Redis, 서버 시작)
- 환경 설정 복잡

**구현 예시**:

```typescript
// backend/test/websocket/chat.integration.spec.ts
import { io as ioClient } from 'socket.io-client';

describe('Chat WebSocket Integration', () => {
  let app: INestApplication;
  let clientSocket: Socket;

  beforeAll(async () => {
    app = await Test.createNestApplication();
    await app.listen(3001);
  });

  beforeEach((done) => {
    clientSocket = ioClient('http://localhost:3001/chat', {
      auth: { token: JWT_TOKEN },
    });
    clientSocket.on('connect', done);
  });

  it('should send and receive message', (done) => {
    clientSocket.emit('chat:send', { content: 'Hello' });

    clientSocket.on('chat:message', (data) => {
      expect(data.content).toBe('Hello');
      done();
    });
  });

  afterEach(() => {
    clientSocket.disconnect();
  });

  afterAll(async () => {
    await app.close();
  });
});
```

#### 권장 전략: Hybrid

1. **단위 테스트** (Mock): 메시지 형식, 이벤트 처리
2. **통합 테스트** (실제 서버): 재연결, 멀티 클라이언트
3. **E2E 테스트** (Playwright): UI 렌더링

### 2.2 라이브 스트림 시뮬레이션 전략

#### 옵션 A: FFmpeg로 테스트 스트림 생성

**설정**:

```bash
# RTMP 서버 시작 (SRS)
docker-compose up srs

# FFmpeg로 테스트 스트림 생성
ffmpeg -f lavfi -i testsrc=size=1280x720:duration=60 \
       -f lavfi -i sine=frequency=1000:duration=60 \
       -pix_fmt yuv420p -c:v libx264 -c:a aac \
       -f flv "rtmp://localhost:1935/live/test-stream"
```

**장점**:

- 실제 RTMP 프로토콜
- OBS와 동일한 인코딩
- 비디오 플레이백 테스트 가능

**단점**:

- FFmpeg 설치 필요
- 테스트 시간 오래 걸림 (스트림 기간)
- CI에서 무겁고 느림

#### 옵션 B: 목 스트림 (mock stream)

**설정**:

```typescript
// backend/test/fixtures/mock-stream.ts
async function startMockStream(streamKey: string) {
  const rtmp = new RTMPServer();

  // 가짜 RTMP 데이터 생성
  const fakeFrame = Buffer.alloc(1000);
  rtmp.publish(streamKey, fakeFrame);

  // 3초 후 스트림 종료
  setTimeout(() => rtmp.unpublish(streamKey), 3000);
}
```

**장점**:

- 빠름 (실제 인코딩 없음)
- CI에서 간단
- 재현성 좋음

**단점**:

- 실제 RTMP 프로토콜 검증 안 됨
- 비디오 플레이백 테스트 불가

### 2.3 부하 테스트 계획

#### 동시 접속 시나리오

```bash
# 100명 동시 접속, 각 10개 메시지 전송
# 테스트 지표: 응답 시간, 메시지 손실, 재연결

artillery run load-test.yml
```

**설정 예시** (`load-test.yml`):

```yaml
config:
  target: 'http://localhost:3001'
  phases:
    - duration: 60
      arrivalRate: 10 # 10명/초
      name: 'Ramp up'
    - duration: 300
      arrivalRate: 10
      name: 'Sustained'
    - duration: 60
      arrivalRate: 0
      name: 'Ramp down'

scenarios:
  - name: 'Live Stream + Chat'
    flow:
      - get:
          url: '/api/health'
      - think: 5
      - ws:
          url: 'ws://localhost:3001/chat'
          emit:
            - channel: 'chat:send'
              data: '{"content":"Hello","streamKey":"test"}'
          on:
            message: 'chat:message'
          loop:
            - think: 2
```

**지표**:

- p95 응답시간: < 500ms
- p99 응답시간: < 1000ms
- 메시지 손실률: 0%
- 재연결 성공률: > 99%

#### 스트림 장애 시나리오

1. **네트워크 끊김**:
   - RTMP 연결 중단 → SRS 자동 종료
   - 클라이언트 HLS 폴백 확인

2. **서버 재시작**:
   - 스트림 중단 상태에서 서버 재시작
   - 클라이언트 재연결 확인

3. **메시지 폭증**:
   - 1초에 1000개 메시지 전송
   - Redis 큐 오버플로우 처리 확인

4. **클라이언트 강제 종료**:
   - 스트림 재생 중 브라우저 새로고침
   - UI 상태 복구 확인

---

## 3️⃣ 배포 파이프라인의 재현성 테스트

### 3.1 CI/CD 파이프라인 현황

#### 변경사항 감지 (Dorny paths-filter)

```yaml
backend:
  - 'backend/**'
  - 'packages/shared-types/**'
  - 'package.json'

frontend:
  - 'client-app/**'
  - 'packages/shared-types/**'
  - 'package.json'

infra:
  - 'docker-compose*.yml'
  - '**/Dockerfile'
  - 'infrastructure/**'
```

**문제점**:

- ⚠️ `shared-types` 변경 시 backend + frontend 모두 트리거
- ⚠️ `nginx/` 폴더 변경 시 infra CI 트리거 안 됨

#### 재현성 검증

**현재**:

- ✅ PostgreSQL 16 서비스 실행 (CI)
- ✅ Redis 7 서비스 실행 (CI)
- ✅ 마이그레이션 자동 실행
- ❌ SRS 스트리밍 서버 없음
- ❌ 실제 배포 환경과 불일치

**문제 사례**:

| 시나리오  | 로컬     | CI       | 프로덕션 |
| --------- | -------- | -------- | -------- |
| RTMP 수신 | ✅ SRS   | ❌ 없음  | ✅ ECS   |
| HLS 변환  | ✅ SRS   | ❌ 없음  | ✅ Nginx |
| WebSocket | ✅ Redis | ✅ Redis | ✅ Redis |
| 암호화    | ✅       | ✅       | ✅       |

### 3.2 스테이징 환경 정의 부재

**현재 상태**:

- 로컬: docker-compose
- CI: 최소 서비스 (DB, Redis만)
- 프로덕션: AWS CDK

**부족한 환경**:

- ❌ Staging (프로덕션과 유사하지만 테스트용)
- ❌ E2E 테스트용 배포 환경

**개선안**:

```yaml
# docker-compose.staging.yml
services:
  postgres: ...
  redis: ...
  srs: # 프로덕션과 동일
    image: ossrs/srs:6
  backend:
    image: live-commerce-backend:test
    environment:
      RTMP_SERVER_URL: http://srs:8080
  frontend:
    image: live-commerce-frontend:test
  nginx: # 프로덕션 프록시
    image: nginx:latest
    volumes:
      - ./nginx/staging-ssl.conf:/etc/nginx/nginx.conf
```

**배포**:

```bash
# Staging 환경에서 E2E 테스트 실행
npm run deploy:staging
npm run test:e2e:staging
```

### 3.3 CI 재현성 개선 방안

**즉시 개선** (우선순위 1):

1. 마이그레이션 검증 강화
2. 환경 변수 일치 확인
3. 타입 체크 엄격화

**단기 개선** (우선순위 2):

1. SRS 서버 CI에 추가
2. WebSocket 통합 테스트 추가
3. Docker 빌드 테스트 강화

**장기 개선** (우선순위 3):

1. Staging 환경 구성
2. Blue-Green 배포 테스트
3. 성능 테스트 자동화

---

## 4️⃣ 테스트 전략 평가 점수

### 점수 체계 (100점 기준)

| 영역                       | 현재       | 목표       | 우선순위 |
| -------------------------- | ---------- | ---------- | -------- |
| **UI 테스트** (Playwright) | 85/100     | 90/100     | 낮음     |
| **API 테스트** (Jest E2E)  | 75/100     | 85/100     | 중간     |
| **WebSocket 테스트**       | 30/100     | 80/100     | **높음** |
| **부하 테스트**            | 0/100      | 70/100     | **높음** |
| **마이그레이션 테스트**    | 40/100     | 85/100     | 중간     |
| **배포 재현성**            | 50/100     | 90/100     | **높음** |
| **전체 평가**              | **55/100** | **85/100** | —        |

### 주요 갭

1. **WebSocket 통합 테스트 부재** (-30점)
   - 채팅, 실시간 업데이트 검증 불가
   - 재연결 로직 미검증

2. **부하/스트레스 테스트 없음** (-25점)
   - 동시 접속 성능 미검증
   - 메시지 폭증 시나리오 미검증

3. **마이그레이션 롤백 테스트 부재** (-20점)
   - 마이그레이션 순서 겹침 미검증
   - 데이터 손실 시나리오 미테스트

4. **배포 환경 재현성 낮음** (-20점)
   - SRS 없는 CI
   - Staging 환경 부재

---

## 5️⃣ 개선 로드맵

### Phase 1: 즉시 (1주)

- [ ] WebSocket 통합 테스트 추가 (Socket.IO 클라이언트)
- [ ] 마이그레이션 검증 스크립트 추가
- [ ] E2E 실패 정책 강화 (실패 시 빌드 실패)
- [ ] CI에 환경 변수 검증 추가

### Phase 2: 단기 (2-3주)

- [ ] SRS를 CI에 추가 (Docker 서비스)
- [ ] 부하 테스트 계획 및 기본 구현 (Artillery)
- [ ] Staging 환경 구성
- [ ] 채팅 메시지 순서 보장 테스트

### Phase 3: 장기 (1개월+)

- [ ] Blue-Green 배포 검증
- [ ] 성능 모니터링 대시보드 (CloudWatch/Datadog)
- [ ] 카오스 엔지니어링 (AWS Chaos Monkey)
- [ ] 자동화된 성능 회귀 테스트

---

## 6️⃣ 실행 체크리스트

### 테스트 작성

- [ ] `backend/test/websocket/chat.integration.spec.ts` 작성
- [ ] `backend/test/websocket/cart-activity.integration.spec.ts` 작성
- [ ] `backend/test/migrations/rollback.spec.ts` 작성
- [ ] `client-app/e2e/live-stream-video.spec.ts` 작성 (비디오 플레이백)

### CI/CD 개선

- [ ] `.github/workflows/ci.yml`에 SRS 서비스 추가
- [ ] 마이그레이션 검증 단계 추가
- [ ] E2E 실패 시 빌드 실패 설정
- [ ] 타입 검사 엄격화 (skipLibCheck: false)

### 배포 인프라

- [ ] `docker-compose.staging.yml` 작성
- [ ] Staging 배포 스크립트 작성
- [ ] 환경 변수 일치 검증 추가

### 문서화

- [ ] WebSocket 테스트 가이드 작성
- [ ] 부하 테스트 시나리오 문서화
- [ ] 배포 체크리스트 작성

---

**작성자**: Claude Code Test Engineer
**다음 단계**: Phase 4 (종합 리포트 및 액션 플랜)
