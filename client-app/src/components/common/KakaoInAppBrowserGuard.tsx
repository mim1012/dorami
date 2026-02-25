'use client';

import { useEffect, useState } from 'react';

function detectKakaoInApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.userAgent.toLowerCase().includes('kakaotalk');
}

function detectAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

function buildIntentUrl(url: string): string {
  return (
    'intent://' +
    url.replace(/^https?:\/\//, '') +
    '#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end'
  );
}

export function KakaoInAppBrowserGuard() {
  const [show, setShow] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!detectKakaoInApp()) return;
    setIsAndroid(detectAndroid());
    setShow(true);
  }, []);

  if (!show) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const intentUrl = buildIntentUrl(currentUrl);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
    } catch {
      const input = document.createElement('input');
      input.value = currentUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.88)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      <div
        style={{
          background: '#141414',
          borderRadius: '20px 20px 0 0',
          padding: '20px 24px calc(36px + env(safe-area-inset-bottom, 0px))',
          width: '100%',
          maxWidth: '480px',
          textAlign: 'center',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
        }}
      >
        {/* 핸들 */}
        <div
          style={{
            width: '36px',
            height: '4px',
            background: '#333',
            borderRadius: '2px',
            margin: '0 auto 20px',
          }}
        />

        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🌐</div>

        <h2
          style={{
            color: '#ffffff',
            fontSize: '17px',
            fontWeight: 700,
            marginBottom: '8px',
          }}
        >
          외부 브라우저에서 열어주세요
        </h2>

        <p
          style={{
            color: '#888',
            fontSize: '13px',
            lineHeight: 1.6,
            marginBottom: '20px',
          }}
        >
          카카오톡 인앱 브라우저에서는 라이브 스트리밍 및<br />
          일부 기능이 정상 동작하지 않습니다.
        </p>

        {/* 메인 버튼: Android는 intent 링크, iOS는 수동 안내 강조 */}
        {isAndroid ? (
          <a
            href={intentUrl}
            style={{
              display: 'block',
              width: '100%',
              padding: '15px',
              borderRadius: '12px',
              background: '#FF1493',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 700,
              textDecoration: 'none',
              marginBottom: '12px',
              boxSizing: 'border-box',
            }}
          >
            Chrome으로 열기
          </a>
        ) : (
          <div
            style={{
              background: '#1e1e1e',
              borderRadius: '14px',
              padding: '16px',
              textAlign: 'left',
              marginBottom: '12px',
            }}
          >
            <p
              style={{
                color: '#FF1493',
                fontSize: '11px',
                fontWeight: 700,
                marginBottom: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              iPhone 안내
            </p>
            <ol
              style={{
                color: '#ccc',
                fontSize: '14px',
                lineHeight: 2.2,
                paddingLeft: '20px',
                margin: 0,
              }}
            >
              <li>
                우측 하단 <strong style={{ color: '#fff', fontWeight: 700 }}>···</strong> 버튼 탭
              </li>
              <li>
                <strong style={{ color: '#fff', fontWeight: 700 }}>기본 브라우저로 열기</strong>{' '}
                선택
              </li>
            </ol>
          </div>
        )}

        {/* Android 수동 안내 (접기 가능하도록 하단에 작게) */}
        {isAndroid && (
          <p style={{ color: '#555', fontSize: '12px', marginBottom: '12px', lineHeight: 1.6 }}>
            버튼이 작동하지 않으면: 우측 상단 ⋮ → 다른 앱으로 열기
          </p>
        )}

        {/* 링크 복사 */}
        <button
          onClick={handleCopy}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: '12px',
            border: copied ? '1px solid #4CAF50' : '1px solid #2a2a2a',
            background: copied ? 'rgba(76,175,80,0.08)' : 'transparent',
            color: copied ? '#4CAF50' : '#555',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontWeight: copied ? 600 : 400,
          }}
        >
          {copied ? '✓ 복사됨 — 브라우저 주소창에 붙여넣기 해주세요' : '링크 복사하기'}
        </button>
      </div>
    </div>
  );
}
