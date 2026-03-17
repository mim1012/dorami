/**
 * WebSocket URL resolution.
 *
 * Resolution order for SOCKET_URL (sync):
 *   1. NEXT_PUBLIC_WS_URL — set only in .env.local for local dev
 *   2. window.location.origin — auto-detects the current host in staging/production
 *   3. http://localhost:3001 — SSR fallback (socket connections are client-side only)
 *
 * For async runtime config (getSocketUrl), uses /api/config endpoint.
 */
import { getRuntimeConfig } from './runtime';

export const SOCKET_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');

export const SOCKET_URL_PLACEHOLDER = 'http://localhost:3001';

export async function getSocketUrl(): Promise<string> {
  if (typeof window === 'undefined') return SOCKET_URL_PLACEHOLDER;
  const config = await getRuntimeConfig();
  return config.wsUrl;
}
