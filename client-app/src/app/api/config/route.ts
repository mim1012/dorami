import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // env 변경 즉시 반영

export async function GET() {
  return NextResponse.json({
    wsUrl: process.env.WS_URL ?? 'http://localhost:3001',
    kakaoExternalOrigin: process.env.KAKAO_EXTERNAL_ORIGIN ?? '',
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? '',
    enableDevAuth: process.env.ENABLE_DEV_AUTH === 'true',
    previewEnabled: process.env.PREVIEW_ENABLED === 'true',
    cdnUrl: process.env.CDN_URL ?? '',
    appEnv: process.env.APP_ENV ?? 'development',
    appVersion: process.env.APP_VERSION ?? '1.0.0',
    kakaoChannelId: process.env.KAKAO_CHANNEL_ID ?? '_NJMzX',
    instagramId: process.env.INSTAGRAM_ID ?? 'doremiusa',
  });
}
