import { useEffect, useState } from 'react';

export type InAppBrowserName = 'Instagram' | 'Facebook' | 'LINE' | 'Twitter' | 'KakaoTalk' | null;

export interface InAppBrowserResult {
  isInAppBrowser: boolean;
  browserName: InAppBrowserName;
}

/**
 * Detect known in-app browsers from the user agent string.
 * Returns the browser name, or null if running in a standard browser.
 */
export function detectInAppBrowserName(userAgent: string): InAppBrowserName {
  if (/kakaotalk/i.test(userAgent)) return 'KakaoTalk';
  if (/Instagram/i.test(userAgent)) return 'Instagram';
  if (/FBAN|FBAV/i.test(userAgent)) return 'Facebook';
  if (/\bLine\//i.test(userAgent)) return 'LINE';
  if (/Twitter/i.test(userAgent)) return 'Twitter';
  return null;
}

/**
 * Returns true if the user agent matches any known in-app browser.
 */
export function isInAppBrowser(userAgent: string): boolean {
  return detectInAppBrowserName(userAgent) !== null;
}

/**
 * React hook that detects whether the current browser is a known in-app browser.
 * Safe to call during SSR — returns false until the client has hydrated.
 */
export function useInAppBrowser(): InAppBrowserResult {
  const [result, setResult] = useState<InAppBrowserResult>({
    isInAppBrowser: false,
    browserName: null,
  });

  useEffect(() => {
    const browserName = detectInAppBrowserName(navigator.userAgent);
    setResult({
      isInAppBrowser: browserName !== null,
      browserName,
    });
  }, []);

  return result;
}
