import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
}

/**
 * SSR-safe mobile breakpoint detection using useSyncExternalStore.
 * Server snapshot returns false to match initial SSR HTML.
 * Client snapshot reads window.innerWidth after hydration.
 */
export function useIsMobile(breakpoint = 768): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.innerWidth < breakpoint,
    () => false,
  );
}
