'use client';

import { useEffect } from 'react';

export default function OrderCompleteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError = error.name === 'ChunkLoadError';

  useEffect(() => {
    console.error('[Order Complete Error Boundary]', error);

    if (isChunkError) {
      const RELOAD_KEY = 'chunk_error_reloaded';
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, '1');
        window.location.reload();
      }
    }
  }, [error, isChunkError]);

  return (
    <div className="min-h-screen bg-primary-black flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-error-bg flex items-center justify-center">
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

        <h2 className="text-2xl font-bold text-primary-text mb-2">주문 완료 오류</h2>
        <p className="text-secondary-text mb-8 text-sm leading-relaxed">
          주문 정보를 불러오는 중 오류가 발생했습니다. 주문 내역 페이지에서 확인해 주세요.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => {
              if (isChunkError) {
                sessionStorage.removeItem('chunk_error_reloaded');
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="px-6 py-3 bg-hot-pink text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-colors active:scale-[0.98]"
          >
            다시 시도
          </button>
          <a
            href="/orders"
            className="px-6 py-3 bg-content-bg text-primary-text rounded-lg text-sm font-semibold hover:bg-border-color transition-colors active:scale-[0.98]"
          >
            주문 내역
          </a>
        </div>

        {error.digest && (
          <p className="mt-6 text-xs text-secondary-text">오류 코드: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
