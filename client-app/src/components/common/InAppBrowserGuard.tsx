'use client';

import { useEffect, useState } from 'react';

type InAppType = 'kakaotalk' | 'instagram' | 'facebook' | 'line' | 'other';

function detectInAppBrowser(): InAppType | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent.toLowerCase();

  if (/kakaotalk/i.test(ua)) return 'kakaotalk';
  if (/instagram/i.test(ua)) return 'instagram';
  if (/fbav|fban|fb_iab/i.test(ua)) return 'facebook';
  if (/\bline\b/i.test(ua)) return 'line';
  // Generic in-app detection: WebView without standard browser identifiers
  if (/wv\)|\.wv\b/i.test(ua) && !/chrome|safari/i.test(ua)) return 'other';

  return null;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

function buildIntentUrl(url: string): string {
  return (
    'intent://' +
    url.replace(/^https?:\/\//, '') +
    '#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end'
  );
}

const APP_LABELS: Record<InAppType, string> = {
  kakaotalk: '카카오톡',
  instagram: 'Instagram',
  facebook: 'Facebook',
  line: 'LINE',
  other: '앱',
};

export function InAppBrowserGuard() {
  const [showBanner, setShowBanner] = useState(false);
  const [appType, setAppType] = useState<InAppType | null>(null);

  useEffect(() => {
    const detected = detectInAppBrowser();
    if (!detected) return;

    // Skip if already dismissed this session
    const dismissed = sessionStorage.getItem('inapp-banner-dismissed');
    if (dismissed === '1') return;

    // Android: try auto-redirect to Chrome
    if (isAndroid()) {
      const intentUrl = buildIntentUrl(window.location.href);
      window.location.href = intentUrl;
      return;
    }

    // iOS: show banner (can't force Safari programmatically)
    if (isIOS()) {
      setAppType(detected);
      setShowBanner(true);
    }
  }, []);

  if (!showBanner || !appType) return null;

  const appLabel = APP_LABELS[appType];

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-t-2xl bg-[#1a1a2e] p-6 text-white shadow-lg">
        <div className="mb-3 text-center text-lg font-bold">외부 브라우저에서 열어주세요</div>
        <div className="mb-4 text-center text-sm text-gray-300">
          {appLabel} 앱 내 브라우저에서는 로그인이 유지되지 않습니다.
        </div>
        <div className="mb-4 rounded-xl bg-[#252542] p-4 text-sm">
          <div className="mb-2 font-medium text-pink-400">Safari에서 여는 방법:</div>
          <div className="space-y-1 text-gray-300">
            <p>
              1. 우측 하단 <span className="font-bold text-white">⋯</span> 또는{' '}
              <span className="font-bold text-white">ᐧᐧᐧ</span> 메뉴 클릭
            </p>
            <p>
              2. <span className="font-bold text-white">&quot;Safari에서 열기&quot;</span> 선택
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              sessionStorage.setItem('inapp-banner-dismissed', '1');
              setShowBanner(false);
            }}
            className="flex-1 rounded-xl bg-[#252542] py-3 text-sm text-gray-400"
          >
            이대로 계속하기
          </button>
          <button
            onClick={() => {
              // Copy URL for manual paste
              navigator.clipboard?.writeText(window.location.href);
              alert('링크가 복사되었습니다.\nSafari를 열고 붙여넣기 해주세요.');
            }}
            className="flex-1 rounded-xl bg-pink-500 py-3 text-sm font-bold text-white"
          >
            링크 복사하기
          </button>
        </div>
      </div>
    </div>
  );
}
