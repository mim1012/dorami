/**
 * Sentry Configuration for Frontend Error Tracking
 *
 * To enable Sentry:
 * 1. Install: npm install @sentry/nextjs
 * 2. Set NEXT_PUBLIC_SENTRY_DSN in environment variables
 * 3. Call initSentry() in _app.tsx or layout.tsx
 *
 * Features:
 * - Automatic error capture
 * - Performance monitoring
 * - Session replay (optional)
 * - User identification
 */

export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
}

export function getSentryConfig(): SentryConfig | null {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    console.log('Sentry DSN not configured - error tracking disabled');
    return null;
  }

  const isProd = process.env.NODE_ENV === 'production';

  return {
    dsn,
    environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development',
    release: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    tracesSampleRate: isProd ? 0.1 : 1.0,
    replaysSessionSampleRate: isProd ? 0.1 : 0,
    replaysOnErrorSampleRate: isProd ? 1.0 : 0,
  };
}

/**
 * Initialize Sentry
 */
export async function initSentry(): Promise<boolean> {
  const config = getSentryConfig();

  if (!config) {
    return false;
  }

  try {
    const Sentry = await import('@sentry/nextjs');

    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      release: config.release,
      tracesSampleRate: config.tracesSampleRate,
      replaysSessionSampleRate: config.replaysSessionSampleRate,
      replaysOnErrorSampleRate: config.replaysOnErrorSampleRate,
    });

    console.log(`Sentry initialized for ${config.environment} environment`);
    return true;
  } catch (error) {
    console.log('Sentry package not installed - error tracking disabled');
    return false;
  }
}

/**
 * Capture an exception manually
 */
export async function captureException(error: Error, context?: Record<string, any>): Promise<void> {
  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureException(error, { extra: context });
  } catch {
    console.error('Error:', error.message, context);
  }
}

/**
 * Capture a message
 */
export async function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
): Promise<void> {
  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureMessage(message, level);
  } catch {
    console.log(`[${level}] ${message}`);
  }
}

/**
 * Set user context for Sentry
 */
export async function setUser(
  user: {
    id: string;
    email?: string;
  } | null,
): Promise<void> {
  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.setUser(user);
  } catch {
    // Sentry not available
  }
}

/**
 * Add breadcrumb for debugging
 */
export async function addBreadcrumb(breadcrumb: {
  category: string;
  message: string;
  level?: 'debug' | 'info' | 'warning' | 'error';
  data?: Record<string, any>;
}): Promise<void> {
  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.addBreadcrumb(breadcrumb);
  } catch {
    // Sentry not available
  }
}
