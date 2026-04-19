'use client';

import { useEffect } from 'react';
import { detectInAppBrowserName } from '@/lib/hooks/use-in-app-browser';

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

function handleKakaoRedirect(url: URL): void {
  const shouldHandle = hasOpenExternalRequest(url.searchParams) || detectAndroid();
  if (!shouldHandle) return;

  const marker = `kakao-inapp-redirected:${url.pathname}`;
  if (sessionStorage.getItem(marker) === '1') return;
  sessionStorage.setItem(marker, '1');

  const cleanUrl = new URL(url.toString());
  cleanUrl.searchParams.delete('openExternal');

  if (detectAndroid()) {
    const intentUrl = buildIntentUrl(cleanUrl.toString());
    setTimeout(() => {
      window.location.href = intentUrl;
    }, 100);
    return;
  }

  if (detectIOS()) {
    window.history.replaceState({}, '', cleanUrl.toString());
    setTimeout(() => {
      window.open(cleanUrl.toString(), '_blank');
    }, 100);
  }
}

function handleInstagramIosRedirect(url: URL): void {
  // iOS Instagram doesn't support intent URLs — redirect to interstitial page
  if (url.pathname === '/open-in-browser' || url.searchParams.get('openExternal') === '1') return;

  const marker = `instagram-inapp-redirected:${url.pathname}`;
  if (sessionStorage.getItem(marker) === '1') return;
  sessionStorage.setItem(marker, '1');

  const openInBrowserUrl = new URL('/open-in-browser', url.origin);
  openInBrowserUrl.searchParams.set('url', url.toString());
  window.location.href = openInBrowserUrl.toString();
}

export function InAppBrowserGuard() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return;

    const browserName = detectInAppBrowserName(navigator.userAgent);
    if (!browserName) return;

    if (typeof sessionStorage === 'undefined') return;

    const url = new URL(window.location.href);
    if (url.pathname === '/open-in-browser' || url.searchParams.get('openExternal') === '1') {
      return;
    }

    if (browserName === 'KakaoTalk') {
      handleKakaoRedirect(url);
      return;
    }

    // Instagram / Facebook / LINE / Twitter
    if (detectAndroid()) {
      const marker = `inapp-redirected:${url.pathname}`;
      if (sessionStorage.getItem(marker) === '1') return;
      sessionStorage.setItem(marker, '1');

      const intentUrl = buildIntentUrl(url.toString());
      setTimeout(() => {
        window.location.href = intentUrl;
      }, 100);
      return;
    }

    if (detectIOS()) {
      handleInstagramIosRedirect(url);
    }
  }, []);

  return null;
}

// Keep named export for backwards compatibility
export { InAppBrowserGuard as KakaoInAppBrowserGuard };
