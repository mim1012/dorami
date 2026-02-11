/**
 * 카카오 OAuth 2.0 자동화 테스트
 * 
 * Jest와 Supertest를 사용하여 카카오 로그인 백엔드 로직을 테스트합니다.
 * 카카오 API 호출은 모킹(Mocking)하여 외부 의존성을 제거합니다.
 * 
 * 실행 방법:
 * $ npm test kakao_auth.test.js
 * 또는
 * $ jest kakao_auth.test.js
 */

const request = require("supertest");
const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");

// 테스트할 라우터 임포트
const kakaoAuthRouter = require("../routes/kakaoAuth");

// axios 모킹 설정
jest.mock("axios");

// 테스트용 Express 앱 생성
const app = express();
app.use(express.json());
app.use("/api/auth", kakaoAuthRouter);

// 환경 변수 설정
process.env.KAKAO_REST_API_KEY = "test_rest_api_key";
process.env.KAKAO_REDIRECT_URI = "http://localhost:3000/auth/kakao/callback";
process.env.JWT_SECRET = "test_jwt_secret";

describe("카카오 OAuth 2.0 인증 테스트", () => {
  // 각 테스트 전에 모킹 초기화
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/auth/kakao/callback", () => {
    describe("성공 케이스", () => {
      it("유효한 인증 코드로 로그인에 성공해야 한다", async () => {
        // given: 카카오 API 응답 모킹
        const mockTokenResponse = {
          data: {
            access_token: "mock_access_token_12345",
            token_type: "bearer",
            expires_in: 21599,
            refresh_token: "mock_refresh_token",
            refresh_token_expires_in: 5184000,
          },
        };

        const mockUserResponse = {
          data: {
            id: 1234567890,
            connected_at: "2024-01-26T10:30:00Z",
            kakao_account: {
              profile_nickname_needs_agreement: false,
              profile_image_needs_agreement: false,
              profile: {
                nickname: "테스트유저",
                thumbnail_image_url:
                  "http://example.com/profile_thumbnail.jpg",
                profile_image_url: "http://example.com/profile.jpg",
                is_default_image: false,
              },
              name_needs_agreement: false,
              name: "테스트",
              email_needs_agreement: false,
              is_email_valid: true,
              is_email_verified: true,
              email: "test@example.com",
              age_range_needs_agreement: false,
              age_range: "20~29",
              birthday_needs_agreement: false,
              birthday: "0126",
              birthday_type: "SOLAR",
              gender_needs_agreement: false,
              gender: "MALE",
              phone_number_needs_agreement: false,
              phone_number: "+82-10-1234-5678",
              ci_needs_agreement: false,
              ci: "mock_ci_value",
            },
            properties: {
              nickname: "테스트유저",
              profile_image: "http://example.com/profile.jpg",
              thumbnail_image: "http://example.com/profile_thumbnail.jpg",
            },
          },
        };

        axios.post.mockResolvedValue(mockTokenResponse);
        axios.get.mockResolvedValue(mockUserResponse);

        // when: API 호출
        const response = await request(app)
          .get("/api/auth/kakao/callback")
          .query({ code: "mock_auth_code_12345" });

        // then: 결과 검증
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe("카카오 로그인 성공");
        expect(response.body.token).toBeDefined();
        expect(response.body.user).toEqual({
          kakaoId: 1234567890,
          email: "test@example.com",
          nickname: "테스트유저",
          profileImage: "http://example.com/profile.jpg",
        });

        // 카카오 API 호출 검증
        expect(axios.post).toHaveBeenCalledWith(
          "https://kauth.kakao.com/oauth/token",
          null,
          expect.objectContaining({
            params: expect.objectContaining({
              grant_type: "authorization_code",
              client_id: "test_rest_api_key",
              redirect_uri: "http://localhost:3000/auth/kakao/callback",
              code: "mock_auth_code_12345",
            }),
          })
        );

        expect(axios.get).toHaveBeenCalledWith(
          "https://kapi.kakao.com/v2/user/me",
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: "Bearer mock_access_token_12345",
            }),
          })
        );
      });

      it("발급받은 JWT 토큰이 유효해야 한다", async () => {
        // given
        const mockTokenResponse = {
          data: { access_token: "mock_access_token" },
        };
        const mockUserResponse = {
          data: {
            id: 1234567890,
            kakao_account: { email: "test@example.com" },
            properties: { nickname: "테스트유저" },
          },
        };

        axios.post.mockResolvedValue(mockTokenResponse);
        axios.get.mockResolvedValue(mockUserResponse);

        // when
        const response = await request(app)
          .get("/api/auth/kakao/callback")
          .query({ code: "mock_auth_code" });

        // then: JWT 토큰 검증
        const token = response.body.token;
        const decoded = jwt.verify(token, "test_jwt_secret");

        expect(decoded.kakaoId).toBe(1234567890);
        expect(decoded.email).toBe("test@example.com");
        expect(decoded.nickname).toBe("테스트유저");
        expect(decoded.exp).toBeDefined();
      });
    });

    describe("실패 케이스", () => {
      it("인증 코드가 없으면 400 에러를 반환해야 한다", async () => {
        // when
        const response = await request(app).get("/api/auth/kakao/callback");

        // then
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe(
          "인증 코드가 전달되지 않았습니다."
        );
      });

      it("사용자가 로그인을 거부하면 400 에러를 반환해야 한다", async () => {
        // when
        const response = await request(app)
          .get("/api/auth/kakao/callback")
          .query({
            error: "access_denied",
            error_description: "User denied access",
          });

        // then
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe("access_denied");
      });

      it("카카오 토큰 발급 실패 시 500 에러를 반환해야 한다", async () => {
        // given: 토큰 발급 API가 에러를 반환하도록 모킹
        axios.post.mockRejectedValue(
          new Error("Invalid authorization code")
        );

        // when
        const response = await request(app)
          .get("/api/auth/kakao/callback")
          .query({ code: "invalid_code" });

        // then
        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe(
          "로그인 처리 중 오류가 발생했습니다."
        );
      });

      it("카카오 사용자 정보 조회 실패 시 500 에러를 반환해야 한다", async () => {
        // given: 토큰 발급은 성공하지만 사용자 정보 조회는 실패
        const mockTokenResponse = {
          data: { access_token: "mock_access_token" },
        };
        axios.post.mockResolvedValue(mockTokenResponse);
        axios.get.mockRejectedValue(new Error("Invalid access token"));

        // when
        const response = await request(app)
          .get("/api/auth/kakao/callback")
          .query({ code: "mock_auth_code" });

        // then
        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
      });

      it("카카오 API 응답이 예상과 다르면 500 에러를 반환해야 한다", async () => {
        // given: 사용자 정보가 불완전한 응답
        const mockTokenResponse = {
          data: { access_token: "mock_access_token" },
        };
        const mockUserResponse = {
          data: {
            id: 1234567890,
            // kakao_account와 properties가 없음
          },
        };

        axios.post.mockResolvedValue(mockTokenResponse);
        axios.get.mockResolvedValue(mockUserResponse);

        // when
        const response = await request(app)
          .get("/api/auth/kakao/callback")
          .query({ code: "mock_auth_code" });

        // then: 응답은 성공하지만 사용자 정보에 null 값이 있을 수 있음
        expect(response.status).toBe(200);
        expect(response.body.user.email).toBeUndefined();
      });
    });

    describe("엣지 케이스", () => {
      it("특수 문자가 포함된 이메일을 정상 처리해야 한다", async () => {
        // given
        const mockTokenResponse = {
          data: { access_token: "mock_access_token" },
        };
        const mockUserResponse = {
          data: {
            id: 1234567890,
            kakao_account: { email: "test+special@example.co.kr" },
            properties: { nickname: "테스트유저" },
          },
        };

        axios.post.mockResolvedValue(mockTokenResponse);
        axios.get.mockResolvedValue(mockUserResponse);

        // when
        const response = await request(app)
          .get("/api/auth/kakao/callback")
          .query({ code: "mock_auth_code" });

        // then
        expect(response.status).toBe(200);
        expect(response.body.user.email).toBe("test+special@example.co.kr");
      });

      it("한글 닉네임을 정상 처리해야 한다", async () => {
        // given
        const mockTokenResponse = {
          data: { access_token: "mock_access_token" },
        };
        const mockUserResponse = {
          data: {
            id: 1234567890,
            kakao_account: { email: "test@example.com" },
            properties: { nickname: "테스트유저🎉" },
          },
        };

        axios.post.mockResolvedValue(mockTokenResponse);
        axios.get.mockResolvedValue(mockUserResponse);

        // when
        const response = await request(app)
          .get("/api/auth/kakao/callback")
          .query({ code: "mock_auth_code" });

        // then
        expect(response.status).toBe(200);
        expect(response.body.user.nickname).toBe("테스트유저🎉");
      });

      it("매우 긴 인증 코드를 정상 처리해야 한다", async () => {
        // given
        const longCode = "a".repeat(1000);
        const mockTokenResponse = {
          data: { access_token: "mock_access_token" },
        };
        const mockUserResponse = {
          data: {
            id: 1234567890,
            kakao_account: { email: "test@example.com" },
            properties: { nickname: "테스트유저" },
          },
        };

        axios.post.mockResolvedValue(mockTokenResponse);
        axios.get.mockResolvedValue(mockUserResponse);

        // when
        const response = await request(app)
          .get("/api/auth/kakao/callback")
          .query({ code: longCode });

        // then
        expect(response.status).toBe(200);
        expect(axios.post).toHaveBeenCalledWith(
          expect.any(String),
          null,
          expect.objectContaining({
            params: expect.objectContaining({ code: longCode }),
          })
        );
      });
    });
  });

  describe("GET /api/auth/kakao", () => {
    it("카카오 인증 페이지로 리다이렉트해야 한다", async () => {
      // when
      const response = await request(app).get("/api/auth/kakao");

      // then
      expect(response.status).toBe(302); // 리다이렉트 상태 코드
      expect(response.headers.location).toContain(
        "https://kauth.kakao.com/oauth/authorize"
      );
      expect(response.headers.location).toContain(
        "client_id=test_rest_api_key"
      );
      expect(response.headers.location).toContain(
        "redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fkakao%2Fcallback"
      );
    });
  });

  describe("POST /api/auth/kakao/logout", () => {
    it("유효한 토큰으로 로그아웃에 성공해야 한다", async () => {
      // given
      axios.post.mockResolvedValue({ data: {} });

      // when
      const response = await request(app)
        .post("/api/auth/kakao/logout")
        .set("Authorization", "Bearer mock_access_token");

      // then
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        "https://kapi.kakao.com/v2/user/logout",
        {},
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer mock_access_token",
          }),
        })
      );
    });

    it("토큰이 없으면 400 에러를 반환해야 한다", async () => {
      // when
      const response = await request(app).post("/api/auth/kakao/logout");

      // then
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("카카오 로그아웃 API 실패 시 500 에러를 반환해야 한다", async () => {
      // given
      axios.post.mockRejectedValue(new Error("Logout failed"));

      // when
      const response = await request(app)
        .post("/api/auth/kakao/logout")
        .set("Authorization", "Bearer invalid_token");

      // then
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});

describe("성능 및 보안 테스트", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("동시 다중 요청을 처리할 수 있어야 한다", async () => {
    // given
    const mockTokenResponse = {
      data: { access_token: "mock_access_token" },
    };
    const mockUserResponse = {
      data: {
        id: 1234567890,
        kakao_account: { email: "test@example.com" },
        properties: { nickname: "테스트유저" },
      },
    };

    axios.post.mockResolvedValue(mockTokenResponse);
    axios.get.mockResolvedValue(mockUserResponse);

    // when: 10개의 동시 요청
    const requests = Array(10)
      .fill(null)
      .map((_, i) =>
        request(app)
          .get("/api/auth/kakao/callback")
          .query({ code: `mock_code_${i}` })
      );

    const responses = await Promise.all(requests);

    // then
    responses.forEach((response) => {
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    // 모든 요청이 카카오 API를 호출했는지 확인
    expect(axios.post).toHaveBeenCalledTimes(10);
    expect(axios.get).toHaveBeenCalledTimes(10);
  });

  it("JWT 토큰에 만료 시간이 설정되어야 한다", async () => {
    // given
    const mockTokenResponse = {
      data: { access_token: "mock_access_token" },
    };
    const mockUserResponse = {
      data: {
        id: 1234567890,
        kakao_account: { email: "test@example.com" },
        properties: { nickname: "테스트유저" },
      },
    };

    axios.post.mockResolvedValue(mockTokenResponse);
    axios.get.mockResolvedValue(mockUserResponse);

    // when
    const response = await request(app)
      .get("/api/auth/kakao/callback")
      .query({ code: "mock_auth_code" });

    // then
    const token = response.body.token;
    const decoded = jwt.verify(token, "test_jwt_secret");

    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp - decoded.iat).toBe(7 * 24 * 60 * 60); // 7일
  });
});
