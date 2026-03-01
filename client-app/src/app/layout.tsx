import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { ThemeProvider } from '@/lib/theme/theme-context';
import { QueryProvider } from '@/lib/providers/query-provider';
import { ToastProvider } from '@/components/common/Toast';
import { ConfirmProvider } from '@/components/common/ConfirmDialog';
import { KakaoInAppBrowserGuard } from '@/components/common/KakaoInAppBrowserGuard';

export const metadata: Metadata = {
  title: 'Live Commerce',
  description: 'Live commerce platform with real-time shopping',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0a0a" />
        {/* iOS PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="도라미 라이브" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="bg-primary-black text-primary-text" suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-hot-pink focus:text-white focus:rounded-button focus:text-sm focus:font-medium"
        >
          본문으로 건너뛰기
        </a>
        {/* Kakao SDK */}
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.0/kakao.min.js"
          integrity="sha384-l+xbElFSnPZ2rOaPrU//2FF5B4LB8FiX5q4fXYTlfcG4PGpMkE1vcL7kNXI6Cci0"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />

        <KakaoInAppBrowserGuard />
        <QueryProvider>
          <ThemeProvider>
            <ToastProvider>
              <ConfirmProvider>
                <div id="main-content">{children}</div>
              </ConfirmProvider>
            </ToastProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
