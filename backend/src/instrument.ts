import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  enabled: !!process.env.SENTRY_DSN,
  release: process.env.APP_VERSION,
  environment: process.env.APP_ENV || process.env.NODE_ENV || 'development',
});
