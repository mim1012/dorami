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
      beforeFiles: [
        // API proxy: backend 서버로 전달
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/v1/:path*`,
        },
      ],
      fallback: [
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
