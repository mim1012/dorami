const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const DEFAULT_TIMEOUT_MS = 30000;

interface ApiResponse<T> {
  data: T;
}

export interface RequestOptions {
  params?: Record<string, any>;
  signal?: AbortSignal;
  timeout?: number;
}

export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timeout after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Custom API error that includes backend error details
 */
export class ApiError extends Error {
  statusCode: number;
  errorCode: string;
  details?: any;

  constructor(statusCode: number, message: string, errorCode: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

/**
 * Get CSRF token from cookie
 */
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;

  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match ? match[1] : null;
}

// Token refresh state - prevents multiple concurrent refresh calls
let refreshPromise: Promise<boolean> | null = null;

// CSRF token bootstrap state - prevents concurrent fetches
let csrfBootstrapPromise: Promise<void> | null = null;

/**
 * Ensure the CSRF token cookie exists in the browser.
 *
 * The backend sets the cookie via Set-Cookie on GET responses, but Next.js
 * rewrites (App Router + standalone) may not forward those headers reliably.
 * This fetches /api/csrf — a Next.js Route Handler that sets the cookie
 * directly, bypassing the proxy — so mutations always have the token.
 */
async function ensureCsrfToken(): Promise<void> {
  if (typeof document === 'undefined') return;
  if (getCsrfToken()) return; // already present

  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = fetch('/api/csrf', { credentials: 'include' })
      .then(
        () => {}, // discard Response → Promise<void>
        () => {}, // best-effort: 403 from caller if this fails
      )
      .finally(() => {
        csrfBootstrapPromise = null;
      });
  }

  await csrfBootstrapPromise;

  // H-1: 부트스트랩 후 쿠키가 실제로 설정됐는지 확인.
  // 실패했다면 이후 POST가 조용히 403이 되므로 경고를 남긴다.
  if (!getCsrfToken() && process.env.NODE_ENV !== 'production') {
    console.warn('[CSRF] Bootstrap failed — subsequent mutations may return 403');
  }
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    await ensureCsrfToken();
    const response = await executeFetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Execute a fetch request with the given merged options and an optional timeout.
 * Factored out so the retry path can reuse it without rebuilding options.
 */
async function executeFetch(
  url: string,
  options?: RequestInit & { params?: Record<string, any> },
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  callerSignal?: AbortSignal,
): Promise<Response> {
  // Include CSRF token for non-GET requests
  const csrfToken = getCsrfToken();
  const csrfHeader: Record<string, string> = {};
  if (csrfToken && options?.method && options.method !== 'GET') {
    csrfHeader['X-CSRF-Token'] = csrfToken;
  }

  // Don't set Content-Type for FormData (browser sets multipart boundary automatically)
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  const contentTypeHeader: Record<string, string> = isFormData
    ? {}
    : { 'Content-Type': 'application/json' };

  const defaultOptions: RequestInit = {
    headers: {
      ...contentTypeHeader,
      ...csrfHeader,
    },
    credentials: 'include',
  };

  // Create a timeout-based AbortController and combine with any caller-provided signal
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  // Combine caller signal + timeout signal so either can abort the request
  let combinedSignal: AbortSignal;
  if (callerSignal) {
    if (typeof AbortSignal.any === 'function') {
      combinedSignal = AbortSignal.any([callerSignal, timeoutController.signal]);
    } else {
      // Fallback for environments without AbortSignal.any
      const combined = new AbortController();
      const abort = () => combined.abort();
      callerSignal.addEventListener('abort', abort, { once: true });
      timeoutController.signal.addEventListener('abort', abort, { once: true });
      combinedSignal = combined.signal;
    }
  } else {
    combinedSignal = timeoutController.signal;
  }

  try {
    const response = await fetch(url, {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options?.headers,
      },
      signal: combinedSignal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      if (timeoutController.signal.aborted && !callerSignal?.aborted) {
        throw new TimeoutError(timeoutMs);
      }
    }
    throw error;
  }
}

async function request<T>(
  endpoint: string,
  options?: RequestInit & { params?: Record<string, any>; timeout?: number; signal?: AbortSignal },
): Promise<ApiResponse<T>> {
  let url = `${API_BASE_URL}${endpoint}`;

  const timeoutMs = options?.timeout ?? DEFAULT_TIMEOUT_MS;
  const callerSignal = options?.signal;

  // Add query parameters if provided
  if (options?.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((v) => searchParams.append(key, String(v)));
        } else {
          searchParams.append(key, String(value));
        }
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  // For non-GET requests, ensure the CSRF cookie is present before sending.
  // This is a no-op when the cookie already exists (fast path).
  if (options?.method && options.method !== 'GET') {
    await ensureCsrfToken();
  }

  let response = await executeFetch(url, options, timeoutMs, callerSignal);

  // On 401, attempt to refresh the access token and retry once
  if (response.status === 401 && endpoint !== '/auth/refresh') {
    // Coalesce concurrent refresh calls into a single request
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const refreshed = await refreshPromise;

    if (refreshed) {
      // Retry the original request with fresh token
      response = await executeFetch(url, options, timeoutMs, callerSignal);
    } else {
      // Refresh failed.
      // For non-auth endpoints: redirect to login with clear reason so users
      // see "세션이 만료되었습니다" instead of a generic app error.
      // Auth endpoints (/auth/, /users/me) are excluded to avoid loops —
      // useAuth and useProfileGuard handle those redirects themselves.
      const isAuthEndpoint = endpoint.startsWith('/auth/') || endpoint === '/users/me';
      if (typeof window !== 'undefined' && !isAuthEndpoint) {
        // Synchronously clear persisted auth before the page reload so that
        // the login page never sees stale isAuthenticated=true from localStorage.
        // Without this, window.location.href fires before setUser(null) can
        // persist, causing the login page to immediately redirect back to '/'
        // and creating an infinite redirect loop.
        try {
          localStorage.removeItem('auth-storage');
        } catch {
          // ignore — storage may be unavailable (e.g. private browsing restrictions)
        }
        window.location.href = '/login?reason=session_expired';
      }
      throw new ApiError(401, 'Session expired', 'SESSION_EXPIRED');
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      statusCode: response.status,
      message: 'An error occurred',
      error: response.statusText,
    }));
    throw new ApiError(
      error.statusCode || response.status,
      error.message || `HTTP ${response.status}`,
      error.error || error.errorCode || response.statusText,
      error.details,
    );
  }

  const text = await response.text();
  if (!text) {
    return { data: undefined as any };
  }

  const result = JSON.parse(text);

  // Backend wraps responses in { data: ..., success: true, timestamp: "..." }
  // Extract the actual data from the wrapper
  if (result && typeof result === 'object' && 'data' in result) {
    return { data: result.data };
  }

  return { data: result };
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { method: 'GET', ...options }),

  post: <T>(endpoint: string, body?: any, options?: Pick<RequestOptions, 'signal' | 'timeout'>) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      ...options,
    }),

  patch: <T>(endpoint: string, body?: any, options?: Pick<RequestOptions, 'signal' | 'timeout'>) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      ...options,
    }),

  put: <T>(endpoint: string, body?: any, options?: Pick<RequestOptions, 'signal' | 'timeout'>) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      ...options,
    }),

  delete: <T>(endpoint: string, options?: Pick<RequestOptions, 'signal' | 'timeout'>) =>
    request<T>(endpoint, { method: 'DELETE', ...options }),
};
