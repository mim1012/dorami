import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

// Security headers applied to every response from the Next.js frontend
const baseHeaders = [
  // Prevent this page from being embedded in frames on other origins (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Legacy XSS protection for older browsers
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Don't send the full URL as referrer to third parties
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Restrict browser feature access
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  // Prevent DNS prefetching from leaking information
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

// HSTS: only apply in production (staging uses HTTP)
const isProduction = process.env.APP_ENV === 'production';
const securityHeaders = isProduction
  ? [
      ...baseHeaders,
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      },
    ]
  : baseHeaders;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Enable standalone output for Docker deployment
  output: 'standalone',
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
    const mediaServerUrl = process.env.MEDIA_SERVER_URL || 'http://127.0.0.1:8080';

    return {
      // afterFiles: 정적 파일(public/) 확인 후, 페이지 라우트 전에 적용.
      // /uploads/ 이미지는 Next.js 페이지나 Route Handler와 충돌하지 않으므로
      // afterFiles에 배치하면 .jpg/.png 같은 파일 확장자 요청도 안정적으로 프록시됨.
      afterFiles: [
        {
          source: '/uploads/:path*',
          destination: `${backendUrl}/uploads/:path*`,
        },
      ],
      fallback: [
        // API proxy: fallback을 사용해야 /api/csrf Route Handler가 먼저 처리됨.
        // afterFiles는 정적 파일만 먼저 확인하지만, fallback은 Route Handler 포함
        // 모든 Next.js 파일을 확인 후 매칭 없을 때만 백엔드로 전달.
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/:path*`,
        },
        // 미디어 스트림 프록시: Next.js 페이지/동적 라우트에 매칭되지 않을 때만 적용
        // FLV 스트림 URL: /live/live/{streamKey}.flv
        {
          source: '/live/live/:path*',
          destination: `${mediaServerUrl}/live/live/:path*`,
        },
        {
          source: '/hls/:path*',
          destination: `${mediaServerUrl}/live/:path*`,
        },
      ],
    };
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  tunnelRoute: '/monitoring',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
});
