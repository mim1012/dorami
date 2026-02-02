# ngrok 배포 가이드 (테스트/데모용)

## 🚀 빠른 시작 (Quick Start)

### 방법 1: 자동화 스크립트 사용 (권장)

1. **백엔드 + ngrok 시작**
   ```bash
   # D:\Project\dorami 폴더에서
   start-ngrok.bat
   ```

2. **ngrok 창에서 백엔드 URL 복사**
   - 예: `https://abc123-def-456.ngrok-free.app`

3. **프론트엔드 시작**
   ```bash
   start-frontend-ngrok.bat
   ```
   - 복사한 백엔드 URL 입력
   - Development 모드 선택 (1)

4. **프론트엔드 ngrok 시작** (새 터미널)
   ```bash
   ngrok http 3000
   ```

5. **완료!**
   - 프론트엔드 URL로 접속하여 테스트

---

### 방법 2: 수동 실행

#### Step 1: 백엔드 서버 실행

```bash
cd backend
npm run start:dev
```

#### Step 2: 백엔드 ngrok 터널 (새 터미널)

```bash
ngrok http 3001
```

**백엔드 URL 복사**: `https://YOUR-BACKEND.ngrok-free.app`

#### Step 3: 프론트엔드 환경변수 설정

```bash
cd client-app

# .env.local 파일 생성
echo NEXT_PUBLIC_API_URL=https://YOUR-BACKEND.ngrok-free.app/api > .env.local
echo NEXT_PUBLIC_WS_URL=https://YOUR-BACKEND.ngrok-free.app >> .env.local
```

#### Step 4: 프론트엔드 실행 (새 터미널)

**개발 모드 (빠름, 추천):**
```bash
cd client-app
npm run dev
```

**프로덕션 모드:**
```bash
cd client-app
npm run build
npm start
```

#### Step 5: 프론트엔드 ngrok 터널 (새 터미널)

```bash
ngrok http 3000
```

**프론트엔드 URL 복사**: `https://YOUR-FRONTEND.ngrok-free.app`

---

## 📱 접속 및 테스트

### 백엔드 API 테스트

브라우저나 Postman에서:
```
GET https://YOUR-BACKEND.ngrok-free.app/api
GET https://YOUR-BACKEND.ngrok-free.app/api/health
```

### 프론트엔드 접속

```
https://YOUR-FRONTEND.ngrok-free.app
```

### ngrok 대시보드

```
http://localhost:4040  # 백엔드
http://localhost:4041  # 프론트엔드 (두번째 ngrok)
```

---

## ⚙️ 환경 설정

### 백엔드 CORS 설정

`backend/.env` 파일 수정:
```env
CORS_ORIGINS=http://localhost:3000,http://localhost:3002,https://YOUR-FRONTEND.ngrok-free.app
```

서버 재시작 필요!

### 데이터베이스

- PostgreSQL이 실행 중이어야 합니다
- Windows 서비스에서 확인: `services.msc`

---

## 🔍 트러블슈팅

### ngrok URL이 계속 바뀌어요
- 무료 플랜은 세션마다 URL이 변경됩니다
- 유료 플랜으로 업그레이드하면 고정 도메인 사용 가능
- 또는 환경변수만 업데이트하면 됩니다

### CORS 에러가 발생해요
```bash
# backend/.env 파일에 프론트엔드 ngrok URL 추가
CORS_ORIGINS=http://localhost:3000,https://YOUR-FRONTEND.ngrok-free.app

# 백엔드 재시작
```

### 프론트엔드에서 API를 찾을 수 없어요
```bash
# client-app/.env.local 확인
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND.ngrok-free.app/api

# 프론트엔드 재시작
```

### WebSocket 연결 실패
```bash
# client-app/.env.local 확인
NEXT_PUBLIC_WS_URL=https://YOUR-BACKEND.ngrok-free.app

# wss:// (secure websocket) 사용됨
```

---

## ⚠️ 제한사항 (무료 플랜)

- **세션 시간**: 8시간 후 자동 종료
- **동시 터널**: 1개만 가능 (유료: 무제한)
- **URL**: 매 세션마다 변경
- **대역폭**: 제한 있음
- **프로덕션 사용 불가**: 테스트/데모 전용

---

## 🎯 유료 플랜 고려사항

### ngrok Pro ($8/month)
- 고정 도메인 3개
- 동시 터널 무제한
- 사용자 지정 도메인

### 더 나은 프로덕션 대안

1. **Vercel** (프론트엔드)
   - Next.js 최적화
   - 무료 플랜 있음
   - 자동 HTTPS

2. **Railway/Render** (백엔드)
   - NestJS + PostgreSQL
   - 무료 플랜 있음
   - 쉬운 배포

3. **AWS/GCP/Azure**
   - 전체 제어
   - 확장 가능
   - 초기 설정 복잡

---

## 📊 ngrok 상태 모니터링

### 웹 대시보드
```
http://localhost:4040
```

여기서 확인 가능:
- 실시간 요청/응답
- 트래픽 통계
- 에러 로그
- 요청 재생 (replay)

### CLI 상태 확인
```bash
curl http://localhost:4040/api/tunnels
```

---

## 🛑 종료하기

1. 모든 ngrok 창 닫기 (Ctrl+C)
2. 프론트엔드 서버 종료 (Ctrl+C)
3. 백엔드 서버 종료 (Ctrl+C)

또는 모든 Node 프로세스 종료:
```bash
taskkill /F /IM node.exe
taskkill /F /IM ngrok.exe
```

---

## 📝 참고 자료

- ngrok 공식 문서: https://ngrok.com/docs
- 무료 플랜: https://ngrok.com/pricing
- 문제 해결: https://ngrok.com/docs/guides/troubleshooting

---

**생성일**: 2026-02-02
**작성자**: Claude Code
**목적**: 테스트 및 데모 전용 배포 가이드
