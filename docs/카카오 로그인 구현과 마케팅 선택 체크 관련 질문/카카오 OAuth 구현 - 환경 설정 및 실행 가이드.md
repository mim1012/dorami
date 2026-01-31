# 카카오 OAuth 구현 - 환경 설정 및 실행 가이드

## 1. 필수 패키지 설치

### 백엔드 (Node.js + Express)

```bash
npm install express axios jsonwebtoken dotenv
npm install --save-dev jest supertest @types/jest
```

### 프론트엔드 (React)

```bash
npm install axios
```

## 2. 환경 변수 설정

### 백엔드 (.env 파일)

프로젝트 루트 디렉토리에 `.env` 파일을 생성하고 다음 내용을 추가합니다.

```env
# 카카오 개발자 콘솔에서 확인한 REST API 키
KAKAO_REST_API_KEY=your_rest_api_key_here

# 카카오 개발자 콘솔에 등록한 Redirect URI
KAKAO_REDIRECT_URI=http://localhost:8080/api/auth/kakao/callback

# JWT 토큰 생성에 사용할 비밀 키 (임의의 긴 문자열)
JWT_SECRET=your_jwt_secret_key_here_make_it_long_and_random

# 서버 포트
PORT=8080
```

### 프론트엔드 (.env 파일)

프론트엔드 프로젝트 루트 디렉토리에 `.env` 파일을 생성합니다.

```env
# React 환경 변수는 REACT_APP_ 접두사를 사용해야 합니다
REACT_APP_KAKAO_REST_API_KEY=your_rest_api_key_here
REACT_APP_KAKAO_REDIRECT_URI=http://localhost:3000/auth/kakao/callback
REACT_APP_API_BASE_URL=http://localhost:8080
```

## 3. 백엔드 서버 실행

### 기본 서버 구성 (server.js)

```javascript
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const kakaoAuthRouter = require("./routes/kakaoAuth");

const app = express();

// 미들웨어 설정
app.use(cors());
app.use(express.json());

// 라우터 등록
app.use("/api/auth", kakaoAuthRouter);

// 헬스 체크 엔드포인트
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

// 서버 시작
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`카카오 로그인 콜백: http://localhost:${PORT}/api/auth/kakao/callback`);
});

module.exports = app;
```

### 서버 실행 명령어

```bash
# 개발 환경 (nodemon 사용)
npm install --save-dev nodemon
npm run dev

# package.json에 다음을 추가
{
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js"
  }
}

# 또는 직접 실행
node server.js
```

## 4. 프론트엔드 실행

### React 앱 실행

```bash
# 개발 서버 시작
npm start

# 프로덕션 빌드
npm run build
```

프론트엔드는 기본적으로 `http://localhost:3000`에서 실행됩니다.

## 5. 통합 테스트 실행

### 테스트 실행 명령어

```bash
# 모든 테스트 실행
npm test

# 특정 테스트 파일만 실행
npm test kakao_auth.test.js

# 감시 모드 (파일 변경 시 자동 재실행)
npm test -- --watch

# 커버리지 리포트 생성
npm test -- --coverage
```

### 예상 테스트 결과

```
PASS  kakao_auth.test.js
  카카오 OAuth 2.0 인증 테스트
    GET /api/auth/kakao/callback
      성공 케이스
        ✓ 유효한 인증 코드로 로그인에 성공해야 한다 (45ms)
        ✓ 발급받은 JWT 토큰이 유효해야 한다 (12ms)
      실패 케이스
        ✓ 인증 코드가 없으면 400 에러를 반환해야 한다 (8ms)
        ✓ 사용자가 로그인을 거부하면 400 에러를 반환해야 한다 (6ms)
        ✓ 카카오 토큰 발급 실패 시 500 에러를 반환해야 한다 (10ms)
        ✓ 카카오 사용자 정보 조회 실패 시 500 에러를 반환해야 한다 (9ms)
        ✓ 카카오 API 응답이 예상과 다르면 500 에러를 반환해야 한다 (7ms)
      엣지 케이스
        ✓ 특수 문자가 포함된 이메일을 정상 처리해야 한다 (8ms)
        ✓ 한글 닉네임을 정상 처리해야 한다 (7ms)
        ✓ 매우 긴 인증 코드를 정상 처리해야 한다 (10ms)
    GET /api/auth/kakao
      ✓ 카카오 인증 페이지로 리다이렉트해야 한다 (5ms)
    POST /api/auth/kakao/logout
      ✓ 유효한 토큰으로 로그아웃에 성공해야 한다 (8ms)
      ✓ 토큰이 없으면 400 에러를 반환해야 한다 (4ms)
      ✓ 카카오 로그아웃 API 실패 시 500 에러를 반환해야 한다 (6ms)
  성능 및 보안 테스트
    ✓ 동시 다중 요청을 처리할 수 있어야 한다 (35ms)
    ✓ JWT 토큰에 만료 시간이 설정되어야 한다 (10ms)

Test Suites: 1 passed, 1 total
Tests:       16 passed, 16 total
Snapshots:   0 total
Time:        2.345 s
```

## 6. 수동 E2E 테스트 체크리스트

### 로그인 흐름 테스트

