/**
 * Centralized WebSocket URL resolution.
 *
 * Why centralize? Previously each hook/component independently computed the
 * WebSocket URL with duplicate inline logic. Having a single source of truth
 * means environment-specific overrides need to be applied in exactly one place.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_WS_URL environment variable (set in .env.local / .env.production)
 *   2. window.location.origin  — auto-detects the current host in the browser
 *   3. http://localhost:3001   — SSR / Node.js fallback for local development
 *
 * Environment file configuration:
 *   client-app/.env.local:      NEXT_PUBLIC_WS_URL=http://localhost:3001
 *   client-app/.env.production: NEXT_PUBLIC_WS_URL=https://www.doremi-live.com
 */
export const SOCKET_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
