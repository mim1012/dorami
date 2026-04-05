declare module '@sentry/nextjs' {
  export function init(options: Record<string, any>): void;
  export function captureException(error: unknown, context?: Record<string, any>): void;
  export function captureMessage(message: string, level?: string): void;
  export function setUser(user: { id: string; email?: string } | null): void;
  export function addBreadcrumb(breadcrumb: Record<string, any>): void;
  export function captureRequestError(
    error: unknown,
    request: Record<string, any>,
    errorContext: Record<string, any>,
  ): void;
  export function captureRouterTransitionStart(...args: any[]): void;
  export function replayIntegration(options?: Record<string, any>): any;
  export function withSentryConfig(
    config: any,
    sentryWebpackPluginOptions?: Record<string, any>,
  ): any;
}
