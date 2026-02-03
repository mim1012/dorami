/**
 * Sentry Configuration for Error Tracking
 *
 * To enable Sentry:
 * 1. Install: npm install @sentry/nestjs @sentry/profiling-node
 * 2. Set SENTRY_DSN in environment variables
 * 3. Import and call initSentry() in main.ts before app creation
 *
 * Features:
 * - Automatic error capture
 * - Performance monitoring
 * - Request context
 * - User identification
 */

export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate: number;
  profilesSampleRate: number;
}

export function getSentryConfig(): SentryConfig | null {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.log('Sentry DSN not configured - error tracking disabled');
    return null;
  }

  return {
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || '1.0.0',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  };
}

/**
 * Initialize Sentry (call this in main.ts)
 *
 * Example usage:
 * ```typescript
 * import { initSentry } from './common/monitoring/sentry.config';
 *
 * async function bootstrap() {
 *   initSentry();
 *   const app = await NestFactory.create(AppModule);
 *   // ... rest of setup
 * }
 * ```
 */
export async function initSentry(): Promise<boolean> {
  const config = getSentryConfig();

  if (!config) {
    return false;
  }

  try {
    // Dynamic import to avoid errors if Sentry is not installed
    const Sentry = await import('@sentry/nestjs');

    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      release: config.release,
      tracesSampleRate: config.tracesSampleRate,
      integrations: [
        // Add integrations as needed
        // Sentry.prismaIntegration(), // Uncomment if using Prisma tracing
      ],
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
    const Sentry = await import('@sentry/nestjs');
    Sentry.captureException(error, { extra: context });
  } catch {
    // Sentry not available, just log
    console.error('Error:', error.message, context);
  }
}

/**
 * Set user context for Sentry
 */
export async function setUser(user: { id: string; email?: string; role?: string }): Promise<void> {
  try {
    const Sentry = await import('@sentry/nestjs');
    Sentry.setUser({
      id: user.id,
      email: user.email,
      // Don't include sensitive data
    });
  } catch {
    // Sentry not available
  }
}

/**
 * Clear user context (on logout)
 */
export async function clearUser(): Promise<void> {
  try {
    const Sentry = await import('@sentry/nestjs');
    Sentry.setUser(null);
  } catch {
    // Sentry not available
  }
}
