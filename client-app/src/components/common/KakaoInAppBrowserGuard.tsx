'use client';

import { useEffect, useState } from 'react';

function detectKakaoInApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.userAgent.toLowerCase().includes('kakaotalk');
}

function detectAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

export function KakaoInAppBrowserGuard() {
  const [showGuide, setShowGuide] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    if (!detectKakaoInApp()) return;

    const android = detectAndroid();
    setIsAndroid(android);

    if (android) {
      // Android: intent scheme으로 Chrome 실행 시도
      const currentUrl = window.location.href;
      const intentUrl =
        'intent://' +
        currentUrl.replace(/^https?:\/\//, '') +
        '#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end';
      window.location.href = intentUrl;
      // intent 처리 실패 시 안내 모달 표시
      setTimeout(() => setShowGuide(true), 1000);
    } else {
      // iOS: 강제 redirect 불가 → 안내 모달
      setShowGuide(true);
    }
  }, []);

  if (!showGuide) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 0 env(safe-area-inset-bottom, 0)',
      }}
    >
      <div
        style={{
          background: '#1a1a2e',
          borderRadius: '20px 20px 0 0',
          padding: '28px 24px 40px',
          width: '100%',
          maxWidth: '480px',
          textAlign: 'center',
        }}
      >
        {/* 아이콘 */}
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🌐</div>

        <h2
          style={{
            color: '#ffffff',
            fontSize: '18px',
            fontWeight: 700,
            marginBottom: '10px',
          }}
        >
          외부 브라우저에서 열어주세요
        </h2>

        <p
          style={{
            color: '#aaaaaa',
            fontSize: '14px',
            lineHeight: 1.6,
            marginBottom: '24px',
          }}
        >
          {isAndroid ? (
            <>
              Chrome이 설치되어 있지 않은 경우
              <br />
              아래 방법으로 외부 브라우저에서 열어주세요.
            </>
          ) : (
            <>
              카카오톡 인앱 브라우저에서는 일부 기능이
              <br />
              정상 동작하지 않을 수 있습니다.
            </>
          )}
        </p>

        {/* 안내 스텝 */}
        <div
          style={{
            background: '#2a2a3e',
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'left',
            marginBottom: '20px',
          }}
        >
          {isAndroid ? (
            <ol
              style={{
                color: '#cccccc',
                fontSize: '14px',
                lineHeight: 2,
                paddingLeft: '20px',
                margin: 0,
              }}
            >
              <li>
                우측 상단 <strong style={{ color: '#fff' }}>⋮</strong> 메뉴 탭
              </li>
              <li>
                <strong style={{ color: '#fff' }}>다른 앱으로 열기</strong> 선택
              </li>
              <li>Chrome 또는 기본 브라우저 선택</li>
            </ol>
          ) : (
            <ol
              style={{
                color: '#cccccc',
                fontSize: '14px',
                lineHeight: 2,
                paddingLeft: '20px',
                margin: 0,
              }}
            >
              <li>
                우측 하단 <strong style={{ color: '#fff' }}>···</strong> 버튼 탭
              </li>
              <li>
                <strong style={{ color: '#fff' }}>기본 브라우저로 열기</strong> 선택
              </li>
            </ol>
          )}
        </div>

        {/* URL 복사 버튼 (폴백) */}
        <button
          onClick={() => {
            navigator.clipboard
              .writeText(window.location.href)
              .then(() => alert('링크가 복사되었습니다. 브라우저 주소창에 붙여넣기 해주세요.'))
              .catch(() => {});
          }}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            border: '1px solid #444',
            background: 'transparent',
            color: '#aaaaaa',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          링크 복사하기
        </button>
      </div>
    </div>
  );
}
