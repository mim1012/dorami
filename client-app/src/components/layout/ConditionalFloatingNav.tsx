'use client';

import { usePathname } from 'next/navigation';
import { FloatingNav } from './FloatingNav';

export function ConditionalFloatingNav() {
  const pathname = usePathname();
  if (
    pathname.startsWith('/live') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/(auth)')
  ) {
    return null;
  }
  return <FloatingNav />;
}
