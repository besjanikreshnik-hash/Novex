import { useAuthStore } from '../stores/auth.store';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000/api/v1';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  authenticated?: boolean;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, authenticated = true } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...headers,
  };

  if (authenticated) {
    const token = useAuthStore.getState().getAccessToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const config: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }

  const url = `${BASE_URL}${endpoint}`;

  const response = await fetch(url, config);

  if (response.status === 401) {
    // Token expired - attempt refresh or logout
    await useAuthStore.getState().logout();
    throw new ApiError(401, 'Session expired. Please log in again.');
  }

  // Backend returns data directly (no { success, data } wrapper)
  // For error responses, attempt to parse JSON for error message
  if (!response.ok) {
    let errorMessage = 'Request failed';
    try {
      const errorData = await response.json();
      errorMessage = errorData.message ?? errorData.error ?? errorMessage;
    } catch {
      // Response body may not be JSON
    }
    throw new ApiError(response.status, errorMessage);
  }

  // Some responses (e.g. 204 No Content) may have no body
  const text = await response.text();
  if (!text) return undefined as unknown as T;

  return JSON.parse(text) as T;
}

// ── Helper: Convert display symbol (BTC/USDT) to API symbol (BTC_USDT) ──────

export function toApiSymbol(displaySymbol: string): string {
  return displaySymbol.replace('/', '_');
}

export function toDisplaySymbol(apiSymbol: string): string {
  return apiSymbol.replace('_', '/');
}

// ── Public API Methods ────────────────────────────────────────────────────────

export const api = {
  get: <T>(endpoint: string, opts?: Omit<RequestOptions, 'method'>) =>
    request<T>(endpoint, { ...opts, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...opts, method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...opts, method: 'PUT', body }),

  patch: <T>(endpoint: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...opts, method: 'PATCH', body }),

  delete: <T>(endpoint: string, opts?: Omit<RequestOptions, 'method'>) =>
    request<T>(endpoint, { ...opts, method: 'DELETE' }),
} as const;

export { ApiError };
export default api;
