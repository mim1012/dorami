import { useSyncExternalStore } from 'react';

export type Orientation = 'portrait' | 'landscape';

function getSnapshot(): Orientation {
  return window.matchMedia('(orientation: landscape)').matches ? 'landscape' : 'portrait';
}

function getServerSnapshot(): Orientation {
  return 'portrait';
}

function subscribe(callback: () => void) {
  window.addEventListener('orientationchange', callback);
  window.addEventListener('resize', callback);
  return () => {
    window.removeEventListener('orientationchange', callback);
    window.removeEventListener('resize', callback);
  };
}

/**
 * SSR-safe orientation detection using useSyncExternalStore.
 * Server snapshot returns 'portrait' to match initial SSR HTML.
 */
export function useOrientation(): Orientation {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
