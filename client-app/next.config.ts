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

    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
      {
        source: '/live/:path*',
        destination: 'http://127.0.0.1:8080/live/:path*',
      },
      {
        source: '/hls/:path*',
        destination: 'http://127.0.0.1:8080/hls/:path*',
      },
    ];
  },
};

export default nextConfig;
