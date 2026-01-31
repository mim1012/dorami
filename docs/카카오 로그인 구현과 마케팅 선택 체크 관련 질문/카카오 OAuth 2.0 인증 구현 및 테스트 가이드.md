# 카카오 OAuth 2.0 인증 구현 및 테스트 가이드

## 1. 개요

본 문서는 웹 애플리케이션에 카카오 OAuth 2.0을 사용한 소셜 로그인을 구현하고, 이를 효과적으로 테스트하는 방법에 대한 포괄적인 가이드를 제공합니다. REST API 기반의 표준적인 인증 흐름을 중심으로 설명하며, 프론트엔드와 백엔드 개발자 모두를 대상으로 합니다.

## 2. 사전 준비: 카카오 개발자 콘솔 설정

카카오 로그인을 구현하기 전에, [카카오 개발자(Kakao Developers)](https://developers.kakao.com) 사이트에서 애플리케이션을 등록하고 필요한 설정을 완료해야 합니다.

1.  **애플리케이션 생성**: "내 애플리케이션" > "애플리케이션 추가하기"를 통해 새 앱을 생성합니다.
2.  **앱 키 확인**: 생성된 앱의 "앱 설정" > "요약"에서 **REST API 키**를 확인합니다. 이 키는 클라이언트 ID(Client ID)로 사용됩니다.
3.  **플랫폼 설정**: "앱 설정" > "플랫폼"에서 로그인을 사용할 웹사이트의 도메인을 등록합니다. (예: `http://localhost:3000`)
4.  **카카오 로그인 활성화**: "제품 설정" > "카카오 로그인" 메뉴를 활성화합니다.
5.  **Redirect URI 등록**: "카카오 로그인" > "Redirect URI"에 카카오로부터 인증 코드를 받을 백엔드 API 엔드포인트 주소를 등록합니다. (예: `http://localhost:8080/api/auth/kakao/callback`)
6.  **동의 항목 설정**: "카카오 로그인" > "동의 항목"에서 사용자로부터 수집할 개인정보 항목을 설정합니다. 닉네임, 프로필 사진, 이메일 등 필요한 항목을 선택하고, "필수 동의" 또는 "선택 동의" 여부를 비즈니스 요구사항에 맞게 결정합니다.

| 설정 항목 | 설명 | 예시 |
| :--- | :--- | :--- |
| **REST API 키** | 카카오 API 호출 시 앱을 식별하는 ID | `a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4` |
| **Redirect URI** | 인증 성공 후 카카오가 사용자를 리다이렉트시킬 주소 | `https://your-service.com/auth/kakao` |
| **동의 항목** | 사용자에게 요청할 정보의 범위(Scope) | 프로필 정보, 카카오계정(이메일) |

## 3. 카카오 OAuth 2.0 인증 흐름 (Authorization Code Grant)

카카오 로그인은 표준 OAuth 2.0의 '인증 코드 부여' 방식을 따릅니다. 전체 흐름은 다음과 같습니다.

![OAuth 2.0 Flow](https://i.imgur.com/gH6b2o4.png)

1.  **(사용자 → 프론트엔드)**: 사용자가 웹사이트의 "카카오로 로그인" 버튼을 클릭합니다.
2.  **(프론트엔드 → 카카오)**: 프론트엔드는 사용자를 카카오 인증 서버로 리다이렉트시킵니다. 이때 REST API 키, Redirect URI, 요청할 동의 항목(Scope)을 쿼리 파라미터로 함께 전달합니다.
3.  **(사용자 ↔ 카카오)**: 사용자는 카카오 계정으로 로그인하고, 애플리케이션이 요청한 정보 제공에 동의합니다.
4.  **(카카오 → 백엔드)**: 인증이 완료되면, 카카오는 사용자를 사전에 등록된 **Redirect URI**로 리다이렉트시킵니다. 이때 일회성 **인증 코드(Authorization Code)**를 쿼리 파라미터로 전달합니다.
5.  **(백엔드 → 카카오)**: 백엔드 서버는 전달받은 인증 코드를 사용하여 카카오 토큰 발급 API에 **액세스 토큰(Access Token)**을 요청합니다. 이 과정에서 앱의 REST API 키와 Redirect URI를 함께 전송하여 앱을 검증합니다.
6.  **(카카오 → 백엔드)**: 카카오는 인증 코드를 검증한 후, **액세스 토큰**과 **리프레시 토큰(Refresh Token)**을 백엔드 서버에 반환합니다.
7.  **(백엔드 → 카카오)**: 백엔드는 발급받은 액세스 토큰을 사용하여 카카오 사용자 정보 조회 API를 호출합니다.
8.  **(카카오 → 백엔드)**: 카카오는 토큰을 검증하고 해당 사용자의 정보(닉네임, 이메일 등)를 반환합니다.
9.  **(백엔드)**: 백엔드는 사용자 정보를 기반으로 자체 서비스의 회원 가입 또는 로그인 처리를 수행하고, 서비스 전용 JWT 토큰 등을 생성합니다.
10. **(백엔드 → 프론트엔드)**: 백엔드는 로그인 처리가 완료되었음을 알리고, 서비스 토큰을 프론트엔드에 전달합니다.

## 4. 구현 예시 (Node.js Express 기준)

### 프론트엔드

프론트엔드는 단순히 카카오 인증 페이지로 사용자를 안내하는 링크를 제공합니다.

```html
<a href="https://kauth.kakao.com/oauth/authorize?client_id=${REST_API_KEY}&redirect_uri=${REDIRECT_URI}&response_type=code">
  <img src="/path/to/kakao_login_button.png" alt="카카오로 로그인" />
</a>
```

- `REST_API_KEY`: 내 애플리케이션의 REST API 키
- `REDIRECT_URI`: 내 애플리케이션에 등록된 Redirect URI

### 백엔드

백엔드는 Redirect URI에서 인증 코드를 받아 토큰 발급 및 사용자 정보 조회를 처리합니다.

```javascript
// /api/auth/kakao/callback (Redirect URI에 등록된 주소)

const express = require("express");
const axios = require("axios");
const router = express.Router();

router.get("/kakao/callback", async (req, res) => {
  const code = req.query.code; // 카카오로부터 받은 인증 코드

  try {
    // 1. 인증 코드로 액세스 토큰 요청
    const tokenResponse = await axios.post(
      "https://kauth.kakao.com/oauth/token",
      null,
      {
        params: {
          grant_type: "authorization_code",
          client_id: process.env.KAKAO_REST_API_KEY,
          redirect_uri: process.env.KAKAO_REDIRECT_URI,
          code: code,
        },
        headers: {
          "Content-type": "application/x-www-form-urlencoded;charset=utf-8",
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // 2. 액세스 토큰으로 사용자 정보 요청
    const userResponse = await axios.get("https://kapi.kakao.com/v2/user/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-type": "application/x-www-form-urlencoded;charset=utf-8",
      },
    });

    const userData = userResponse.data;
    const userEmail = userData.kakao_account.email;
    const userNickname = userData.properties.nickname;

    // 3. 서비스 로그인/회원가입 처리
    // (DB에서 userEmail로 사용자 조회 후, 없으면 생성, 있으면 로그인 처리)
    // ...

    // 4. 서비스 전용 토큰 발급 및 응답
    // const serviceToken = generateServiceToken(userData);
    // res.json({ token: serviceToken });

    res.status(200).json({ 
        message: "로그인 성공", 
        email: userEmail, 
        nickname: userNickname 
    });

  } catch (error) {
    console.error("카카오 로그인 처리 중 오류 발생:", error);
    res.status(500).send("로그인 처리 중 오류가 발생했습니다.");
  }
});

module.exports = router;
```

## 5. 테스트 방법

### 5.1. 수동 E2E(End-to-End) 테스트

가장 기본적이고 필수적인 테스트 방법입니다.

1.  프론트엔드와 백엔드 서버를 실행합니다.
2.  브라우저에서 프론트엔드 페이지에 접속합니다.
3.  "카카오로 로그인" 버튼을 클릭합니다.
4.  카카오 로그인 페이지로 정상적으로 리다이렉트되는지 확인합니다.
5.  실제 카카오 계정으로 로그인하고 동의 항목에 동의합니다.
6.  백엔드의 Redirect URI로 정상적으로 리다이렉트되고, 백엔드 서버 로그에 사용자 정보가 출력되는지 확인합니다.
7.  최종적으로 프론트엔드에서 로그인 성공 처리가 완료되는지 확인합니다.

### 5.2. API 클라이언트를 이용한 백엔드 단위 테스트 (Postman, Insomnia)

백엔드의 콜백 로직만 독립적으로 테스트할 수 있습니다.

1.  **인증 코드 수동 발급**: 브라우저 주소창에 아래 URL을 직접 입력하여 테스트용 인증 코드를 발급받습니다.
    ```
    https://kauth.kakao.com/oauth/authorize?client_id={REST_API_KEY}&redirect_uri={REDIRECT_URI}&response_type=code
    ```
    로그인 후 리다이렉트된 URL의 `code=` 뒷부분이 인증 코드입니다. 이 코드는 일회성이며 유효 시간이 짧습니다.

2.  **Postman으로 토큰 발급 요청**: Postman과 같은 API 클라이언트에서 `https://kauth.kakao.com/oauth/token` 엔드포인트로 `POST` 요청을 보냅니다. `Body`는 `x-www-form-urlencoded` 형식으로 아래 파라미터를 포함해야 합니다.
    - `grant_type`: `authorization_code`
    - `client_id`: {REST_API_KEY}
    - `redirect_uri`: {REDIRECT_URI}
    - `code`: {1번에서 발급받은 인증 코드}

3.  **액세스 토큰 확인**: 요청이 성공하면 응답으로 받은 `access_token`을 복사합니다.

4.  **Postman으로 사용자 정보 요청**: `https://kapi.kakao.com/v2/user/me` 엔드포인트로 `GET` 요청을 보냅니다. `Headers`에 `Authorization` 키, 값은 `Bearer {3번에서 발급받은 액세스 토큰}`으로 설정합니다. 사용자 정보가 정상적으로 반환되는지 확인합니다.

### 5.3. 자동화된 통합 테스트 (Jest, Supertest)

백엔드 API의 전체 흐름을 코드로 자동화하여 테스트합니다. 카카오 API를 직접 호출하는 대신, 해당 API 요청 및 응답을 모킹(Mocking)하여 외부 의존성을 제거하고 테스트 안정성을 높입니다.

```javascript
// __tests__/kakao.test.js

const request = require("supertest");
const express = require("express");
const axios = require("axios");
const kakaoAuthRouter = require("../routes/kakaoAuth"); // 테스트할 라우터

// axios 모킹
jest.mock("axios");

const app = express();
app.use("/api/auth", kakaoAuthRouter);

describe("Kakao Auth Callback", () => {
  it("유효한 인증 코드로 로그인에 성공해야 한다", async () => {
    // given: 카카오 API 응답 모킹
    const mockTokenResponse = { data: { access_token: "mock_access_token" } };
    const mockUserResponse = {
      data: {
        id: 123456789,
        kakao_account: { email: "test@example.com" },
        properties: { nickname: "테스트유저" },
      },
    };
    axios.post.mockResolvedValue(mockTokenResponse);
    axios.get.mockResolvedValue(mockUserResponse);

    // when: API 호출
    const response = await request(app).get("/api/auth/kakao/callback?code=mock_auth_code");

    // then: 결과 검증
    expect(response.status).toBe(200);
    expect(response.body.email).toBe("test@example.com");
    expect(response.body.nickname).toBe("테스트유저");
    expect(axios.post).toHaveBeenCalledWith(
      "https://kauth.kakao.com/oauth/token",
      expect.any(Object),
      expect.any(Object)
    );
    expect(axios.get).toHaveBeenCalledWith(
      "https://kapi.kakao.com/v2/user/me",
      expect.any(Object)
    );
  });

  it("카카오 토큰 발급 실패 시 500 에러를 반환해야 한다", async () => {
    // given: 토큰 발급 API가 에러를 반환하도록 모킹
    axios.post.mockRejectedValue(new Error("Token issuance failed"));

    // when
    const response = await request(app).get("/api/auth/kakao/callback?code=invalid_code");

    // then
    expect(response.status).toBe(500);
  });
});
```

이 문서를 통해 카카오 로그인 구현의 전체적인 그림을 이해하고, 단계별로 안정적인 개발 및 테스트를 진행하는 데 도움이 되기를 바랍니다.