- [ ] 프론트엔드의 "카카오로 로그인" 버튼을 클릭했을 때 카카오 로그인 페이지로 이동하는가?
- [ ] 카카오 계정으로 로그인 가능한가?
- [ ] 동의 항목이 정상적으로 표시되는가?
- [ ] 동의 후 프론트엔드의 콜백 페이지로 리다이렉트되는가?
- [ ] 콜백 페이지에서 사용자 정보(닉네임, 이메일, 프로필 사진)가 정상적으로 표시되는가?
- [ ] 로컬 스토리지에 JWT 토큰이 저장되는가?

### 로그아웃 흐름 테스트

- [ ] 로그아웃 버튼을 클릭했을 때 로그인 페이지로 이동하는가?
- [ ] 로컬 스토리지의 토큰이 삭제되는가?
- [ ] 백엔드 로그아웃 API가 호출되는가?

### 에러 처리 테스트

- [ ] 로그인 거부 시 에러 메시지가 표시되는가?
- [ ] 네트워크 오류 시 적절한 에러 메시지가 표시되는가?
- [ ] 만료된 토큰으로 API 호출 시 401 에러가 반환되는가?

## 7. Postman으로 API 테스트

### 1단계: 인증 코드 발급

브라우저 주소창에 다음 URL을 입력합니다.

```
https://kauth.kakao.com/oauth/authorize?client_id={REST_API_KEY}&redirect_uri={REDIRECT_URI}&response_type=code
```

로그인 후 리다이렉트된 URL에서 `code` 파라미터 값을 복사합니다.

### 2단계: Postman에서 토큰 발급 요청

**Method**: POST  
**URL**: `https://kauth.kakao.com/oauth/token`

**Body** (x-www-form-urlencoded):
- `grant_type`: `authorization_code`
- `client_id`: `{REST_API_KEY}`
- `redirect_uri`: `{REDIRECT_URI}`
- `code`: `{1단계에서 복사한 코드}`

**Response**:
```json
{
  "access_token": "...",
  "token_type": "bearer",
  "expires_in": 21599,
  "refresh_token": "...",
  "refresh_token_expires_in": 5184000
}
```

### 3단계: Postman에서 사용자 정보 조회

**Method**: GET  
**URL**: `https://kapi.kakao.com/v2/user/me`

**Headers**:
- `Authorization`: `Bearer {2단계에서 받은 access_token}`

**Response**:
```json
{
  "id": 1234567890,
  "kakao_account": {
    "email": "user@example.com",
    "profile": {
      "nickname": "사용자닉네임",
      "profile_image_url": "..."
    }
  },
  "properties": {
    "nickname": "사용자닉네임"
  }
}
```

## 8. 트러블슈팅

### 문제: "Redirect URI가 일치하지 않습니다" 에러

**해결책**:
1. 카카오 개발자 콘솔에서 등록한 Redirect URI를 확인합니다.
2. 환경 변수의 `KAKAO_REDIRECT_URI`가 정확히 일치하는지 확인합니다.
3. 프로토콜(http/https), 도메인, 포트, 경로가 모두 일치해야 합니다.

### 문제: "Invalid client_id" 에러

**해결책**:
1. 카카오 개발자 콘솔의 REST API 키를 정확히 복사했는지 확인합니다.
2. 환경 변수가 제대로 로드되었는지 확인합니다: `console.log(process.env.KAKAO_REST_API_KEY)`
3. 앱이 활성화되어 있는지 확인합니다.

### 문제: CORS 에러

**해결책**:
1. 백엔드에 CORS 미들웨어를 추가합니다:
   ```javascript
   const cors = require("cors");
   app.use(cors());
   ```
2. 또는 특정 도메인만 허용하도록 설정합니다:
   ```javascript
   app.use(cors({
     origin: "http://localhost:3000",
     credentials: true
   }));
   ```

### 문제: JWT 토큰 검증 실패

**해결책**:
1. 백엔드와 프론트엔드의 `JWT_SECRET`이 동일한지 확인합니다.
2. 토큰 만료 시간을 확인합니다: `jwt.verify(token, secret)`
3. 토큰 형식이 `Bearer {token}` 형식인지 확인합니다.

## 9. 보안 권장사항

1. **환경 변수 보호**: `.env` 파일을 `.gitignore`에 추가하여 버전 관리에서 제외합니다.
2. **HTTPS 사용**: 프로덕션 환경에서는 반드시 HTTPS를 사용합니다.
3. **토큰 저장**: 프론트엔드에서는 토큰을 HttpOnly 쿠키에 저장하는 것이 더 안전합니다.
4. **CSRF 보호**: 상태 변경 요청(POST, PUT, DELETE)에 CSRF 토큰을 사용합니다.
5. **Rate Limiting**: API 엔드포인트에 Rate Limiting을 적용하여 남용을 방지합니다.
6. **입력 검증**: 모든 사용자 입력을 검증하고 새니타이제이션합니다.
7. **에러 처리**: 민감한 정보를 에러 메시지에 노출하지 않습니다.

## 10. 추가 리소스

- [카카오 개발자 문서 - 로그인](https://developers.kakao.com/docs/latest/ko/kakaologin/common)
- [카카오 개발자 문서 - REST API](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api)
- [OAuth 2.0 표준 명세](https://tools.ietf.org/html/rfc6749)
- [JWT 소개](https://jwt.io/)
