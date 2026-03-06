'use client';

import { useEffect } from 'react';

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
  useEffect(() => {
    if (!detectKakaoInApp()) return;

    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

    // Android: Intent URL로 자동 오픈
    if (detectAndroid()) {
      const intentUrl = buildIntentUrl(currentUrl);
      setTimeout(() => {
        window.location.href = intentUrl;
      }, 100);
    }
    // iOS: window.open()으로 외부 브라우저에서 열기 (무한 새로고침 방지)
    else {
      setTimeout(() => {
        window.open(currentUrl, '_blank');
      }, 100);
    }
  }, []);

  // 자동으로 외부 브라우저에서 열기 (UI 없음)
  return null;
}
