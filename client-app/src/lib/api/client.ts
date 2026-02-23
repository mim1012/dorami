const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

interface ApiResponse<T> {
  data: T;
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

async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Execute a fetch request with the given merged options.
 * Factored out so the retry path can reuse it without rebuilding options.
 */
async function executeFetch(
  url: string,
  options?: RequestInit & { params?: Record<string, any> },
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

  return fetch(url, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options?.headers,
    },
  });
}

async function request<T>(
  endpoint: string,
  options?: RequestInit & { params?: Record<string, any> },
): Promise<ApiResponse<T>> {
  let url = `${API_BASE_URL}${endpoint}`;

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

  let response = await executeFetch(url, options);

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
      response = await executeFetch(url, options);
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
      error.error || response.statusText,
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
  get: <T>(endpoint: string, options?: { params?: Record<string, any> }) =>
    request<T>(endpoint, { method: 'GET', ...options }),

  post: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};
