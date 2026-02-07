declare module '@sentry/nextjs' {
  export function init(options: Record<string, any>): void;
  export function captureException(error: Error, context?: Record<string, any>): void;
  export function captureMessage(message: string, level?: string): void;
  export function setUser(user: { id: string; email?: string } | null): void;
  export function addBreadcrumb(breadcrumb: Record<string, any>): void;
}
