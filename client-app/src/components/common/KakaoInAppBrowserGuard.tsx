'use client';

import { useEffect } from 'react';

function detectKakaoInApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /kakaotalk/i.test(navigator.userAgent);
}

function detectAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

function detectIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function hasOpenExternalRequest(searchParams: URLSearchParams): boolean {
  return searchParams.get('openExternal') === '1';
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

    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;

    const url = new URL(window.location.href);
    const shouldHandle = hasOpenExternalRequest(url.searchParams) || detectAndroid();

    if (!shouldHandle) return;

    const marker = `kakao-inapp-redirected:${url.pathname}`;
    if (sessionStorage.getItem(marker) === '1') return;
    sessionStorage.setItem(marker, '1');

    url.searchParams.delete('openExternal');

    if (detectAndroid()) {
      const currentUrl = url.toString();
      const intentUrl = buildIntentUrl(currentUrl);
      setTimeout(() => {
        window.location.href = intentUrl;
      }, 100);
      return;
    }

    if (detectIOS()) {
      window.history.replaceState({}, '', url.toString());
      setTimeout(() => {
        window.open(url.toString(), '_blank');
      }, 100);
    }
  }, []);

  // 자동으로 외부 브라우저에서 열기 (UI 없음)
  return null;
}
