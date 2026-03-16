import { useState, useEffect } from 'react';

/**
 * SSR-safe mobile breakpoint detection.
 * Starts as false to match SSR HTML, then updates after hydration.
 * Using useState+useEffect avoids the useSyncExternalStore hydration mismatch
 * that caused VideoPlayer to remount on mobile devices (SSR=false → client=true flip).
 * VideoPlayer is always behind an async API call, so isMobile is correctly set
 * before VideoPlayer ever renders.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);

  return isMobile;
}
