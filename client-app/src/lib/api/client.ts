const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

interface ApiResponse<T> {
  data: T;
}

/**
 * Get CSRF token from cookie
 */
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;

  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match ? match[1] : null;
}

async function request<T>(
  endpoint: string,
  options?: RequestInit & { params?: Record<string, any> }
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

  // Include CSRF token for non-GET requests
  const csrfToken = getCsrfToken();
  const csrfHeader: Record<string, string> = {};
  if (csrfToken && options?.method && options.method !== 'GET') {
    csrfHeader['X-CSRF-Token'] = csrfToken;
  }

  // Don't set Content-Type for FormData (browser sets multipart boundary automatically)
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  const contentTypeHeader: Record<string, string> = isFormData ? {} : { 'Content-Type': 'application/json' };

  const defaultOptions: RequestInit = {
    headers: {
      ...contentTypeHeader,
      ...csrfHeader,
    },
    credentials: 'include',
  };

  const response = await fetch(url, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: 'An error occurred',
    }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const result = await response.json();

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
