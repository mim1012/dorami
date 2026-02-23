import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Enable standalone output for Docker deployment
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
    const mediaServerUrl = process.env.MEDIA_SERVER_URL || 'http://127.0.0.1:8080';

    return {
      fallback: [
        // API proxy: fallback을 사용해야 /api/csrf Route Handler가 먼저 처리됨.
        // afterFiles는 정적 파일만 먼저 확인하지만, fallback은 Route Handler 포함
        // 모든 Next.js 파일을 확인 후 매칭 없을 때만 백엔드로 전달.
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/v1/:path*`,
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

export default nextConfig;
