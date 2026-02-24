'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError = error.name === 'ChunkLoadError';

  useEffect(() => {
    if (isChunkError) {
      const RELOAD_KEY = 'chunk_error_reloaded';
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, '1');
        window.location.reload();
      }
    }
  }, [error, isChunkError]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FFFFFF',
            padding: '24px',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            {/* Error Icon */}
            <div
              style={{
                width: '80px',
                height: '80px',
                margin: '0 auto 24px',
                borderRadius: '16px',
                backgroundColor: '#FEF2F2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#DC2626"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h1
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#111827',
                marginBottom: '8px',
              }}
            >
              서비스에 문제가 발생했습니다
            </h1>
            <p
              style={{
                fontSize: '14px',
                color: '#6B7280',
                marginBottom: '32px',
                lineHeight: 1.6,
              }}
            >
              예기치 않은 오류가 발생했습니다.
              <br />
              잠시 후 다시 시도해 주세요.
            </p>

            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <button
                onClick={() => {
                  if (isChunkError) {
                    sessionStorage.removeItem('chunk_error_reloaded');
                    window.location.reload();
                  } else {
                    reset();
                  }
                }}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#111827',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                다시 시도
              </button>
              <a
                href="/"
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#F3F4F6',
                  color: '#374151',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                홈으로 가기
              </a>
            </div>

            {error.digest && (
              <p
                style={{
                  marginTop: '24px',
                  fontSize: '12px',
                  color: '#9CA3AF',
                }}
              >
                오류 코드: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
