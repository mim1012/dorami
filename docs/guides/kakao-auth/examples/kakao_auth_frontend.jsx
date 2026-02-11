/**
 * 카카오 OAuth 2.0 프론트엔드 구현 예제 (React)
 * 
 * 이 파일은 React 기반의 카카오 로그인 버튼 및 로그인 상태 관리 로직을 구현합니다.
 */

import React, { useState, useEffect } from "react";
import axios from "axios";

/**
 * 카카오 로그인 버튼 컴포넌트
 */
export function KakaoLoginButton() {
  const KAKAO_REST_API_KEY = process.env.REACT_APP_KAKAO_REST_API_KEY;
  const KAKAO_REDIRECT_URI = process.env.REACT_APP_KAKAO_REDIRECT_URI;

  const handleKakaoLogin = () => {
    // 카카오 인증 페이지로 리다이렉트
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}&redirect_uri=${KAKAO_REDIRECT_URI}&response_type=code`;
    window.location.href = kakaoAuthUrl;
  };

  return (
    <button
      onClick={handleKakaoLogin}
      style={{
        padding: "10px 20px",
        backgroundColor: "#FFE812",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        fontWeight: "bold",
        fontSize: "16px",
      }}
    >
      카카오로 로그인
    </button>
  );
}

/**
 * 카카오 로그인 콜백 페이지 컴포넌트
 * 이 페이지는 KAKAO_REDIRECT_URI로 등록된 주소에서 렌더링됩니다.
 * 예: http://localhost:3000/auth/kakao/callback
 */
export function KakaoLoginCallback() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // URL에서 인증 코드 추출
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const errorCode = params.get("error");
        const errorDescription = params.get("error_description");

        // 사용자가 로그인을 거부한 경우
        if (errorCode) {
          throw new Error(
            `카카오 로그인 거부: ${errorCode} - ${errorDescription}`
          );
        }

        if (!code) {
          throw new Error("인증 코드가 전달되지 않았습니다.");
        }

        // 백엔드 콜백 엔드포인트로 인증 코드 전달
        console.log("백엔드 콜백 엔드포인트 호출 중...");
        const response = await axios.get(
          `${process.env.REACT_APP_API_BASE_URL}/api/auth/kakao/callback`,
          {
            params: { code },
          }
        );

        console.log("로그인 성공:", response.data);
        setUser(response.data.user);

        // 토큰을 로컬 스토리지에 저장
        localStorage.setItem("authToken", response.data.token);

        // 로그인 성공 후 대시보드로 리다이렉트 (선택사항)
        // setTimeout(() => {
        //   window.location.href = "/dashboard";
        // }, 1500);
      } catch (err) {
        console.error("카카오 로그인 처리 중 오류:", err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    handleCallback();
  }, []);

  if (loading) {
    return <div style={{ padding: "20px" }}>로그인 처리 중입니다...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "20px", color: "red" }}>
        <h2>로그인 실패</h2>
        <p>{error}</p>
        <a href="/">홈으로 돌아가기</a>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>로그인 성공!</h2>
      <p>환영합니다, {user?.nickname}님!</p>
      <p>이메일: {user?.email}</p>
      {user?.profileImage && (
        <img
          src={user.profileImage}
          alt="프로필"
          style={{ width: "100px", height: "100px", borderRadius: "50%" }}
        />
      )}
    </div>
  );
}

/**
 * 로그인 상태 관리 Hook
 * 로컬 스토리지에서 토큰을 읽어 로그인 상태를 관리합니다.
 */
export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("authToken");
    if (savedToken) {
      setToken(savedToken);
      setIsLoggedIn(true);
    }
  }, []);

  const logout = () => {
    localStorage.removeItem("authToken");
    setToken(null);
    setIsLoggedIn(false);
  };

  return { isLoggedIn, token, logout };
}

/**
 * 로그아웃 버튼 컴포넌트
 */
export function LogoutButton({ onLogout }) {
  const handleLogout = async () => {
    const token = localStorage.getItem("authToken");

    try {
      // 백엔드 로그아웃 엔드포인트 호출 (선택사항)
      await axios.post(
        `${process.env.REACT_APP_API_BASE_URL}/api/auth/kakao/logout`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch (error) {
      console.error("로그아웃 처리 중 오류:", error.message);
    }

    // 로컬 상태 초기화
    onLogout();
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        padding: "10px 20px",
        backgroundColor: "#FF6B6B",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        fontWeight: "bold",
        fontSize: "16px",
      }}
    >
      로그아웃
    </button>
  );
}

/**
 * 메인 로그인 페이지 컴포넌트
 */
export function LoginPage() {
  const { isLoggedIn, logout } = useAuth();

  if (isLoggedIn) {
    return (
      <div style={{ padding: "20px" }}>
        <h1>로그인되었습니다</h1>
        <LogoutButton onLogout={logout} />
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>로그인</h1>
      <KakaoLoginButton />
    </div>
  );
}

export default LoginPage;
