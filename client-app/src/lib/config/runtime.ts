export interface RuntimeConfig {
  wsUrl: string;
  kakaoExternalOrigin: string;
  vapidPublicKey: string;
  enableDevAuth: boolean;
  previewEnabled: boolean;
  cdnUrl: string;
  appEnv: string;
  appVersion: string;
  kakaoChannelId: string;
  instagramId: string;
}

const DEFAULTS: RuntimeConfig = {
  wsUrl: 'http://localhost:3001',
  kakaoExternalOrigin: '',
  vapidPublicKey: '',
  enableDevAuth: process.env.NODE_ENV === 'development',
  previewEnabled: false,
  cdnUrl: '',
  appEnv: 'development',
  appVersion: '1.0.0',
  kakaoChannelId: '_NJMzX',
  instagramId: 'doremiusa',
};

let cache: RuntimeConfig | null = null;

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (typeof window === 'undefined') return DEFAULTS;
  if (cache) return cache;

  try {
    // no-store: 배포 후 env 바뀌어도 캐싱된 옛값 사용 방지
    const res = await fetch('/api/config', { cache: 'no-store' });
    if (!res.ok) throw new Error(`/api/config returned ${res.status}`);
    cache = (await res.json()) as RuntimeConfig;
    return cache;
  } catch {
    return DEFAULTS;
  }
}

export function clearConfigCache() {
  cache = null;
}
