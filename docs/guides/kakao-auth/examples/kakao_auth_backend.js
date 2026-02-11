/**
 * 카카오 OAuth 2.0 백엔드 구현 예제
 * 
 * 이 파일은 Express.js 기반의 카카오 로그인 콜백 처리 로직을 구현합니다.
 * 
 * 필수 환경 변수:
 * - KAKAO_REST_API_KEY: 카카오 개발자 콘솔의 REST API 키
 * - KAKAO_REDIRECT_URI: 카카오 개발자 콘솔에 등록된 Redirect URI
 * - JWT_SECRET: JWT 토큰 생성 시 사용할 비밀 키
 */

const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const router = express.Router();

// 환경 변수 검증
if (!process.env.KAKAO_REST_API_KEY || !process.env.KAKAO_REDIRECT_URI) {
  console.error(
    "필수 환경 변수가 설정되지 않았습니다: KAKAO_REST_API_KEY, KAKAO_REDIRECT_URI"
  );
}

/**
 * 카카오 인증 코드로 액세스 토큰 발급
 * @param {string} code - 카카오로부터 받은 인증 코드
 * @returns {Promise<string>} 액세스 토큰
 */
async function getKakaoAccessToken(code) {
  try {
    const response = await axios.post(
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
    return response.data.access_token;
  } catch (error) {
    console.error("카카오 토큰 발급 실패:", error.response?.data || error.message);
    throw new Error("카카오 토큰 발급 실패");
  }
}

/**
 * 액세스 토큰으로 카카오 사용자 정보 조회
 * @param {string} accessToken - 카카오 액세스 토큰
 * @returns {Promise<Object>} 사용자 정보 객체
 */
async function getKakaoUserInfo(accessToken) {
  try {
    const response = await axios.get("https://kapi.kakao.com/v2/user/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-type": "application/x-www-form-urlencoded;charset=utf-8",
      },
    });
    return response.data;
  } catch (error) {
    console.error(
      "카카오 사용자 정보 조회 실패:",
      error.response?.data || error.message
    );
    throw new Error("카카오 사용자 정보 조회 실패");
  }
}

/**
 * 서비스 전용 JWT 토큰 생성
 * @param {Object} userData - 사용자 정보
 * @returns {string} JWT 토큰
 */
function generateServiceToken(userData) {
  const payload = {
    kakaoId: userData.id,
    email: userData.kakao_account?.email,
    nickname: userData.properties?.nickname,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
  return token;
}

/**
 * 카카오 로그인 콜백 엔드포인트
 * GET /api/auth/kakao/callback?code={인증코드}
 */
router.get("/kakao/callback", async (req, res) => {
  const code = req.query.code;
  const error = req.query.error;
  const errorDescription = req.query.error_description;

  // 사용자가 로그인을 거부한 경우
  if (error) {
    console.warn(`카카오 로그인 거부: ${error} - ${errorDescription}`);
    return res.status(400).json({
      success: false,
      message: "사용자가 로그인을 거부했습니다.",
      error: error,
    });
  }

  // 인증 코드가 없는 경우
  if (!code) {
    console.error("인증 코드가 전달되지 않았습니다.");
    return res.status(400).json({
      success: false,
      message: "인증 코드가 전달되지 않았습니다.",
    });
  }

  try {
    // 1단계: 인증 코드로 액세스 토큰 발급
    console.log("1단계: 카카오 액세스 토큰 발급 중...");
    const accessToken = await getKakaoAccessToken(code);
    console.log("✓ 액세스 토큰 발급 성공");

    // 2단계: 액세스 토큰으로 사용자 정보 조회
    console.log("2단계: 카카오 사용자 정보 조회 중...");
    const kakaoUserData = await getKakaoUserInfo(accessToken);
    console.log("✓ 사용자 정보 조회 성공:", {
      kakaoId: kakaoUserData.id,
      email: kakaoUserData.kakao_account?.email,
      nickname: kakaoUserData.properties?.nickname,
    });

    // 3단계: 서비스 로그인/회원가입 처리 (DB 연동)
    // TODO: 실제 구현에서는 여기서 DB에 사용자 정보를 저장하거나 조회합니다.
    // const user = await User.findOrCreate({
    //   kakaoId: kakaoUserData.id,
    //   email: kakaoUserData.kakao_account?.email,
    //   nickname: kakaoUserData.properties?.nickname,
    // });

    // 4단계: 서비스 전용 JWT 토큰 생성
    console.log("3단계: 서비스 JWT 토큰 생성 중...");
    const serviceToken = generateServiceToken(kakaoUserData);
    console.log("✓ JWT 토큰 생성 성공");

    // 5단계: 응답 반환
    res.status(200).json({
      success: true,
      message: "카카오 로그인 성공",
      token: serviceToken,
      user: {
        kakaoId: kakaoUserData.id,
        email: kakaoUserData.kakao_account?.email,
        nickname: kakaoUserData.properties?.nickname,
        profileImage: kakaoUserData.properties?.profile_image,
      },
    });
  } catch (error) {
    console.error("카카오 로그인 처리 중 오류 발생:", error.message);
    res.status(500).json({
      success: false,
      message: "로그인 처리 중 오류가 발생했습니다.",
      error: error.message,
    });
  }
});

/**
 * 카카오 로그인 페이지로 리다이렉트하는 엔드포인트 (선택사항)
 * GET /api/auth/kakao
 */
router.get("/kakao", (req, res) => {
  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${process.env.KAKAO_REST_API_KEY}&redirect_uri=${process.env.KAKAO_REDIRECT_URI}&response_type=code`;
  res.redirect(kakaoAuthUrl);
});

/**
 * 카카오 로그아웃 엔드포인트 (선택사항)
 * POST /api/auth/kakao/logout
 */
router.post("/kakao/logout", async (req, res) => {
  const accessToken = req.headers.authorization?.split(" ")[1];

  if (!accessToken) {
    return res.status(400).json({
      success: false,
      message: "액세스 토큰이 전달되지 않았습니다.",
    });
  }

  try {
    await axios.post(
      "https://kapi.kakao.com/v2/user/logout",
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    res.status(200).json({
      success: true,
      message: "카카오 로그아웃 성공",
    });
  } catch (error) {
    console.error("카카오 로그아웃 실패:", error.message);
    res.status(500).json({
      success: false,
      message: "로그아웃 처리 중 오류가 발생했습니다.",
    });
  }
});

module.exports = router;
